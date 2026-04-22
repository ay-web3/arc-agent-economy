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

    uint16  public verifierFeeBps;       
    uint256 public minVerifierFee;       

    uint16  public difficultyAlphaBps;   

    uint16  public verifierSlashBps;     
    uint256 public verifierSlashCap;     

    uint16  public sellerSlashBps = 2000; // REFINED: 20% penalty for bad work (Point 1)

    // Floor on seller budget (derived from total - verifierPool)
    uint256 public minDerivedPrice;

    // Option C: Separate nano micro-payment floor (much lower than standard)
    uint256 public minNanoPrice;

    address public treasury;
    uint256 public taskCounter;

    enum State {
        NONE,
        CREATED,         
        ACCEPTED,        
        SUBMITTED,       
        QUORUM_APPROVED, 
        REJECTED,        
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
        uint64  deadline;        
        uint64  bidDeadline;     
        uint64  verifierDeadline; 
        uint64  approvalTimestamp; // REFINED: Cooling-off tracking (Point 3)
        bytes32 taskHash;
        bytes32 resultHash;
        string  resultURI;
        State   state;
        uint8   quorumM;
        uint8   quorumN;
        bool    isNano; // New: Flag for Circle x402 Batching
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
    mapping(uint256 => mapping(address => bool)) public hasRejected; 
    mapping(uint256 => uint8) public approvalCount;
    mapping(uint256 => uint8) public rejectionCount; 
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
    event TaskRejected(uint256 indexed taskId); 
    event TaskFinalized(uint256 indexed taskId);
    event TimeoutRefunded(uint256 indexed taskId, uint256 refundAmount);
    event VerifierTimeoutRefunded(uint256 indexed taskId, uint256 refundAmount); 

    event NanoSettlementAuthorized(uint256 indexed taskId, address indexed seller, uint256 amount);

    event DisputeOpened(uint256 indexed taskId, address indexed opener);
    event DisputeResolved(uint256 indexed taskId, DisputeRuling ruling);

    constructor(address registryAddress, address _treasury, uint256 _protocolFeeBps) {
        require(registryAddress != address(0), "BAD_REGISTRY");
        require(_treasury != address(0), "BAD_TREASURY");

        registry = AgentRegistry(registryAddress);
        treasury = _treasury;
        protocolFeeBps = _protocolFeeBps;

        treasuryShareBps = 6666; // 4% of total (from the 6% taken)
        finalizerShareBps = 3334; // 2% of total
 
        verifierFeeBps = 400; // 4% Pool        
        minVerifierFee = 0.5 ether;  

        difficultyAlphaBps = 10000;  

        verifierSlashBps = 200;      
        verifierSlashCap = 5 ether;  

        minDerivedPrice = 1 ether;

        // Option C: Default nano floor = 0.00001 USDC (ultra micro-payment)
        minNanoPrice = 0.00001 ether;

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

    // Option B: Governance can now lower the verifier fee floor for micro-payment networks
    function setMinVerifierFee(uint256 _min) external onlyRole(GOVERNANCE_ROLE) {
        minVerifierFee = _min;
    }

    // Option C: Governance can tune the nano-specific price floor independently
    function setMinNanoPrice(uint256 _min) external onlyRole(GOVERNANCE_ROLE) {
        minNanoPrice = _min;
    }

    function setSellerSlashBps(uint16 _bps) external onlyRole(GOVERNANCE_ROLE) {
        require(_bps <= 10000, "BPS_TOO_HIGH");
        sellerSlashBps = _bps;
    }

    // ================= INTERNAL HELPERS =================
    function _requireEligibleSeller(address s) internal view {
        require(registry.isSeller(s), "NOT_SELLER");
        require(registry.availableStake(s) >= registry.minSellerStake(), "LOW_STAKE");
    }

    // ================= OPEN TASK (AUCTION) =================
    function createOpenTask(
        uint256 _amount, // Added: Explicit amount for nano-authorization
        uint64 jobDeadline,
        uint64 bidDeadline,
        uint64 verifierDeadline, 
        bytes32 taskHash,
        address[] calldata _verifiers,
        uint8 quorumM,
        bool isNano 
    ) external payable nonReentrant returns (uint256 taskId) {
        require(jobDeadline > block.timestamp, "BAD_JOB_DEADLINE");
        require(bidDeadline > block.timestamp, "BAD_BID_DEADLINE");
        require(bidDeadline < jobDeadline, "BID_AFTER_JOB");
        require(verifierDeadline > jobDeadline, "VERIFIER_BEFORE_JOB"); 
        require(_verifiers.length > 0, "NO_VERIFIERS");
        require(quorumM > 0 && quorumM <= _verifiers.length, "BAD_QUORUM");

        uint256 total = isNano ? _amount : msg.value;
        require(total >= _amount, "INSUFFICIENT_ESCROW");

        uint256 percentFee = (total * verifierFeeBps) / 10_000;
        uint256 basePool = percentFee > minVerifierFee ? percentFee : minVerifierFee;

        uint256 difficultyBps = (uint256(quorumM) * 10_000) / _verifiers.length;
        uint256 multiplierBps =
            10_000 + (uint256(difficultyAlphaBps) * difficultyBps) / 10_000;

        uint256 verifierPool = (basePool * multiplierBps) / 10_000;
        uint256 sellerBudget = total > verifierPool ? total - verifierPool : 0;

        // Option C: Fork the budget floor — nano tasks use a much lower minimum
        if (isNano) {
            require(sellerBudget >= minNanoPrice, "NANO_BUDGET_TOO_LOW");
        } else {
            require(sellerBudget >= minDerivedPrice, "BUDGET_TOO_LOW");
        }

        taskId = ++taskCounter;
        Task storage t = tasks[taskId];
        t.buyer = msg.sender;
        t.seller = address(0);
        t.price = 0;
        t.verifierPool = verifierPool;
        t.sellerBudget = sellerBudget;
        t.deadline = jobDeadline;
        t.bidDeadline = bidDeadline;
        t.verifierDeadline = verifierDeadline;
        t.taskHash = taskHash;
        t.state = State.CREATED;
        t.quorumM = quorumM;
        t.quorumN = uint8(_verifiers.length);
        t.isNano = isNano;

        for (uint256 i = 0; i < _verifiers.length; i++) {
            verifiers[taskId].push(_verifiers[i]);
            isVerifierForTask[taskId][_verifiers[i]] = true;
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
            t.approvalTimestamp = uint64(block.timestamp); // Point 3 tracking
            emit QuorumReached(taskId);
        }
    }

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
            t.approvalTimestamp = uint64(block.timestamp); // Cooling-off for rejections too
            emit TaskRejected(taskId);
        }
    }

    function verifierTimeoutRefund(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.state == State.SUBMITTED, "BAD_STATE");
        require(msg.sender == t.buyer, "NOT_BUYER");
        require(block.timestamp > t.verifierDeadline, "NOT_EXPIRED");

        _slashZombies(taskId); // REFINED: Point 2 - Slashing triggers on timeout (failure path)

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
        require(block.timestamp >= t.approvalTimestamp + 1 hours, "COOLING_OFF"); // REFINED: Point 3 cooling-off window

        t.state = State.FINALIZED;

        uint256 fee = (t.price * protocolFeeBps) / 10_000;
        uint256 sellerPayout = t.price - fee;
        uint256 treasuryShare = (fee * treasuryShareBps) / 10_000;
        uint256 finalizerShare = fee - treasuryShare;

        if (t.isNano) {
            emit NanoSettlementAuthorized(taskId, t.seller, sellerPayout);
            emit NanoSettlementAuthorized(taskId, treasury, treasuryShare);
            emit NanoSettlementAuthorized(taskId, msg.sender, finalizerShare);
        } else {
            (bool ok1,) = payable(t.seller).call{value: sellerPayout}("");
            require(ok1, "SELLER_PAY_FAIL");

            (bool ok2,) = payable(treasury).call{value: treasuryShare}("");
            require(ok2, "TREASURY_PAY_FAIL");

            (bool ok3,) = payable(msg.sender).call{value: finalizerShare}("");
            require(ok3, "FINALIZER_PAY_FAIL");
        }

        uint256 count = approvalCount[taskId];
        if (count > 0 && t.verifierPool > 0) {
            uint256 per = t.verifierPool / count;
            for (uint256 i = 0; i < approvers[taskId].length; i++) {
                if (t.isNano) {
                    emit NanoSettlementAuthorized(taskId, approvers[taskId][i], per);
                } else {
                    (bool okv,) = payable(approvers[taskId][i]).call{value: per}("");
                    require(okv, "VERIFIER_PAY_FAIL");
                }
            }
        }

        emit TaskFinalized(taskId);
    }

    // ================= DISPUTE =================
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
            
            // REFINED: Point 1 - 20% penalty with try/catch to prevent deadlock
            uint256 penalty = (price * sellerSlashBps) / 10000;
            try registry.slash(t.seller, penalty, t.buyer) {} catch {}

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

    function _slashZombies(uint256 taskId) internal {
        address[] memory taskVerifiers = verifiers[taskId];
        uint256 slashAmount = 1 ether; 

        for (uint256 i = 0; i < taskVerifiers.length; i++) {
            address v = taskVerifiers[i];
            if (!hasApproved[taskId][v] && !hasRejected[taskId][v]) {
                try registry.slash(v, slashAmount, treasury) {} catch {}
            }
        }
    }
}
