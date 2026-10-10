# Build from the repo root: the relayer reads ../deployments/10143.json.
#   docker build -f backend/Dockerfile .
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.33.1 --activate
WORKDIR /repo
COPY deployments ./deployments
COPY backend/package.json backend/pnpm-lock.yaml ./backend/
WORKDIR /repo/backend
RUN pnpm install --frozen-lockfile --prod=false
COPY backend ./
ENV NODE_ENV=production PORT=8787 RELAY_LEDGER_PATH=/data/relay-ledger.json
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
# Env comes from the container, not --env-file; a missing key fails loudly at start (config.ts).
CMD ["node_modules/.bin/tsx", "src/index.ts"]
