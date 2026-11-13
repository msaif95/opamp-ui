import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Shown in place of an empty table: what belongs here, why it matters, and the first step to take. */
export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="brand-gradient flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm" aria-hidden>
        <Icon size={22} />
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <div className="mt-1 max-w-xl space-y-2 text-muted">{children}</div>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
