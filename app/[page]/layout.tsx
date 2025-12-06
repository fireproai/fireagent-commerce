import Footer from 'components/layout/footer';
import { getMenu } from 'lib/shopify';

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Fetch footer menu on the server
  const menu = await getMenu('next-js-frontend-footer-menu');

  return (
    <>
      <div className="w-full">
        <div className="mx-8 max-w-2xl py-20 sm:mx-auto">{children}</div>
      </div>

      {/* Pass menu to synchronous Footer component */}
      <Footer menu={menu} />
    </>
  );
}
