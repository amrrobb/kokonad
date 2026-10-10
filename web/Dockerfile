# Build from the repo root: the app imports ../deployments/10143.json.
#   docker build -f web/Dockerfile --build-arg NEXT_PUBLIC_RELAY_URL=... .
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.1 --activate
WORKDIR /repo
COPY deployments ./deployments
COPY web/package.json web/pnpm-lock.yaml ./web/
WORKDIR /repo/web
RUN pnpm install --frozen-lockfile
COPY web ./
# NEXT_PUBLIC_* are baked into the browser bundle at build time.
ARG NEXT_PUBLIC_RELAY_URL
ARG NEXT_PUBLIC_MONAD_RPC_URL
ARG NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID
ARG NEXT_PUBLIC_PASSKEY_RP_ID
ENV NEXT_PUBLIC_RELAY_URL=$NEXT_PUBLIC_RELAY_URL \
    NEXT_PUBLIC_MONAD_RPC_URL=$NEXT_PUBLIC_MONAD_RPC_URL \
    NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=$NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID \
    NEXT_PUBLIC_PASSKEY_RP_ID=$NEXT_PUBLIC_PASSKEY_RP_ID \
    NEXT_OUTPUT_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# outputFileTracingRoot is the repo root, so the standalone tree keeps the web/ prefix.
COPY --from=build /repo/web/.next/standalone ./
COPY --from=build /repo/web/.next/static ./web/.next/static
COPY --from=build /repo/web/public ./web/public
USER node
EXPOSE 3000
CMD ["node", "web/server.js"]
