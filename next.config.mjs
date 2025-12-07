/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    dynamicIO: false,  // or remove entirely
    // generateOGImageRoutes: false // You can now add this back if needed
  },
};

export default nextConfig;
