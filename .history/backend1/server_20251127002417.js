// server.js (updated)
// Express backend that proxies to ML service (ML_URL) or falls back to spawning python ml/predict.py
// Improvements included:
// - Root route to avoid 404
// - fetchWithRetries helper with timeout + backoff
// - normalizeIncoming to accept {input}, {values}, raw map, or array of maps
// - /api/predict proxies to ML_URL/predict with consistent wrapping
// - /healthz and /readyz endpoints
// - graceful shutdown and request-id logging

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || '*';
app.use(cors({ origin: FRONTEND_URL, methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Request-ID'] }));
app.use(bodyParser.json({ limit: process.env.BODY_LIMIT || '200kb' }));

// Simple request-id middleware
app.use((req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const id = incomingId || crypto.randomBytes(6).toString('hex');
  req._reqid = id;
  res.setHeader('X-Request-ID', id);
  next();
});

// Root route to avoid 404s from simple GET /
app.get('/', (req, res) => {
  if (process.env.FRONTEND_URL) return res.redirect(process.env.FRONTEND_URL);
  res.json({ service: 'heart-disease-backend', version: '1.0', status: 'ok' });
});

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// readyz checks ML_URL quickly (if set)
const ML_URL = process.env.ML_URL && process.env.ML_URL.replace(/\/$/, '');

app.get('/readyz', async (req, res) => {
  if (!ML_URL) return res.json({ ready: true, note: 'no-ML_URL' });
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), parseInt(process.env.READY_TIMEOUT_MS || '1200', 10));
    const resp = await fetch(`${ML_URL}/readyz`, { signal: controller.signal });
    clearTimeout(t);
    if (!resp.ok) return res.status(503).json({ ready: false, ml: false, status: resp.status });
    return res.json({ ready: true, ml: true });
  } catch (err) {
    return res.status(503).json({ ready: false, ml: false, error: String(err) });
  }
});

// Helper: retrying fetch with timeout and backoff
async function fetchWithRetries(url, options = {}, retries = 2, backoffMs = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.FETCH_TIMEOUT_MS || '8000', 10);
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(t);
      const text = await resp.text().catch(() => '');
      const contentType = resp.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? (text ? JSON.parse(text) : {}) : text;
      if (!resp.ok) {
        const err = new Error('ML service returned non-200');
        err.status = resp.status;
        err.body = body;
        throw err;
      }
      return body;
    } catch (err) {
      clearTimeout(t);
      // last attempt -> rethrow
      if (attempt === retries) throw err;
      // backoff before retry
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
    }
  }
}

// Normalize incoming request shapes to a canonical object
// Accepts: { input: {...} } or { input: [{...},{...}] } or { values: [...] } or raw named map or array of maps
function normalizeIncoming(obj) {
  if (!obj) return null;
  if (typeof obj === 'object' && (obj.input !== undefined || obj.values !== undefined)) return obj;
  if (Array.isArray(obj)) {
    // array of maps -> input list
    if (obj.every((x) => x && typeof x === 'object' && !Array.isArray(x))) return { input: obj };
    // array-of-arrays -> values
    if (obj.every((x) => Array.isArray(x))) return { values: obj };
    return null;
  }
  if (typeof obj === 'object') return { input: obj };
  return null;
}

// Fallback: spawn python ml/predict.py which reads JSON from stdin and writes JSON to stdout
const PYTHON_CMD = process.env.PYTHON_CMD || 'python3';
const PYTHON_SCRIPT = path.join(__dirname, 'ml', 'predict.py');
const PYTHON_TIMEOUT = parseInt(process.env.PYTHON_TIMEOUT_MS || '10000', 10);

function runPythonPredict(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_CMD, [PYTHON_SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
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

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

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
        if (code !== 0) return reject(new Error(`python-exit-${code}: ${stderr.substr(0,2000)}`));
        try {
          const parsed = JSON.parse(stdout);
          return resolve(parsed);
        } catch (err) {
          return reject(new Error('invalid-json-from-python'));
        }
      }
    });
  });
}

// Main prediction endpoint
app.post('/api/predict', async (req, res) => {
  const rid = req._reqid;
  const incoming = req.body || {};
  const normalized = normalizeIncoming(incoming);
  if (!normalized) return res.status(422).json({ error: "Invalid request body. Expect 'input' map/list or 'values' list" });

  // If ML_URL present, proxy over HTTP. Otherwise spawn python.
  if (ML_URL) {
    // if incoming already has input/values -> forward as-is, otherwise wrap under input
    const payload = (normalized && (normalized.input !== undefined || normalized.values !== undefined)) ? normalized : { input: normalized };
    try {
      console.log(`[${rid}] Proxying to ML_URL ${ML_URL}/predict payloadKeys=${Object.keys(payload).slice(0,10)}`);
      const data = await fetchWithRetries(`${ML_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, /*retries=*/2, /*backoffMs=*/parseInt(process.env.FETCH_BACKOFF_MS || '400', 10));

      console.log(`[${rid}] ML response success`);
      return res.json(data);
    } catch (err) {
      console.error(`[${rid}] ML proxy error:`, err);
      const status = err.status || 502;
      return res.status(502).json({ error: 'ML service error', status, details: err.body || String(err) });
    }
  }

  // Fallback to python
  const payload = normalized;
  try {
    const out = await runPythonPredict(payload);
    return res.json(out);
  } catch (err) {
    console.error(`[${rid}] Python predict error:`, err);
    return res.status(500).json({ error: 'Python predictor failed', details: String(err) });
  }
});

// Start the server and handle graceful shutdown
const port = parseInt(process.env.PORT, 10) || 5000;
const host = '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Backend running at http://${host}:${port}`);
  if (ML_URL) console.log('ML_URL set, using HTTP ML service at', ML_URL);
  else console.log('No ML_URL set, falling back to spawning python at ml/predict.py');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err.stack || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection', reason);
});
