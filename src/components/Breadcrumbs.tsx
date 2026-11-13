import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Where the page sits: links to its ancestors, then the page itself. Used at the top of every page below a list. */
export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {items.map((item, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-faint" aria-hidden />}
            {item.to ? (
              <Link to={item.to} className="truncate hover:text-fg hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="truncate text-fg" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
