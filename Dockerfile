# Self-hosted preview/prod image: static SPA (dist/) + api/ handlers served
# by server/index.ts. Built for linux/arm64 (OCI Ampere host).
#
# npm ci must run with the full workspace present (copying only package.json
# files trips workspace resolution on this monorepo), so we COPY . before it.
#
# Build-time env: VITE_* vars are baked into the SPA bundle. Non-sensitive
# ones arrive as --build-arg; the rest are read from a BuildKit secret
# (--secret id=envfile,src=<env file>) so they never persist in a layer.
FROM node:20-slim AS build
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts --no-audit --no-fund
RUN npm run build:shared

ARG VITE_API_URL=""
ARG VITE_PUBLIC_WEB_ORIGIN
ARG VITE_SENTRY_ENVIRONMENT="preview"
ARG VITE_APP_VERSION="preview"
RUN --mount=type=secret,id=envfile \
    set -a && . /run/secrets/envfile && set +a && \
    VITE_API_URL="$VITE_API_URL" \
    VITE_PUBLIC_WEB_ORIGIN="$VITE_PUBLIC_WEB_ORIGIN" \
    VITE_SENTRY_ENVIRONMENT="$VITE_SENTRY_ENVIRONMENT" \
    VITE_APP_VERSION="$VITE_APP_VERSION" \
    npm run build

RUN npx esbuild server/index.ts --bundle --platform=node --target=node20 \
    --format=esm --packages=external --outfile=dist-server/index.mjs

# Prune to production deps (full source present, so npm ci resolves cleanly).
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

EXPOSE 3000
CMD ["node", "dist-server/index.mjs"]
