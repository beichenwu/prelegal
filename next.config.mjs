/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ship the site as static files so it can be hosted anywhere (no Node server).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
