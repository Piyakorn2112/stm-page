import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
