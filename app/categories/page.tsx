import Link from "next/link";

const categories = [
  { title: "Sensors", slug: "sensor" },
  { title: "Sounders", slug: "sounder" },
  { title: "Manual Call Points", slug: "mcp" },
  { title: "Interfaces", slug: "interface" },
  { title: "Panels", slug: "panel" },
];

export default function CategoriesPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Categories</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/search/${cat.slug}`}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-black"
          >
            <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {cat.title}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              Browse {cat.title.toLowerCase()}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
