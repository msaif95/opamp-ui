import { GO_TO } from '../lib/shortcuts'
import { Modal } from './Dialogs'

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k, i) => (
        <span key={i} className="contents">
          {i > 0 && <span className="text-xs text-muted">then</span>}
          <kbd className="rounded border border-border-strong bg-panel-2 px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
        </span>
      ))}
    </span>
  )
}

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string[], string][] = [
    [['/'], 'Search collectors, configs, groups and pages (also Ctrl or ⌘ + K)'],
    [['j'], 'Next row in the table'],
    [['k'], 'Previous row in the table'],
    [['Enter'], 'Open the highlighted row'],
    ...Object.entries(GO_TO).map(([key, { label }]): [string[], string] => [['g', key], `Go to ${label}`]),
    [['?'], 'Show this list'],
    [['Esc'], 'Close a dialog or menu'],
  ]
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" description="Shortcuts are off while you are typing in a field.">
      <ul className="divide-y divide-border">
        {rows.map(([keys, what]) => (
          <li key={what} className="flex items-center justify-between gap-4 py-1.5">
            <span>{what}</span>
            <Keys keys={keys} />
          </li>
        ))}
      </ul>
    </Modal>
  )
}
