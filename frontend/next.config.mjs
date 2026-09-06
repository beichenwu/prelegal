/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ship the site as static files so FastAPI can serve them directly (no Node server).
  output: "export",
  // Emit `route/index.html` instead of `route.html` so a static file server with
  // `html=True` resolves clean URLs like `/tools/mutual-nda/` without extra config.
  trailingSlash: true,
  images: { unoptimized: true },
  // Import `.md` templates as raw strings (used to assemble legal documents).
  webpack(config) {
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
