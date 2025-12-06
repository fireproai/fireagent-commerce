import { getCollections, getProducts } from 'lib/shopify';

export const dynamic = 'force-static';

// Change this if needed
const domain = process.env.NEXT_PUBLIC_SITE_URL || 'https://fireagent.ai';

export default async function sitemap() {
  const urls: string[] = [];

  // Static pages
  urls.push(`${domain}/`);
  urls.push(`${domain}/search`);

  // Collections
  try {
    const collections = await getCollections();
    collections.forEach((c: any) => {
      urls.push(`${domain}/search/${c.handle}`);
    });
  } catch (e) {
    console.warn('Sitemap: Unable to load collections');
  }

  // Products
try {
  const products = await getProducts({});  // ← FIXED
  products.forEach((p: any) => {
    urls.push(`${domain}/product/${p.handle}`);
  });
} catch (e) {
  console.warn('Sitemap: Unable to load products');
}

  return urls.map((url) => ({
    url,
    lastModified: new Date()
  }));
}
