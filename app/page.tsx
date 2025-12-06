import { Carousel } from 'components/carousel';
import { ThreeItemGrid } from 'components/grid/three-items';
import Footer from 'components/layout/footer';
import { getMenu } from 'lib/shopify';

export const metadata = {
  description:
    'High-performance ecommerce store built with Next.js, Vercel, and Shopify.',
  openGraph: {
    type: 'website'
  }
};

export default async function HomePage() {
  // Fetch footer menu
  const footerMenu = await getMenu('next-js-frontend-footer-menu');

  return (
    <>
      {await ThreeItemGrid()}
      {await Carousel()}
      <Footer menu={footerMenu} />
    </>
  );
}
