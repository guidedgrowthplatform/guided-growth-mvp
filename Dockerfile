# Guided Growth engine — runs the Vercel-style api/** handlers as one Node
# server (server.ts) plus the built SPA. Targets Azure Container Apps.
#
# Built via `az acr build` (amd64 in Azure's cloud), so no local cross-arch.
FROM node:20-slim

WORKDIR /app

# tini for correct signal handling / zombie reaping under ACA.
RUN apt-get update && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

# Disable husky git hooks during install (no .git in the image), keep other
# lifecycle scripts (postinstall builds @gg/shared, native binaries fetch).
ENV HUSKY=0

# Full source is copied BEFORE npm ci because the app's postinstall runs
# `tsc -b packages/shared`, which needs the shared workspace source present.
# (.dockerignore keeps node_modules, .git, ios/android, dist and .env* out.)
COPY . .
RUN npm ci

# @gg/shared dist (idempotent; postinstall already ran it — kept explicit).
RUN npm run build:shared

# --- SPA build ---
# VITE_* are baked into the client bundle at build time. The anon key + URLs
# are public-safe (RLS enforces access). Passed as build args; SKIP_SPA=1 skips
# the SPA to get an API-only image for a fast streaming smoke.
ARG SKIP_SPA=0
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PUBLIC_WEB_ORIGIN
ARG VITE_VAPI_PUBLIC_KEY
ARG VITE_VAPI_ASSISTANT_ID
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ARG VITE_SENTRY_DSN
ARG VITE_QA_PASSWORD
ARG VITE_QA_SCREEN_ENABLED
ARG VERCEL_ENV=production
RUN if [ "$SKIP_SPA" != "1" ]; then npm run build; else echo "skipping SPA build"; fi

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npx", "tsx", "server.ts"]
