import * as RadixTabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface TabDef {
  value: string
  label: string
  /** Shown as a small pill after the label. */
  count?: number
  content: ReactNode
}

/** Page tabs. The open tab is kept in `?tab=`, so a reload or a shared link lands on the same one. */
export function Tabs({ tabs, label }: { tabs: TabDef[]; label: string }) {
  const [params, setParams] = useSearchParams()
  const current = tabs.some((t) => t.value === params.get('tab')) ? params.get('tab')! : tabs[0].value
  return (
    <RadixTabs.Root value={current} onValueChange={(v) => setParams(v === tabs[0].value ? {} : { tab: v }, { replace: true })}>
      <RadixTabs.List className="flex gap-1 border-b border-border" aria-label={label}>
        {tabs.map((t) => (
          <RadixTabs.Trigger
            key={t.value}
            value={t.value}
            className="-mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40 data-[state=active]:border-accent data-[state=active]:font-medium data-[state=active]:text-accent"
          >
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-panel-2 px-1.5 text-[11px] text-muted">{t.count}</span>}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((t) => (
        <RadixTabs.Content key={t.value} value={t.value} className="space-y-4 pt-4 outline-none">
          {t.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}
