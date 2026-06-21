# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js 16 (App Router) site, output: "standalone".
# Final image runs the traced server.js as a non-root user — no npm install at
# runtime, no dev deps shipped.

# ---- deps: install production+build deps against the committed lockfile -------
FROM node:22-alpine AS deps
# libc6-compat: some transitive native bindings expect glibc symbols on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the app into .next/standalone ----------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- run: minimal runtime with only the standalone server --------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Run as the unprivileged `node` user that ships with the base image.
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
