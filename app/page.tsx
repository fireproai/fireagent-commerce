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
