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
  { mode: 'system', label: 'System', Icon: Monitor },
]

export function ThemeSwitch() {
  const { mode, setMode } = useTheme()
  return (
    <div className="seg w-full" role="group" aria-label="Theme">
      {modes.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          type="button"
          className={clsx('flex-1 justify-center', mode === m && 'active')}
          aria-pressed={mode === m}
          title={`${label} theme`}
          onClick={() => setMode(m)}
        >
          <Icon size={13} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}
