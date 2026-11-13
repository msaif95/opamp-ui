import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** Second key of the "g then …" shortcuts. */
export const GO_TO: Record<string, { to: string; label: string }> = {
  o: { to: '/overview', label: 'Overview' },
  a: { to: '/agents', label: 'Fleet (agents)' },
  c: { to: '/configs', label: 'Configs' },
  g: { to: '/groups', label: 'Groups' },
  b: { to: '/rollouts', label: 'Bulk push' },
  t: { to: '/topology', label: 'Topology' },
}

/** Places where a key press is the user typing or operating a widget, not a shortcut. */
const BUSY = 'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"], [role="combobox"]'

/**
 * Keyboard shortcuts for the whole console: "/" or Ctrl/Cmd+K to search, "?" for this list, "g" then a letter to
 * jump to a page, and j / k to move through the rows of the table on screen (Enter opens the row).
 */
export function useShortcuts(openSearch: () => void, openHelp: () => void) {
  const navigate = useNavigate()
  useEffect(() => {
    let gPressedAt = 0
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openSearch()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.closest(BUSY)) return

      if (e.key === 'Enter' && target.tagName === 'TR') {
        target.click()
        return
      }
      if (Date.now() - gPressedAt < 1500 && GO_TO[e.key]) {
        gPressedAt = 0
        e.preventDefault()
        navigate(GO_TO[e.key].to)
        return
      }
      gPressedAt = 0
      switch (e.key) {
        case '/':
          e.preventDefault()
          openSearch()
          break
        case '?':
          e.preventDefault()
          openHelp()
          break
        case 'g':
          gPressedAt = Date.now()
          break
        case 'j':
        case 'k': {
          const rows = [...document.querySelectorAll<HTMLTableRowElement>('main table tbody tr')]
          if (rows.length === 0) break
          const at = rows.indexOf(target.closest('tr') as HTMLTableRowElement)
          const next = rows[Math.min(rows.length - 1, Math.max(0, at === -1 ? 0 : at + (e.key === 'j' ? 1 : -1)))]
          next.tabIndex = -1
          next.focus()
          next.scrollIntoView({ block: 'nearest' })
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, openSearch, openHelp])
}
