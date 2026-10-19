import { useSyncExternalStore } from 'react'

/** The theme setting (S-4, DS-4): dark is the default. */
export type Theme = 'dark' | 'light' | 'system'
export const THEMES: Theme[] = ['dark', 'light', 'system']
const STORAGE_KEY = 'hemi.theme'

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  } catch {
    // ignore unavailable storage
  }
  return 'dark'
}

let current: Theme = read()

/** The theme actually shown: "system" follows the operating system. */
export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') return media?.matches ? 'light' : 'dark'
  return theme
}

function apply() {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = resolveTheme(current)
  listeners.forEach((listener) => listener())
}

export function setTheme(theme: Theme) {
  current = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore unavailable storage
  }
  apply()
}

media?.addEventListener('change', apply)
apply()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The theme setting and the theme it resolves to. */
export function useTheme(): { theme: Theme; resolved: 'dark' | 'light' } {
  const theme = useSyncExternalStore(subscribe, () => current)
  const resolved = useSyncExternalStore(subscribe, () => resolveTheme(current))
  return { theme, resolved }
}
