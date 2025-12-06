import { baseUrl } from 'lib/utils';

// Simple static sitemap – fully compatible with Next.js 15
export default function sitemap() {
  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date()
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date()
    }
  ];
}
