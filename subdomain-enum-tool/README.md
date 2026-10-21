# SubRecon — Subdomain Enumeration Web App

A web interface for your passive + active subdomain enumeration bash scripts.
Enter a domain, optionally upload a wordlist, hit **Start Scan**, and watch the
output stream in real time.

---

## Architecture

```
Browser (React)
    │  HTTP / SSE
    ▼
Node.js / Express  (port 4000)
    │  docker exec
    ▼
Ubuntu container   (recon-tools)
    │  runs
    ├─ domain.sh
    └─ infra_recon.sh
         ├─ subfinder · assetfinder · sublist3r
         ├─ dnsx · gobuster
         └─ httpx
```

---

## Requirements

| Requirement | Notes |
|-------------|-------|
| Docker ≥ 24 | [Install Docker](https://docs.docker.com/get-docker/) |
| Docker Compose v2 | Bundled with Docker Desktop |

That's it. All recon tools are built inside the Docker image.

---

## Quick Start

```bash
# 1. Clone / navigate to the project
cd subdomain-enum-tool

# 2. Build and start everything
docker compose up --build

# 3. Open the UI
#    http://localhost:3000
```

First build takes ~5–10 minutes (downloads Go, compiles tools).
Subsequent starts are instant.

---

## Usage

1. **Target Domain** — enter a bare domain like `example.com`
2. **Scan Mode**
   - *Full Recon* — runs `infra_recon.sh` (all tools, best coverage)
   - *Domain Finder* — runs `domain.sh` (WHOIS + crt.sh + PTR, fast)
3. **Wordlist** *(optional)* — click **Upload Wordlist** and pick a `.txt`
   file (one subdomain prefix per line).  
   Without a wordlist the gobuster / dnsx brute-force steps are skipped.
4. Click **Start Scan** — output streams live in the terminal panel.
5. Discovered subdomains appear in the **Subdomains** panel.
   - **⎘** copies them all to your clipboard
   - **↓** downloads them as a `.txt` file
   - A filter box appears once more than 4 subdomains are found

---

## Stopping

```bash
docker compose down
```

To also remove the stored output / wordlist volumes:

```bash
docker compose down -v
```

---

## Project Structure

```
subdomain-enum-tool/
├── domain.sh              # Associated domain finder script
├── infra_recon.sh         # Full recon pipeline script
├── Dockerfile             # Tool image (Ubuntu + all recon tools)
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── index.js       # Express API + SSE stream
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── App.js
        ├── components/
        │   ├── ScanForm.js      # Domain input + wordlist upload
        │   ├── Terminal.js      # Live streaming output
        │   └── ResultsPanel.js  # Deduplicated subdomain list
        └── ...
```

---

## Notes

- The backend mounts the Docker socket (`/var/run/docker.sock`) so it can
  `docker exec` into the `recon-tools` container — no nested Docker needed.
- Uploaded wordlists are stored in a named Docker volume (`wordlists`) and
  shared with the tool container.
- Scan output is streamed via **Server-Sent Events (SSE)** so the terminal
  updates in real time without polling.
- Subdomains found during the scan are also linkable in the results panel
  (opens `https://<subdomain>` in a new tab).
