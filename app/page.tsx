import { Carousel } from 'components/carousel';
import { CategoryCard } from 'components/CategoryCard';
import { ThreeItemGrid } from 'components/grid/three-items';
import { getMenu } from 'lib/shopify';

export default async function HomePage() {
  const categories = [
    { title: 'Detection', href: '/search/detection' },
    { title: 'Sounders', href: '/search/sounders' },
    { title: 'MCP', href: '/search/mcp' },
    { title: 'Interfaces', href: '/search/interfaces' },
    { title: 'Panels', href: '/search/panels' }
  ];

  return (
    <>
      {await ThreeItemGrid()}
      {await Carousel()}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div
          data-testid="opening-banner"
          className="mb-10 rounded-xl border border-neutral-300 bg-neutral-100 px-6 py-7 text-center border-t-4 border-t-red-700"
        >
          <p className="text-2xl font-semibold tracking-tight text-neutral-900">Opening Spring 2026</p>
          <p className="mt-2 text-base text-neutral-700">
            Trade fire alarm parts &amp; accessories. Full catalogue launching soon.
          </p>
        </div>
        <div className="mb-6 space-y-2">
          <h2 className="text-2xl font-bold">Browse categories</h2>
          <p className="text-neutral-600">
            Shop trade-ready fire detection, notification, and control equipment by category.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.href} title={category.title} href={category.href} />
          ))}
        </div>
      </section>
    </>
  );
}
