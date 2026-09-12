#!/usr/bin/env bash
# Pull, rebuild the image, restart the container. Run on the server:
#   sudo /opt/portfolio/deploy/deploy.sh
# First-time layout is in deploy/README.md.
set -euo pipefail

REPO=/opt/portfolio
cd "$REPO"
git pull --ff-only

cd sshfolio
test -f .ssh/id_ed25519 || { echo "no host key in $(pwd)/.ssh; refusing to start with a new one" >&2; exit 1; }
docker compose up -d --build
sleep 2
docker compose ps
