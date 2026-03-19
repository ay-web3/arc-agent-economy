// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

contract TaskEscrow is AccessControl, ReentrancyGuard {
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    AgentRegistry public immutable registry;

    // ================= ECONOMICS =================
    uint256 public protocolFeeBps;       // e.g. 200 = 2%
    uint16  public treasuryShareBps;     // 6000 = 60%
    uint16  public finalizerShareBps;    // 4000 = 40%

    uint16  public verifierFeeBps;       // e.g. 50 = 0.50%
    uint256 public minVerifierFee;       // floor reward (native)

    uint16  public difficultyAlphaBps;   // 10000 = 1.0 baseline

    uint16  public verifierSlashBps;     // e.g. 200 = 2%
    uint256 public verifierSlashCap;     // max slash cap (native)

    // Floor on seller budget (derived from total - verifierPool)
    uint256 public minDerivedPrice;

    address public treasury;
    uint256 public taskCounter;

    enum State {
        NONE,
        CREATED,         // open task posted (bidding live until bidDeadline)
        ACCEPTED,        // seller assigned (manual select or auto finalize)
        SUBMITTED,       // seller posted result
        QUORUM_APPROVED, // verifiers reached quorum (VOTE YES)
        REJECTED,        // verifiers reached quorum (VOTE NO)
        FINALIZED,
        TIMEOUT_REFUNDED,
        DISPUTED,
        RESOLVED
    }

    enum DisputeRuling { REFUND_BUYER, PAY_SELLER, SPLIT }

    struct Task {
        address buyer;
        address seller;          
        uint256 price;           
        uint256 verifierPool;    
        uint256 sellerBudget;    
        uint64  deadline;        // job deadline for submission
        uint64  bidDeadline;     // auction deadline
        uint64  verifierDeadline; // NEW: deadline for verifiers to act
        bytes32 taskHash;
        bytes32 resultHash;
        string  resultURI;
        State   state;
        uint8   quorumM;
        uint8   quorumN;
    }

    struct Bid {
        address bidder;
        uint256 bidPrice;     
        uint64  etaSeconds;   
        bytes32 metaHash;     
        bool    exists;
    }

    mapping(uint256 => Task) public tasks;

    mapping(uint256 => address[]) public verifiers;
    mapping(uint256 => mapping(address => bool)) public isVerifierForTask;

    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(uint256 => mapping(address => bool)) public hasRejected; // NEW
    mapping(uint256 => uint8) public approvalCount;
    mapping(uint256 => uint8) public rejectionCount; // NEW
    mapping(uint256 => address[]) public approvers;

    mapping(uint256 => Bid[]) public bids;

    // ================= EVENTS =================
    event TaskOpen(
        uint256 indexed taskId,
        uint256 totalEscrow,
        uint256 sellerBudget,
        uint256 verifierPool,
        uint64 bidDeadline
    );

    event BidPlaced(
        uint256 indexed taskId,
        address indexed bidder,
        uint256 bidPrice,
        uint64 etaSeconds
    );

    event BidSelected(
        uint256 indexed taskId,
        address indexed seller,
        uint256 bidPrice,
        uint256 refundToBuyer
    );

    event AuctionFinalized(
        uint256 indexed taskId,
        address indexed seller,
        uint256 winningBid,
        uint256 refundToBuyer
    );

    event NoBidsCanceled(uint256 indexed taskId, uint256 refund);

    event ResultSubmitted(
        uint256 indexed taskId,
        address indexed seller,
        bytes32 resultHash,
        string resultURI
    );

    event QuorumReached(uint256 indexed taskId);
    event TaskRejected(uint256 indexed taskId); // NEW
    event TaskFinalized(uint256 indexed taskId);
    event TimeoutRefunded(uint256 indexed taskId, uint256 refundAmount);
    event VerifierTimeoutRefunded(uint256 indexed taskId, uint256 refundAmount); // NEW

    event DisputeOpened(uint256 indexed taskId, address indexed opener);
    event DisputeResolved(uint256 indexed taskId, DisputeRuling ruling);

    constructor(address registryAddress, address _treasury, uint256 _protocolFeeBps) {
        require(registryAddress != address(0), "BAD_REGISTRY");
        require(_treasury != address(0), "BAD_TREASURY");

        registry = AgentRegistry(registryAddress);
        treasury = _treasury;
        protocolFeeBps = _protocolFeeBps;

        treasuryShareBps = 6000;
        finalizerShareBps = 4000;

        verifierFeeBps = 50;         
        minVerifierFee = 0.5 ether;  

        difficultyAlphaBps = 10000;  

        verifierSlashBps = 200;      
        verifierSlashCap = 5 ether;  

        minDerivedPrice = 1 ether;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
    }

    // ================= GOVERNANCE =================
    function setDifficultyAlpha(uint16 _alphaBps) external onlyRole(GOVERNANCE_ROLE) {
        require(_alphaBps <= 20000, "ALPHA_TOO_HIGH");
        difficultyAlphaBps = _alphaBps;
    }

    function setMinDerivedPrice(uint256 _min) external onlyRole(GOVERNANCE_ROLE) {
        minDerivedPrice = _min;
    }

    // ================= INTERNAL HELPERS =================
    function _requireEligibleSeller(address s) internal view {
        require(registry.isSeller(s), "NOT_SELLER");
        require(registry.availableStake(s) >= registry.minSellerStake(), "LOW_STAKE");
    }

    // ================= OPEN TASK (AUCTION) =================
    function createOpenTask(
        uint64 jobDeadline,
        uint64 bidDeadline,
        uint64 verifierDeadline, // NEW
        bytes32 taskHash,
        address[] calldata _verifiers,
        uint8 quorumM
    ) external payable nonReentrant returns (uint256 taskId) {
        require(jobDeadline > block.timestamp, "BAD_JOB_DEADLINE");
        require(bidDeadline > block.timestamp, "BAD_BID_DEADLINE");
        require(bidDeadline < jobDeadline, "BID_AFTER_JOB");
        require(verifierDeadline > jobDeadline, "VERIFIER_BEFORE_JOB"); // NEW
        require(_verifiers.length > 0, "NO_VERIFIERS");
        require(quorumM > 0 && quorumM <= _verifiers.length, "BAD_QUORUM");

        uint256 total = msg.value;

        uint256 percentFee = (total * verifierFeeBps) / 10_000;
        uint256 basePool = percentFee > minVerifierFee ? percentFee : minVerifierFee;

        uint256 difficultyBps = (uint256(quorumM) * 10_000) / _verifiers.length;
        uint256 multiplierBps =
            10_000 + (uint256(difficultyAlphaBps) * difficultyBps) / 10_000;

        uint256 verifierPool = (basePool * multiplierBps) / 10_000;

        require(total > verifierPool, "INSUFFICIENT_ESCROW");

        uint256 sellerBudget = total - verifierPool;
        require(sellerBudget >= minDerivedPrice, "BUDGET_TOO_LOW");

        taskId = ++taskCounter;

        Task storage t = tasks[taskId];
        t.buyer = msg.sender;
        t.seller = address(0);
        t.price = 0;
        t.verifierPool = verifierPool;
        t.sellerBudget = sellerBudget;
        t.deadline = jobDeadline;
        t.bidDeadline = bidDeadline;
        t.verifierDeadline = verifierDeadline; // NEW
        t.taskHash = taskHash;
        t.state = State.CREATED;
        t.quorumM = quorumM;
        t.quorumN = uint8(_verifiers.length);

        verifiers[taskId] = _verifiers;
        for (uint256 i = 0; i < _verifiers.length; i++) {
            address v = _verifiers[i];
            require(v != address(0), "BAD_VERIFIER");
            require(!isVerifierForTask[taskId][v], "DUP_VERIFIER");
            isVerifierForTask[taskId][v] = true;
        }

        emit TaskOpen(taskId, total, sellerBudget, verifierPool, bidDeadline);
    }

    function placeBid(
        uint256 taskId,
        uint256 bidPrice,
        uint64 etaSeconds,
        bytes32 metaHash
    ) external {
        Task storage t = tasks[taskId];
        require(t.state == State.CREATED, "BAD_STATE");
        require(block.timestamp < t.bidDeadline, "BIDDING_CLOSED");
        require(bidPrice > 0 && bidPrice <= t.sellerBudget, "BAD_BID");

        _requireEligibleSeller(msg.sender);

        bids[taskId].push(
            Bid({
                bidder: msg.sender,
                bidPrice: bidPrice,
                etaSeconds: etaSeconds,
                metaHash: metaHash,
                exists: true
            })
        );

        emit BidPlaced(taskId, msg.sender, bidPrice, etaSeconds);
    }

    function selectBid(uint256 taskId, uint256 bidIndex) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.state == State.CREATED, "BAD_STATE");
        require(msg.sender == t.buyer, "NOT_BUYER");
        require(block.timestamp < t.bidDeadline, "BIDDING_CLOSED");

        Bid[] storage bs = bids[taskId];
        require(bs.length > 0, "NO_BIDS");
        require(bidIndex < bs.length, "BAD_INDEX");

        Bid storage b = bs[bidIndex];
        require(b.exists, "NO_BID");
        require(b.bidPrice > 0 && b.bidPrice <= t.sellerBudget, "BAD_BID");

        _requireEligibleSeller(b.bidder);

        t.seller = b.bidder;
        t.price = b.bidPrice;
        t.state = State.ACCEPTED;

        uint256 refund = t.sellerBudget - b.bidPrice;
        if (refund > 0) {
            (bool ok,) = payable(t.buyer).call{value: refund}("");
            require(ok, "REFUND_FAIL");
        }

        emit BidSelected(taskId, t.seller, t.price, refund);
    }

    function finalizeAuction(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.state == State.CREATED, "BAD_STATE");
        require(block.timestamp >= t.bidDeadline, "BIDDING_OPEN");

        Bid[] storage bs = bids[taskId];
        require(bs.length > 0, "NO_BIDS");

        uint256 bestIdx = 0;
        uint256 bestPrice = bs[0].bidPrice;

        for (uint256 i = 1; i < bs.length; i++) {
            uint256 p = bs[i].bidPrice;
            if (p < bestPrice) {
                bestPrice = p;
                bestIdx = i;
            }
        }

        address winner = bs[bestIdx].bidder;
        _requireEligibleSeller(winner);

        t.seller = winner;
        t.price = bestPrice;
        t.state = State.ACCEPTED;

        uint256 refund = t.sellerBudget - bestPrice;
        if (refund > 0) {
            (bool ok,) = payable(t.buyer).call{value: refund}("");
            require(ok, "REFUND_FAIL");
        }

        emit AuctionFinalized(taskId, winner, bestPrice, refund);
    }

    function cancelIfNoBids(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];

        require(t.state == State.CREATED, "BAD_STATE");
        require(msg.sender == t.buyer, "NOT_BUYER");
        require(block.timestamp >= t.bidDeadline, "BIDDING_OPEN");
        require(bids[taskId].length == 0, "HAS_BIDS");

        uint256 refund = t.sellerBudget + t.verifierPool;

        t.state = State.TIMEOUT_REFUNDED;
        t.price = 0;
        t.seller = address(0);
        t.sellerBudget = 0;
        t.verifierPool = 0;

        (bool ok,) = payable(t.buyer).call{value: refund}("");
        require(ok, "REFUND_FAIL");

        emit NoBidsCanceled(taskId, refund);
    }

    // ================= SELLER SUBMISSION =================
    function submitResult(
        uint256 taskId,
        bytes32 resultHash,
        string calldata resultURI
    ) external {
        Task storage t = tasks[taskId];
        require(t.state == State.ACCEPTED, "BAD_STATE");
        require(msg.sender == t.seller, "NOT_SELLER");
        require(block.timestamp <= t.deadline, "PAST_DEADLINE");
        require(bytes(resultURI).length > 0, "BAD_URI");

        t.resultHash = resultHash;
        t.resultURI = resultURI;
        t.state = State.SUBMITTED;

        emit ResultSubmitted(taskId, msg.sender, resultHash, resultURI);
    }

    function timeoutRefund(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.state == State.ACCEPTED, "BAD_STATE");
        require(msg.sender == t.buyer, "NOT_BUYER");
        require(block.timestamp > t.deadline, "NOT_EXPIRED");

        uint256 refundAmount = t.price + t.verifierPool;

        t.state = State.TIMEOUT_REFUNDED;
        t.price = 0;
        t.verifierPool = 0;
        t.sellerBudget = 0;
        t.seller = address(0);

        (bool ok,) = payable(t.buyer).call{value: refundAmount}("");
        require(ok, "REFUND_FAIL");

        emit TimeoutRefunded(taskId, refundAmount);
    }

    // ================= APPROVE (VERIFIERS) =================
    function approve(uint256 taskId) external {
        Task storage t = tasks[taskId];

        require(t.state == State.SUBMITTED, "BAD_STATE");
        require(isVerifierForTask[taskId][msg.sender], "NOT_IN_SET");

        require(registry.isVerifier(msg.sender), "NOT_VERIFIER");
        require(registry.availableStake(msg.sender) >= registry.minVerifierStake(), "LOW_STAKE");

        require(!hasApproved[taskId][msg.sender] && !hasRejected[taskId][msg.sender], "ALREADY_VOTED");

        hasApproved[taskId][msg.sender] = true;
        approvers[taskId].push(msg.sender);

        uint8 newCount = ++approvalCount[taskId];
        if (newCount >= t.quorumM) {
            t.state = State.QUORUM_APPROVED;
            emit QuorumReached(taskId);
        }
    }

    // NEW: Point 1 - reject function
    function reject(uint256 taskId) external {
        Task storage t = tasks[taskId];

        require(t.state == State.SUBMITTED, "BAD_STATE");
        require(isVerifierForTask[taskId][msg.sender], "NOT_IN_SET");

        require(registry.isVerifier(msg.sender), "NOT_VERIFIER");
        require(registry.availableStake(msg.sender) >= registry.minVerifierStake(), "LOW_STAKE");

        require(!hasApproved[taskId][msg.sender] && !hasRejected[taskId][msg.sender], "ALREADY_VOTED");

        hasRejected[taskId][msg.sender] = true;

        uint8 newCount = ++rejectionCount[taskId];
        if (newCount >= t.quorumM) {
            t.state = State.REJECTED;
            emit TaskRejected(taskId);
        }
    }

    // NEW: Point 3 - verifierTimeoutRefund
    function verifierTimeoutRefund(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.state == State.SUBMITTED, "BAD_STATE");
        require(msg.sender == t.buyer, "NOT_BUYER");
        require(block.timestamp > t.verifierDeadline, "NOT_EXPIRED");

        _slashZombies(taskId);

        uint256 refundAmount = t.price + t.verifierPool;

        t.state = State.TIMEOUT_REFUNDED;
        t.price = 0;
        t.verifierPool = 0;
        t.sellerBudget = 0;

        (bool ok,) = payable(t.buyer).call{value: refundAmount}("");
        require(ok, "REFUND_FAIL");

        emit VerifierTimeoutRefunded(taskId, refundAmount);
    }

    // ================= FINALIZE (KEEPER) =================
    function finalize(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.state == State.QUORUM_APPROVED, "NOT_READY");

        t.state = State.FINALIZED;

        _slashZombies(taskId); // Point 4 integration

        uint256 fee = (t.price * protocolFeeBps) / 10_000;
        uint256 sellerPayout = t.price - fee;

        uint256 treasuryShare = (fee * treasuryShareBps) / 10_000;
        uint256 finalizerShare = fee - treasuryShare;

        (bool ok1,) = payable(t.seller).call{value: sellerPayout}("");
        require(ok1, "SELLER_PAY_FAIL");

        (bool ok2,) = payable(treasury).call{value: treasuryShare}("");
        require(ok2, "TREASURY_PAY_FAIL");

        (bool ok3,) = payable(msg.sender).call{value: finalizerShare}("");
        require(ok3, "FINALIZER_PAY_FAIL");

        uint256 count = approvalCount[taskId];
        if (count > 0 && t.verifierPool > 0) {
            uint256 per = t.verifierPool / count;
            for (uint256 i = 0; i < approvers[taskId].length; i++) {
                (bool okv,) = payable(approvers[taskId][i]).call{value: per}("");
                require(okv, "VERIFIER_PAY_FAIL");
            }
        }

        emit TaskFinalized(taskId);
    }

    // ================= DISPUTE =================
    // Point 2 - Updated openDispute
    function openDispute(uint256 taskId) external {
        Task storage t = tasks[taskId];
        require(msg.sender == t.buyer || msg.sender == t.seller, "UNAUTHORIZED");
        require(t.state == State.SUBMITTED || t.state == State.QUORUM_APPROVED || t.state == State.REJECTED, "BAD_STATE");

        t.state = State.DISPUTED;
        emit DisputeOpened(taskId, msg.sender);
    }

    function resolveDispute(
        uint256 taskId,
        DisputeRuling ruling,
        uint16 buyerBps
    ) external onlyRole(GOVERNANCE_ROLE) nonReentrant {
        Task storage t = tasks[taskId];
        require(t.state == State.DISPUTED, "NOT_DISPUTED");

        uint256 price = t.price;
        uint256 vPool = t.verifierPool;

        // effects
        t.state = State.RESOLVED;
        t.price = 0;
        t.verifierPool = 0;
        t.sellerBudget = 0;

        if (ruling == DisputeRuling.REFUND_BUYER) {
            _slashApprovers(taskId, price);
            registry.slash(t.seller, price, t.buyer); // NEW: Point 5

            uint256 refund = price + vPool;
            (bool ok,) = payable(t.buyer).call{value: refund}("");
            require(ok, "REFUND_FAIL");

            emit DisputeResolved(taskId, ruling);
            return;
        }

        if (ruling == DisputeRuling.PAY_SELLER) {
            require(t.seller != address(0), "NO_SELLER");

            uint256 fee = (price * protocolFeeBps) / 10_000;
            uint256 sellerPayout = price - fee;

            uint256 treasuryShare = (fee * treasuryShareBps) / 10_000;
            uint256 finalizerShare = fee - treasuryShare;

            (bool ok1,) = payable(t.seller).call{value: sellerPayout}("");
            require(ok1, "SELLER_PAY_FAIL");

            (bool ok2,) = payable(treasury).call{value: treasuryShare}("");
            require(ok2, "TREASURY_PAY_FAIL");

            (bool ok3,) = payable(msg.sender).call{value: finalizerShare}("");
            require(ok3, "FINALIZER_PAY_FAIL");

            uint256 count = approvalCount[taskId];
            if (count > 0 && vPool > 0) {
                uint256 per = vPool / count;
                for (uint256 i = 0; i < approvers[taskId].length; i++) {
                    (bool okv,) = payable(approvers[taskId][i]).call{value: per}("");
                    require(okv, "VERIFIER_PAY_FAIL");
                }
            }

            emit DisputeResolved(taskId, ruling);
            return;
        }

        if (ruling == DisputeRuling.SPLIT) {
            require(t.seller != address(0), "NO_SELLER");
            require(buyerBps <= 10_000, "BAD_BPS");

            // 1) protocol fee (like finalize)
            uint256 fee = (price * protocolFeeBps) / 10_000;

            uint256 treasuryShare = (fee * treasuryShareBps) / 10_000;
            uint256 finalizerShare = fee - treasuryShare;

            (bool okT,) = payable(treasury).call{value: treasuryShare}("");
            require(okT, "TREASURY_PAY_FAIL");

            (bool okF,) = payable(msg.sender).call{value: finalizerShare}("");
            require(okF, "FINALIZER_PAY_FAIL");

            // 2) verifierPool payout OR refund to buyer if nobody approved
            uint256 count = approvalCount[taskId];
            if (count > 0 && vPool > 0) {
                uint256 per = vPool / count;
                for (uint256 i = 0; i < approvers[taskId].length; i++) {
                    (bool okV,) = payable(approvers[taskId][i]).call{value: per}("");
                    require(okV, "VERIFIER_PAY_FAIL");
                }
            } else if (vPool > 0) {
                (bool okR,) = payable(t.buyer).call{value: vPool}("");
                require(okR, "VPOOL_REFUND_FAIL");
            }

            // 3) split remaining (price - fee)
            uint256 remaining = price - fee;
            uint256 buyerAmt = (remaining * buyerBps) / 10_000;
            uint256 sellerAmt = remaining - buyerAmt;

            (bool okB,) = payable(t.buyer).call{value: buyerAmt}("");
            require(okB, "BUYER_SPLIT_FAIL");

            (bool okS,) = payable(t.seller).call{value: sellerAmt}("");
            require(okS, "SELLER_SPLIT_FAIL");

            emit DisputeResolved(taskId, ruling);
            return;
        }

        revert("BAD_RULING");
    }

    function _slashApprovers(uint256 taskId, uint256 price) internal {
        uint256 pool = (price * verifierSlashBps) / 10_000;
        if (pool > verifierSlashCap) pool = verifierSlashCap;

        uint256 count = approvers[taskId].length;
        if (count == 0) return;

        uint256 per = pool / count;
        for (uint256 i = 0; i < count; i++) {
            registry.slash(approvers[taskId][i], per, treasury);
        }
    }

    // NEW: Point 4 - Internal _slashZombies
    function _slashZombies(uint256 taskId) internal {
        address[] memory taskVerifiers = verifiers[taskId];
        uint256 slashAmount = 1 ether; // Fixed inactive penalty

        for (uint256 i = 0; i < taskVerifiers.length; i++) {
            address v = taskVerifiers[i];
            if (!hasApproved[taskId][v] && !hasRejected[taskId][v]) {
                // If zombie did not vote, slash them
                try registry.slash(v, slashAmount, treasury) {} catch {}
            }
        }
    }
}
