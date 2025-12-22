/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
    ],
  },
};

export default nextConfig;
