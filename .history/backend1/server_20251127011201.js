// server.js (FINAL UPDATED VERSION)

// Express backend that proxies to ML service (ML_URL) or falls back to python ml/predict.py
// Includes:
// - Full CORS + Private Network Access support
// - OPTIONS preflight handler
// - Root route handler
// - Request-ID logging
// - fetchWithRetries
// - normalizeIncoming
// - python fallback
// - healthz / readyz

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { spawn } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const fetch = global.fetch;

const app = express();

// -----------------------------------------------------
// CORS base config
// -----------------------------------------------------
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

// Standard CORS
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "X-Requested-With",
      "Access-Control-Request-Private-Network"
    ],
  })
);

// Body parser
app.use(bodyParser.json({ limit: process.env.BODY_LIMIT || "200kb" }));

// -----------------------------------------------------
// NEW: Private Network Access + Preflight Middleware
// -----------------------------------------------------
app.use((req, res, next) => {
  const origin = req.get("Origin") || FRONTEND_URL;

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-ID, X-Requested-With, Access-Control-Request-Private-Network"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // If browser requests private-network permission
  if (req.headers["access-control-request-private-network"]) {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }

  // OPTIONS = browser preflight
  if (req.method === "OPTIONS") return res.status(204).end();

  next();
});

// -----------------------------------------------------
// Request-ID middleware
// -----------------------------------------------------
app.use((req, res, next) => {
  const inc = req.headers["x-request-id"];
  const id = inc || crypto.randomBytes(6).toString("hex");
  req._reqid = id;
  res.setHeader("X-Request-ID", id);
  next();
});

// -----------------------------------------------------
// Root handler to avoid 404
// -----------------------------------------------------
app.get("/", (req, res) => {
  return res.json({
    service: "heart-disease-backend",
    status: "running",
    frontend: process.env.FRONTEND_URL || null,
  });
});

// -----------------------------------------------------
// Health / Ready
// -----------------------------------------------------
app.get("/healthz", (req, res) => res.json({ status: "ok" }));

const ML_URL = process.env.ML_URL && process.env.ML_URL.replace(/\/$/, "");

app.get("/readyz", async (req, res) => {
  if (!ML_URL) return res.json({ ready: true, ml: false });

  try {
    const controller = new AbortController();
    const t = setTimeout(
      () => controller.abort(),
      parseInt(process.env.READY_TIMEOUT_MS || "1200")
    );

    const resp = await fetch(`${ML_URL}/readyz`, { signal: controller.signal });
    clearTimeout(t);

    if (!resp.ok)
      return res.status(503).json({
        ready: false,
        ml: false,
        status: resp.status,
      });

    return res.json({ ready: true, ml: true });
  } catch (e) {
    return res.status(503).json({ ready: false, ml: false, error: String(e) });
  }
});

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

// Retry fetch with backoff
async function fetchWithRetries(url, options = {}, retries = 2, backoffMs = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.FETCH_TIMEOUT_MS || "8000", 10);
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(t);

      const text = await resp.text().catch(() => "");
      const isJson = (resp.headers.get("content-type") || "").includes("application/json");
      const body = isJson ? JSON.parse(text || "{}") : text;

      if (!resp.ok) {
        const err = new Error("Non-200 from ML service");
        err.status = resp.status;
        err.body = body;
        throw err;
      }

      return body;
    } catch (err) {
      clearTimeout(t);

      if (attempt === retries) throw err;

      await new Promise((r) =>
        setTimeout(r, backoffMs * Math.pow(2, attempt))
      );
    }
  }
}

// Normalize input shapes
function normalizeIncoming(obj) {
  if (!obj) return null;

  if (obj.input !== undefined || obj.values !== undefined) return obj;

  if (Array.isArray(obj)) {
    if (obj.every((x) => typeof x === "object" && !Array.isArray(x)))
      return { input: obj };

    if (obj.every((x) => Array.isArray(x))) return { values: obj };

    return null;
  }

  if (typeof obj === "object") return { input: obj };

  return null;
}

// -----------------------------------------------------
// Python fallback
// -----------------------------------------------------
const PYTHON_CMD = process.env.PYTHON_CMD || "python3";
const PYTHON_SCRIPT = path.join(__dirname, "ml", "predict.py");
const PYTHON_TIMEOUT = parseInt(process.env.PYTHON_TIMEOUT_MS || "10000");

function runPythonPredict(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_CMD, [PYTHON_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let out = "";
    let err = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("python-timeout"));
    }, PYTHON_TIMEOUT);

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error("python-exit " + err));

      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error("invalid-json-from-python"));
      }
    });
  });
}

// -----------------------------------------------------
// /api/predict
// -----------------------------------------------------
app.post("/api/predict", async (req, res) => {
  const rid = req._reqid;

  const normalized = normalizeIncoming(req.body);
  if (!normalized)
    return res.status(422).json({
      error: "Expect 'input' object/list or 'values' list",
    });

  const payload = normalized;

  // Prefer ML_URL
  if (ML_URL) {
    try {
      console.log(`[${rid}] Proxying to ML_URL/predict`);
      const data = await fetchWithRetries(`${ML_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return res.json(data);
    } catch (err) {
      console.error(`[${rid}] ML proxy error`, err);
      return res.status(502).json({
        error: "ML service error",
        status: err.status || 502,
        details: err.body || String(err),
      });
    }
  }

  // fallback python
  try {
    const out = await runPythonPredict(payload);
    return res.json(out);
  } catch (e) {
    console.error(`[${rid}] Python fallback error`, e);
    return res.status(500).json({
      error: "Python predictor failed",
      details: String(e),
    });
  }
});

// -----------------------------------------------------
// Start
// -----------------------------------------------------
const port = parseInt(process.env.PORT, 10) || 5000;
const host = "0.0.0.0";

const server = app.listen(port, host, () => {
  console.log(`Backend running at http://${host}:${port}`);
  if (ML_URL) console.log("ML_URL =", ML_URL);
  else console.log("ML_URL not set → python fallback active");
});

// graceful shutdown
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("uncaughtException", (err) => console.error(err));
process.on("unhandledRejection", (r) => console.error(r));
