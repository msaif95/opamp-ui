import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bookmark, Check } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/Dialogs'
import { confirmDialog, promptDialog } from '../../lib/dialog'
import { toast } from '../../lib/toast'
import { useUserSetting } from '../../lib/useUserSetting'
import { decodeFilters, describeFilters, encodeFilters, type FleetFilters, type SavedView } from '../../lib/views'

const MAX_VIEWS = 30
const item = 'cursor-default select-none rounded px-2 py-1.5 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent'

/**
 * The fleet page's saved views: the current filters kept under a name, to come back to with one click. They are
 * each person's own and are stored on the server, so they follow the person between browsers.
 */
export function SavedViews({ current, onApply, names }: { current: FleetFilters; onApply: (f: FleetFilters) => void; names: Parameters<typeof describeFilters>[1] }) {
  const { value, loaded, save } = useUserSetting<SavedView>('fleet_views')
  const [managing, setManaging] = useState(false)
  const views = value ?? []
  const query = encodeFilters(current)
  const active = views.find((v) => v.query === query)

  const saveCurrent = async () => {
    const name = (await promptDialog({ title: 'Save this view', label: 'Name', placeholder: 'e.g. Unhealthy in prod', action: 'Save view' }))?.trim()
    if (!name) return
    // Saving under a name already used replaces that view.
    const same = views.find((v) => v.name.toLowerCase() === name.toLowerCase())
    save(same ? views.map((v) => (v === same ? { ...v, name, query } : v)) : [...views, { id: crypto.randomUUID(), name, query }])
    toast({ title: `View "${name}" saved`, body: 'It can also be shown as a card on the Overview.', tone: 'success' })
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="btn" disabled={!loaded}>
          <Bookmark size={13} /> {active ? active.name : 'Views'}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={4} className="z-50 max-h-96 min-w-64 max-w-sm overflow-auto rounded-md border border-border bg-panel p-1 shadow-lg">
            <DropdownMenu.Label className="px-2 py-1 text-xs text-muted">{views.length === 0 ? 'No saved views yet' : 'Your saved views'}</DropdownMenu.Label>
            {views.map((v) => (
              <DropdownMenu.Item key={v.id} className={item} onSelect={() => onApply(decodeFilters(v.query))}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{v.name}</span>
                  {v === active && <Check size={13} aria-label="Showing now" />}
                </div>
                <div className="truncate text-xs text-muted">{describeFilters(decodeFilters(v.query), names)}</div>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item className={item} disabled={active !== undefined || views.length >= MAX_VIEWS} onSelect={() => void saveCurrent()}>
              Save the current filters as a view…
            </DropdownMenu.Item>
            <DropdownMenu.Item className={item} disabled={views.length === 0} onSelect={() => setManaging(true)}>
              Manage views…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Modal open={managing} onClose={() => setManaging(false)} size="lg" title="Your saved views" description="Only you see these. Deleting a view also takes its card off your Overview.">
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {views.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{v.name}</div>
                <div className="truncate text-xs text-muted">{describeFilters(decodeFilters(v.query), names)}</div>
              </div>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const name = (await promptDialog({ title: `Rename "${v.name}"`, label: 'New name', placeholder: v.name, action: 'Rename' }))?.trim()
                  if (name) save(views.map((x) => (x.id === v.id ? { ...x, name } : x)))
                }}
              >
                Rename
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  void confirmDialog(`Delete the view "${v.name}"?`).then((ok) => ok && save(views.filter((x) => x.id !== v.id)))
                }}
              >
                Delete
              </button>
            </li>
          ))}
          {views.length === 0 && <li className="px-3 py-6 text-center text-muted">No saved views.</li>}
        </ul>
        <div className="mt-4 flex justify-end">
          <button className="btn btn-primary" onClick={() => setManaging(false)}>
            Done
          </button>
        </div>
      </Modal>
    </>
  )
}
