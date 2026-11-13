import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { api, type Selector } from '../api-client/client'
import { ErrorNote } from './ui'

/** Attributes operators usually target by, shown first when agents report them. */
const PREFERRED = ['env', 'deployment.environment', 'region', 'cloud.region', 'cloud.provider', 'cloud', 'dc', 'datacenter', 'team']
const rank = (k: string) => (PREFERRED.includes(k) ? PREFERRED.indexOf(k) : PREFERRED.length)

/** Chip picker over the attributes the fleet reports. Values of one attribute are OR-ed; attributes are AND-ed. */
export function SelectorPicker({
  selector,
  onChange,
  project,
}: {
  selector: Selector
  onChange: (s: Selector) => void
  /** Show only what this project's collectors report (null: collectors outside any project). Omit for everything visible. */
  project?: string | null
}) {
  const scope = project === undefined ? undefined : (project ?? 'none')
  const facets = useQuery({ queryKey: ['agents', 'facets', scope], queryFn: () => api.facets(scope) })
  const sorted = [...(facets.data?.facets ?? [])].sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))

  const toggle = (key: string, value: string) => {
    const current = selector[key] ?? []
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    const rest = Object.fromEntries(Object.entries(selector).filter(([k]) => k !== key))
    onChange(next.length > 0 ? { ...rest, [key]: next } : rest)
  }

  if (facets.error) return <ErrorNote error={facets.error} />
  return (
    <div className="space-y-3">
      {sorted.map((f) => (
        <div key={f.key} className="flex gap-3">
          <div className="w-40 shrink-0 pt-1 font-mono text-xs text-muted">{f.key}</div>
          <div className="flex flex-wrap gap-1.5">
            {f.values.map((v) => {
              const on = selector[f.key]?.includes(v.value) ?? false
              return (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={on}
                  className={clsx('chip', on ? 'border-accent bg-accent-soft text-accent' : 'hover:bg-hover')}
                  onClick={() => toggle(f.key, v.value)}
                >
                  {v.value || '(empty)'} <span className="text-faint">{v.count.toLocaleString()}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
