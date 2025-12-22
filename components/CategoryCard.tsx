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
      className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-black"
    >
      <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
        {title}
      </div>
      {description ? (
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      ) : null}
      <span className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400">
        Browse {title.toLowerCase()}
      </span>
    </Link>
  );
}
