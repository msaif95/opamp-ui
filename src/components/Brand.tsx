import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeMode } from '../state/ThemeContext'

/** The fleet mark: one control node connected to three agents. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span className="brand-gradient inline-flex shrink-0 items-center justify-center rounded-lg shadow-sm" style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        <g stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M16 15 9 22M16 15l7 7M16 15V8" />
        </g>
        <g fill="#fff">
          <circle cx="16" cy="15" r="3.2" />
          <circle cx="16" cy="8" r="2.2" />
          <circle cx="9" cy="22" r="2.2" />
          <circle cx="23" cy="22" r="2.2" />
        </g>
      </svg>
    </span>
  )
}

export function Wordmark({ large }: { large?: boolean }) {
  return (
    <span className={clsx('font-semibold tracking-tight', large ? 'text-xl' : 'text-sm')}>
      OpAMP <span className="brand-text">Fleet</span>
    </span>
  )
}

const modes: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon },
  { mode: 'system', label: 'Auto', Icon: Monitor },
]

/**
 * Chooses the colour theme. In the full sidebar it is a labelled row of three named choices, with the one in use
 * highlighted. In the icon-only sidebar it is one button showing the current theme that opens the same choices.
 */
export function ThemeSwitch({ compact }: { compact?: boolean }) {
  const { mode, setMode } = useTheme()
  const current = modes.find((m) => m.mode === mode) ?? modes[2]
  if (compact) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="flex h-8 w-full items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
          aria-label={`Theme: ${current.label}. Change theme`}
          title={`Theme: ${current.label}`}
        >
          <current.Icon size={15} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="right" align="end" sideOffset={8} className="z-50 min-w-40 rounded-md border border-border bg-panel p-1 shadow-lg">
            <DropdownMenu.Label className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">Theme</DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              {modes.map(({ mode: m, label, Icon }) => (
                <DropdownMenu.RadioItem
                  key={m}
                  value={m}
                  className="flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-accent-soft data-[state=checked]:font-medium data-[state=checked]:text-accent"
                >
                  <Icon size={14} /> {label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }
  return (
    <div>
      <div id="theme-label" className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
        Theme
      </div>
      <div className="seg w-full" role="radiogroup" aria-labelledby="theme-label">
        {modes.map(({ mode: m, label, Icon }) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={clsx('flex-1 justify-center gap-1.5', mode === m && 'active')}
            title={m === 'system' ? 'Follow this device’s light or dark setting' : `${label} theme`}
            onClick={() => setMode(m)}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
