import { baseUrl } from 'lib/utils';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/'
      }
    ],
    sitemap: [`${baseUrl}/sitemap.xml`],
    host: baseUrl
  };
}
