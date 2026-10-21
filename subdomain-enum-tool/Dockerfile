FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# ── Base packages ─────────────────────────────
RUN apt-get update && apt-get install -y \
    curl wget git jq whois dnsutils \
    python3 python3-pip \
    libpcap-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Go (needed for projectdiscovery tools) ────
RUN wget -q https://go.dev/dl/go1.22.3.linux-amd64.tar.gz -O /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz

ENV PATH="$PATH:/usr/local/go/bin:/root/go/bin"

# ── ProjectDiscovery tools ────────────────────
RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
RUN go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest
RUN go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
RUN go install -v github.com/OJ/gobuster/v3@latest

# ── Assetfinder ───────────────────────────────
RUN go install -v github.com/tomnomnom/assetfinder@latest

# ── Sublist3r ────────────────────────────────
RUN pip3 install sublist3r --quiet

# ── Copy scripts ─────────────────────────────
WORKDIR /scripts
COPY domain.sh infra_recon.sh ./
RUN chmod +x domain.sh infra_recon.sh

# Output directory
RUN mkdir -p /output

WORKDIR /output
