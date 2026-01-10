import Link from 'next/link';

type CategoryCardProps = {
  title: string;
  href: string;
  description?: string;
};

export function CategoryCard({ title, href, description }: CategoryCardProps) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-5 md:py-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
    >
      <div className="text-lg font-semibold text-neutral-900">
        {title}
      </div>
      {description ? (
        <p className="mt-2 text-sm text-neutral-600">{description}</p>
      ) : null}
      <span className="mt-4 text-sm font-medium text-blue-600">
        Browse {title.toLowerCase()}
      </span>
    </Link>
  );
}

