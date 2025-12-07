/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    generateOGImageRoutes: false, // stop Next from generating `use cache` routes
  },
};

export default nextConfig;
