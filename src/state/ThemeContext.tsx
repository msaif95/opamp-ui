import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

// Keep the key and resolution logic in sync with the inline script in index.html.
const KEY = 'opamp.theme'
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)')

const Ctx = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  })

  useEffect(() => {
    localStorage.setItem(KEY, mode)
    const media = systemDark()
    const apply = () => document.documentElement.classList.toggle('dark', mode === 'dark' || (mode === 'system' && media.matches))
    apply()
    if (mode !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [mode])

  const value = useMemo(() => ({ mode, setMode }), [mode])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme outside ThemeProvider')
  return v
}
