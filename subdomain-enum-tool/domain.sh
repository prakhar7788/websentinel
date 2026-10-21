#!/bin/bash
set -euo pipefail

# -----------------------------------------------
# Associated Domain Finder
# Discovers domains related to a target via:
#   - WHOIS registrant info
#   - Certificate Transparency logs (crt.sh JSON)
#   - Reverse IP (PTR records via dig)
# Usage: ./domain.sh <domain>
# -----------------------------------------------

usage() {
    echo "Usage: $0 <domain>"
    exit 1
}

[[ $# -lt 1 ]] && usage

TARGET="$1"
TMPFILE=$(mktemp /tmp/crt_domains.XXXXXX)
trap 'rm -f "$TMPFILE"' EXIT

# ── Resolve IP ────────────────────────────────
TARGET_IP=$(dig +short "$TARGET" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | tail -n1)

echo "Target : $TARGET"
echo "IP     : ${TARGET_IP:-unresolved}"
echo

# ── WHOIS ─────────────────────────────────────
echo "[*] WHOIS lookup..."
WHOIS_RAW=$(whois "$TARGET" 2>/dev/null)
WHOIS_EMAIL=$(echo "$WHOIS_RAW" | grep -Ei "Registrant Email|Admin Email|Tech Email" \
    | head -n1 | awk '{print $NF}')
WHOIS_ORG=$(echo "$WHOIS_RAW" | grep -Ei "Registrant Organization|Registrant Name|org-name" \
    | head -n1 | sed 's/.*: *//')

if [[ -n "$WHOIS_EMAIL" ]]; then
    echo "  Registrant email : $WHOIS_EMAIL"
    echo "  Reverse WHOIS    : https://viewdns.info/reversewhois/?q=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$WHOIS_EMAIL" 2>/dev/null || echo "$WHOIS_EMAIL")"
else
    echo "  Registrant email : not found (GDPR/privacy guard likely)"
fi
[[ -n "$WHOIS_ORG" ]] && echo "  Registrant org   : $WHOIS_ORG"
echo

# ── Certificate Transparency (crt.sh JSON) ────
echo "[*] Querying crt.sh certificate transparency logs..."
HTTP_CODE=$(curl -s -o "$TMPFILE" -w "%{http_code}" \
    --retry 3 --retry-delay 2 \
    "https://crt.sh/?q=%25.${TARGET}&output=json")

if [[ "$HTTP_CODE" != "200" ]]; then
    echo "  [!] crt.sh returned HTTP $HTTP_CODE — skipping."
else
    CERT_DOMAINS=$(jq -r '.[].name_value' "$TMPFILE" 2>/dev/null \
        | sed 's/\*\.//' \
        | tr ',' '\n' \
        | grep -v "^$" \
        | sort -u)

    COUNT=$(echo "$CERT_DOMAINS" | grep -c '.' || true)
    echo "  Found $COUNT unique entries"
    echo
    echo "── Certificate Transparency Domains ──────────────────"
    echo "$CERT_DOMAINS"
    echo "───────────────────────────────────────────────────────"
fi
echo

# ── Reverse IP (PTR) ──────────────────────────
if [[ -n "$TARGET_IP" ]]; then
    echo "[*] Reverse IP (PTR) lookup for $TARGET_IP..."
    PTR=$(dig +short -x "$TARGET_IP" 2>/dev/null | sed 's/\.$//')
    if [[ -n "$PTR" ]]; then
        echo "  PTR record : $PTR"
    else
        echo "  No PTR record found."
    fi
    echo "  ViewDNS reverse IP : https://viewdns.info/reverseip/?host=$TARGET_IP"
fi
echo

echo "[+] Done."
