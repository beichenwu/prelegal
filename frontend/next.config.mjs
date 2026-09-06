/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ship the site as static files so FastAPI can serve them directly (no Node server).
  output: "export",
  // Emit `route/index.html` instead of `route.html` so a static file server with
  // `html=True` resolves clean URLs like `/tools/mutual-nda/` without extra config.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
