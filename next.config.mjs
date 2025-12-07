/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    generateOGImageRoutes: false, // Disable OG routes to prevent “use cache”
  },
};

export default nextConfig;
