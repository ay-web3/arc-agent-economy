import express from 'express';

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => {
    console.log(">> [PROBE] Health check received.");
    res.json({ 
        status: "PROBE_SUCCESS", 
        timestamp: new Date().toISOString(),
        node_version: process.version,
        port: PORT
    });
});

app.get('/', (req, res) => {
    res.send("<h1>ARC Economy Probe: ONLINE</h1>");
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [SUCCESS] Diagnostic Probe listening on 0.0.0.0:${PORT}`);
});
