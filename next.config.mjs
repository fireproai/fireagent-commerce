/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: false,
  serverExternalPackages: ["pdfkit", "fontkit"],
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
