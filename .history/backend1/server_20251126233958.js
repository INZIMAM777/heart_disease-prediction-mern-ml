// backend1/server.js
// Improved backend: prefers HTTP ML service (ML_URL). Falls back to spawning python script if ML_URL is not set.
// Fixes: listens on process.env.PORT & 0.0.0.0, robust timeouts, better error handling.
// Change: when proxying to ML service wrap body as { input: ... } unless already shaped.

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');

// Node 18+ has global fetch & AbortController
// If running older Node where fetch is not available, install node-fetch and require it.

const app = express();

// Configure CORS - allow FRONTEND_URL if set, otherwise allow all (change in production)
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Basic limits to prevent huge bodies from causing issues on free instances
app.use(bodyParser.json({ limit: '100kb' }));

// Health endpoint for Render
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// Helper: safe JSON parser
function safeParseJson(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

// Preferred path: call external ML service over HTTP if ML_URL is provided
const ML_URL = process.env.ML_URL && process.env.ML_URL.replace(/\/$/, ''); // strip trailing slash

// Timeout helpers
const DEFAULT_FETCH_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT_MS, 10) || 8000; // ms
const PYTHON_TIMEOUT = parseInt(process.env.PYTHON_TIMEOUT_MS, 10) || 10000; // ms

app.post('/api/predict', async (req, res) => {
  const incoming = req.body || {};

  // Basic validation
  if (typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Invalid input: expected JSON object' });
  }

  // If ML_URL present -> HTTP proxying
  if (ML_URL) {
    try {
      // Determine payload shape expected by ML service:
      // If frontend already sent { input: {...} } or { values: [...] }, forward as-is.
      // Otherwise wrap under "input".
      let payload;
      if (incoming && (incoming.input !== undefined || incoming.values !== undefined)) {
        payload = incoming;
      } else {
        payload = { input: incoming };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT);

      console.log('Proxying to ML_URL:', ML_URL, 'payloadKeys:', Object.keys(payload).slice(0,10));

      const resp = await fetch(`${ML_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '<no body>');
        console.error('ML service returned non-200:', resp.status, text);
        return res.status(502).json({ error: 'ML service error', status: resp.status, details: text });
      }

      const data = await resp.json().catch(() => null);
      if (!data) {
        const raw = await resp.text().catch(() => '');
        console.error('Invalid JSON from ML service, raw:', raw);
        return res.status(502).json({ error: 'Invalid JSON from ML service', raw });
      }

      // Success: forward ML response to client
      return res.json(data);
    } catch (err) {
      const isAbort = err.name === 'AbortError';
      console.error('Error calling ML service:', isAbort ? 'timeout' : err);
      return res.status(504).json({ error: 'ML service timeout or unreachable', details: String(err) });
    }
  }

  // Fallback: spawn a Python process to run ml/predict.py
  const scriptPath = path.join(__dirname, '..', 'ml', 'predict.py');

  const runPython = () => new Promise((resolve, reject) => {
    const pythonCmd = process.env.PYTHON_CMD || 'python3';

    const child = spawn(pythonCmd, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        child.kill('SIGKILL');
        reject(new Error('python-timeout'));
      }
    }, PYTHON_TIMEOUT);

    // For Python fallback, write incoming JSON (wrapped similarly)
    const payload = (incoming && (incoming.input !== undefined || incoming.values !== undefined))
      ? incoming
      : { input: incoming };

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('error', (err) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`python-exit-${code}: ${stderr}`));
        return resolve({ stdout, stderr });
      }
    });
  });

  try {
    const { stdout, stderr } = await runPython();
    if (stderr) console.error('Python stderr:', stderr.substring(0, 2000));
    const parsed = safeParseJson(stdout);
    if (!parsed) {
      console.error('Invalid JSON from python stdout:', stdout.substring(0, 2000));
      return res.status(500).json({ error: 'Invalid JSON from Python', raw: stdout });
    }
    return res.json(parsed);
  } catch (err) {
    console.error('Python run failed:', err);
    return res.status(500).json({ error: 'Python predictor failed', details: String(err) });
  }
});

// Listen on Render's assigned port and on 0.0.0.0 so Render can route traffic
const port = parseInt(process.env.PORT, 10) || 5000;
const host = '0.0.0.0';
app.listen(port, host, () => {
  console.log(`Backend running at http://${host}:${port}`);
  if (ML_URL) console.log('ML_URL set, using HTTP ML service at', ML_URL);
  else console.log('No ML_URL set, falling back to spawning python at ml/predict.py');
});
