import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

/**
 * Custom hook for managing dark/light theme preference.
 * Persists the choice in localStorage and responds to system preference changes.
 * Returns the current effective theme and a toggle function.
 */
export function useTheme(): { theme: Theme; effectiveTheme: 'light' | 'dark'; setTheme: (theme: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('pocketplan:theme')
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    } catch { /* ignore */ }
    return 'system'
  })

  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemPreference(e.matches ? 'dark' : 'light')
    mediaQuery.addEventListener?.('change', handler)
    return () => mediaQuery.removeEventListener?.('change', handler)
  }, [])

  const effectiveTheme = theme === 'system' ? systemPreference : theme

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    try { localStorage.setItem('pocketplan:theme', newTheme) } catch { /* ignore */ }
  }, [])

  return { theme, effectiveTheme, setTheme }
}
