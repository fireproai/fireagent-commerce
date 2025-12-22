import Footer from 'components/layout/footer';
import Collections from 'components/layout/search/collections';
import FilterList from 'components/layout/search/filter';
import { sorting } from 'lib/constants';
import { getCollections, getMenu } from 'lib/shopify';
import { Suspense } from 'react';
import ChildrenWrapper from '../../search/children-wrapper';

export default async function SearchLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const footerMenuHandle =
    process.env.NEXT_PUBLIC_SHOPIFY_FOOTER_MENU_HANDLE || 'next-js-frontend-footer-menu';
  const footerMenu = await getMenu(footerMenuHandle);

  // ѓр? Fetch collections here (server side)
  const collections = await getCollections();

  return (
    <>
      <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-col gap-8 px-4 pb-4 text-black md:flex-row dark:text-white">
        <div className="order-first w-full flex-none md:max-w-[125px]">
          {/* ѓр? Pass collections into synchronous component */}
          <Collections collections={collections} />
        </div>

        <div className="order-last min-h-screen w-full md:order-none">
          <Suspense fallback={null}>
            <ChildrenWrapper>{children}</ChildrenWrapper>
          </Suspense>
        </div>

        <div className="order-none flex-none md:order-last md:w-[125px]">
          <FilterList list={sorting} title="Sort by" />
        </div>
      </div>

      <Footer menu={footerMenu} />
    </>
  );
}
