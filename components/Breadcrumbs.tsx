import Link from 'next/link';

type Crumb = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: Crumb[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (!items?.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.label} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="transition hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-neutral-900 dark:text-neutral-50">
                  {item.label}
                </span>
              )}
              {!isLast && <span className="text-neutral-400">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
