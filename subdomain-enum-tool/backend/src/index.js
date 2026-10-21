const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 4000;
const TOOLS_CONTAINER = process.env.TOOLS_CONTAINER || "recon-tools";

// Wordlists are stored in the shared /wordlists volume
const WORDLIST_DIR = "/wordlists";
const OUTPUT_DIR = "/output";

// Ensure directories exist
[WORDLIST_DIR, OUTPUT_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Multer: wordlist upload ────────────────────────────────────
const storage = multer.diskStorage({
  destination: WORDLIST_DIR,
  filename: (_req, file, cb) => {
    const safeName = `${uuidv4()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    // Only accept plain text wordlists
    if (file.mimetype === "text/plain" || file.originalname.endsWith(".txt")) {
      cb(null, true);
    } else {
      cb(new Error("Only .txt wordlist files are accepted"));
    }
  },
});

app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ── Upload wordlist ───────────────────────────────────────────
app.post("/api/wordlist", upload.single("wordlist"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    path: `/wordlists/${req.file.filename}`,
  });
});

// ── List uploaded wordlists ───────────────────────────────────
app.get("/api/wordlists", (_req, res) => {
  try {
    const files = fs.readdirSync(WORDLIST_DIR).map((f) => {
      const stat = fs.statSync(path.join(WORDLIST_DIR, f));
      return { filename: f, size: stat.size, uploadedAt: stat.mtime };
    });
    res.json(files);
  } catch {
    res.json([]);
  }
});

// ── Delete a wordlist ─────────────────────────────────────────
app.delete("/api/wordlist/:filename", (req, res) => {
  const filename = path.basename(req.params.filename); // prevent traversal
  const filepath = path.join(WORDLIST_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Not found" });
  fs.unlinkSync(filepath);
  res.json({ deleted: filename });
});

// ── Validate domain ───────────────────────────────────────────
function isValidDomain(domain) {
  return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain);
}

// ── SSE scan endpoint ─────────────────────────────────────────
// GET /api/scan?domain=example.com&wordlist=<filename>&mode=full|domain
app.get("/api/scan", (req, res) => {
  const { domain, wordlist, mode = "full" } = req.query;

  if (!domain || !isValidDomain(domain)) {
    res.status(400).json({ error: "Invalid or missing domain" });
    return;
  }

  // Set up Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  const script = mode === "domain" ? "/scripts/domain.sh" : "/scripts/infra_recon.sh";

  // Build the docker exec command args
  const execArgs = ["exec", TOOLS_CONTAINER, "bash", script, domain];

  // If a wordlist was provided and mode is full, pass the container path
  if (mode === "full" && wordlist) {
    const safeFilename = path.basename(wordlist); // prevent traversal
    const containerWordlistPath = `/wordlists/${safeFilename}`;
    execArgs.push(containerWordlistPath);
  }

  send("info", `Starting scan on ${domain} (mode: ${mode})`);
  if (wordlist && mode === "full") {
    send("info", `Using wordlist: ${path.basename(wordlist)}`);
  }

  const proc = spawn("docker", execArgs, { stdio: ["ignore", "pipe", "pipe"] });

  proc.stdout.on("data", (chunk) => {
    chunk.toString().split("\n").forEach((line) => {
      if (line.trim()) send("output", line);
    });
  });

  proc.stderr.on("data", (chunk) => {
    chunk.toString().split("\n").forEach((line) => {
      if (line.trim()) send("stderr", line);
    });
  });

  proc.on("close", (code) => {
    send("done", { exitCode: code });
    res.end();
  });

  proc.on("error", (err) => {
    send("error", `Failed to start process: ${err.message}`);
    res.end();
  });

  // If client disconnects, kill the process
  req.on("close", () => {
    if (!proc.killed) proc.kill("SIGTERM");
  });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Recon backend listening on port ${PORT}`);
});
