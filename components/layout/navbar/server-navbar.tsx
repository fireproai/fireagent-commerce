import { getMenu } from 'lib/shopify';
import NavbarClient from './index';

export default async function Navbar() {
  const menu = await getMenu('next-js-frontend-header-menu');
  const siteName = process.env.SITE_NAME || 'Store';

  return <NavbarClient menu={menu} siteName={siteName} />;
}
