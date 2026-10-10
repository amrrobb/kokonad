#!/usr/bin/env bash
# Ship the working tree to the VPS and rebuild both containers there.
# Secrets are NOT copied by this script: /opt/kokonad/.env.relayer and .env.web are placed once by hand.
set -euo pipefail
HOST=${KOKONAD_HOST:-root@77.237.243.126}
KEY=${KOKONAD_SSH_KEY:-$HOME/.ssh/id_ed25519}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SSH="ssh -i $KEY $HOST"

$SSH 'mkdir -p /opt/kokonad/src /opt/kokonad/data && chown 1000:1000 /opt/kokonad/data && test -f /opt/kokonad/.env.relayer && test -f /opt/kokonad/.env.web' \
  || { echo "put /opt/kokonad/.env.relayer and /opt/kokonad/.env.web on the host first"; exit 1; }

# rsync filters are first-match: the excludes must come before the broad includes.
rsync -az --delete --delete-excluded -e "ssh -i $KEY" \
  --exclude='node_modules' --exclude='.next' --exclude='.next-e2e' --exclude='.e2e' --exclude='test-results*' --exclude='playwright-report' --exclude='*.tsbuildinfo' \
  --exclude='.env' --exclude='.env.local' --exclude='.env.production' --exclude='.env.development' --exclude='.data' \
  --include='/deployments/***' --include='/web/***' --include='/backend/***' --exclude='*' \
  "$ROOT/" "$HOST:/opt/kokonad/src/"
scp -q -i "$KEY" "$ROOT/deploy/docker-compose.yml" "$HOST:/opt/kokonad/docker-compose.yml"

# .env.web feeds the build arguments; the relayer reads .env.relayer at run time.
# The build runs detached on the host (it outlives a dropped laptop connection); this waits on its log.
$SSH 'cd /opt/kokonad && nohup sh -c "set -a && . ./.env.web && set +a && docker compose build --pull && docker compose up -d --remove-orphans && docker compose ps; echo BUILD_EXIT=\$?" > build.log 2>&1 &'
$SSH 'until grep -q BUILD_EXIT /opt/kokonad/build.log; do sleep 5; done; grep -v "^#\|^ =>" /opt/kokonad/build.log | tail -30'
