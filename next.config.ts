import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Self-contained production build: emits .next/standalone with a minimal
  // server.js + only the traced node_modules, so the Docker runtime image needs
  // no `npm install` and stays small. (Dev/`next dev` is unaffected.)
  output: "standalone",
  // Dev StrictMode double-mounts every component, which tears down + recreates the
  // WebGL canvas on /build and shows a one-frame flash on reload (HMR is exempt, so
  // it only bit on full reloads). StrictMode is a dev-only aid and never runs in
  // production, so turning it off just makes dev match prod — and kills the flash.
  reactStrictMode: false,
  // Pin the workspace root to this project. Without it, Turbopack infers the
  // root from the nearest lockfile and picked up a stray ~/pnpm-lock.yaml, which
  // would scope module resolution / file-watching to the wrong directory.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default withNextIntl(nextConfig);
