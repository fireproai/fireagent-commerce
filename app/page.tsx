import { Carousel } from 'components/carousel';
import { ThreeItemGrid } from 'components/grid/three-items';
import Footer from 'components/layout/footer';
import { getMenu } from 'lib/shopify';

export default async function HomePage() {
  const footerMenu = await getMenu('next-js-frontend-footer-menu');

  return (
    <>
      {await ThreeItemGrid()}
      {await Carousel()}
      <Footer menu={footerMenu} />
    </>
  );
}
