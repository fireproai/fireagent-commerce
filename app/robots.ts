import { baseUrl } from 'lib/utils';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/search']
      }
    ],
    sitemap: [`${baseUrl}/sitemap.xml`],
    host: baseUrl
  };
}
