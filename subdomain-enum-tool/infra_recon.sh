#!/bin/bash
set -euo pipefail

# -----------------------------------------------
# Infrastructure Recon Script
# Passive + active subdomain enumeration pipeline
#
# Usage:
#   ./infra_recon.sh <domain> [/path/to/wordlist.txt]
#
# Optional tools (skipped if not installed):
#   subfinder, sublist3r, assetfinder,
#   gobuster, dnsx, httpx
# -----------------------------------------------

usage() {
    echo "Usage: $0 <domain> [/path/to/wordlist.txt]"
    exit 1
}

[[ $# -lt 1 ]] && usage

TARGET="$1"
WORDLIST="${2:-}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="infra_recon_${TARGET}_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

RESULT_FILE="$OUTPUT_DIR/result.txt"
UNIQUE_FILE="$OUTPUT_DIR/unique_subdomains.txt"

# Cleanup output dir on unexpected exit
trap 'echo "[!] Script interrupted." >&2' INT TERM

log()    { echo "[*] $*"; }
ok()     { echo "[+] $*"; }
warn()   { echo "[!] $*" >&2; }
section(){ echo -e "\n[$1]" >> "$RESULT_FILE"; }

# ── Init report ───────────────────────────────
ok "Starting recon on: $TARGET"
ok "Output directory : $OUTPUT_DIR"
{
    echo "Infrastructure Recon Report — $TARGET"
    echo "Generated : $(date)"
    echo "========================================"
} > "$RESULT_FILE"

# ── Step 1: Resolve IP ────────────────────────
log "Resolving IP address..."
IP=$(dig +short "$TARGET" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | tail -n1 || true)
section "IP Address"
if [[ -z "$IP" ]]; then
    warn "Could not resolve IP for $TARGET"
    echo "Unresolved" >> "$RESULT_FILE"
else
    echo "$IP" >> "$RESULT_FILE"
    ok "Resolved: $IP"
fi

# ── Step 2: Reverse IP via PTR (dnsx) ─────────
# Uses dnsx -ptr for reliable reverse IP lookups instead of scraping ViewDNS HTML.
if [[ -n "$IP" ]]; then
    if command -v dnsx &>/dev/null; then
        log "Reverse IP lookup via PTR (dnsx)..."
        echo "$IP" | dnsx -ptr -silent -resp-only -o "$OUTPUT_DIR/reverseip.txt" 2>/dev/null || true
        section "Reverse IP (PTR)"
        cat "$OUTPUT_DIR/reverseip.txt" >> "$RESULT_FILE"
    else
        log "dnsx not found — skipping PTR lookup. (Manual: https://viewdns.info/reverseip/?host=$IP)"
    fi
fi

# ── Step 3: crt.sh (JSON API) ─────────────────
log "Querying crt.sh certificate transparency logs..."
CRT_TMP=$(mktemp)
HTTP_CODE=$(curl -s -o "$CRT_TMP" -w "%{http_code}" \
    --retry 3 --retry-delay 2 \
    "https://crt.sh/?q=%25.${TARGET}&output=json")

if [[ "$HTTP_CODE" == "200" ]]; then
    jq -r '.[].name_value' "$CRT_TMP" 2>/dev/null \
        | sed 's/\*\.//' \
        | tr ',' '\n' \
        | grep -E "\.${TARGET}$" \
        | sort -u > "$OUTPUT_DIR/crtsh.txt"
    rm -f "$CRT_TMP"
    COUNT=$(wc -l < "$OUTPUT_DIR/crtsh.txt")
    ok "crt.sh: $COUNT entries"
    section "crt.sh Subdomains"
    cat "$OUTPUT_DIR/crtsh.txt" >> "$RESULT_FILE"
else
    warn "crt.sh returned HTTP $HTTP_CODE — skipping."
    rm -f "$CRT_TMP"
fi

# ── Step 4: Subfinder ─────────────────────────
if command -v subfinder &>/dev/null; then
    log "Running subfinder..."
    subfinder -d "$TARGET" -silent -o "$OUTPUT_DIR/subfinder.txt" 2>/dev/null
    section "Subfinder"
    cat "$OUTPUT_DIR/subfinder.txt" >> "$RESULT_FILE"
    ok "subfinder: $(wc -l < "$OUTPUT_DIR/subfinder.txt") entries"
else
    warn "subfinder not installed — skipping."
fi

# ── Step 5: Sublist3r ─────────────────────────
if command -v sublist3r &>/dev/null; then
    log "Running sublist3r..."
    # -v off and stderr suppressed to avoid banner/noise polluting results
    sublist3r -d "$TARGET" -o "$OUTPUT_DIR/sublist3r.txt" -v False 2>/dev/null || true
    section "Sublist3r"
    cat "$OUTPUT_DIR/sublist3r.txt" >> "$RESULT_FILE"
    ok "sublist3r: $(wc -l < "$OUTPUT_DIR/sublist3r.txt") entries"
else
    warn "sublist3r not installed — skipping."
fi

# ── Step 6: Assetfinder ───────────────────────
if command -v assetfinder &>/dev/null; then
    log "Running assetfinder..."
    assetfinder --subs-only "$TARGET" > "$OUTPUT_DIR/assetfinder.txt" 2>/dev/null
    section "Assetfinder"
    cat "$OUTPUT_DIR/assetfinder.txt" >> "$RESULT_FILE"
    ok "assetfinder: $(wc -l < "$OUTPUT_DIR/assetfinder.txt") entries"
else
    warn "assetfinder not installed — skipping."
fi

# ── Step 7: Gobuster DNS brute force ──────────
if command -v gobuster &>/dev/null && [[ -n "$WORDLIST" ]]; then
    log "Running gobuster DNS brute force..."
    gobuster dns -d "$TARGET" -w "$WORDLIST" --wildcard \
        -o "$OUTPUT_DIR/gobuster.txt" 2>/dev/null || true
    section "Gobuster"
    cat "$OUTPUT_DIR/gobuster.txt" >> "$RESULT_FILE"
    ok "gobuster: $(wc -l < "$OUTPUT_DIR/gobuster.txt") entries"
elif [[ -z "$WORDLIST" ]]; then
    warn "No wordlist provided — skipping gobuster/dnsx brute force."
fi

# ── Step 8: dnsx brute force ──────────────────
if command -v dnsx &>/dev/null && [[ -n "$WORDLIST" ]]; then
    log "Brute-forcing with dnsx..."
    # Prepend each word to the target to form valid subdomains
    sed "s/$/.$TARGET/" "$WORDLIST" \
        | dnsx -silent -o "$OUTPUT_DIR/dnsx_brute.txt" 2>/dev/null || true
    section "DNSX Brute Force"
    cat "$OUTPUT_DIR/dnsx_brute.txt" >> "$RESULT_FILE"
    ok "dnsx brute: $(wc -l < "$OUTPUT_DIR/dnsx_brute.txt") entries"
fi

# ── Step 9: Aggregate & deduplicate ───────────
log "Aggregating and deduplicating all subdomains..."
# Only glob the known tool output files — avoids pulling in report/HTML files
for f in crtsh subfinder sublist3r assetfinder gobuster dnsx_brute reverseip; do
    [[ -f "$OUTPUT_DIR/${f}.txt" ]] && cat "$OUTPUT_DIR/${f}.txt"
done \
    | grep -Eo "([a-zA-Z0-9._-]+\.${TARGET})" \
    | sort -u > "$UNIQUE_FILE"

TOTAL=$(wc -l < "$UNIQUE_FILE")
section "Unique Subdomains ($TOTAL total)"
cat "$UNIQUE_FILE" >> "$RESULT_FILE"
ok "Total unique subdomains: $TOTAL"

# ── Step 10: Live host probing (httpx) ────────
if command -v httpx &>/dev/null && [[ "$TOTAL" -gt 0 ]]; then
    log "Probing for live subdomains with httpx..."
    httpx -l "$UNIQUE_FILE" -silent -title -status-code \
        -o "$OUTPUT_DIR/live_subdomains.txt" 2>/dev/null || true
    LIVE=$(wc -l < "$OUTPUT_DIR/live_subdomains.txt")
    section "Live Subdomains ($LIVE)"
    cat "$OUTPUT_DIR/live_subdomains.txt" >> "$RESULT_FILE"
    ok "Live subdomains: $LIVE"
else
    [[ "$TOTAL" -eq 0 ]] && warn "No subdomains found — skipping httpx."
    command -v httpx &>/dev/null || warn "httpx not installed — skipping live check."
fi

# ── Summary ───────────────────────────────────
echo
echo "════════════════════════════════════════"
ok "Recon complete."
echo "  Full report    : $RESULT_FILE"
echo "  Unique subs    : $UNIQUE_FILE ($TOTAL)"
[[ -f "$OUTPUT_DIR/live_subdomains.txt" ]] && \
    echo "  Live hosts     : $OUTPUT_DIR/live_subdomains.txt ($LIVE)"
echo "════════════════════════════════════════"
