import { useEffect, useState } from 'react'

const KEY = 'wayfinder-theme'

/**
 * Theme control with three states: 'system' (default), 'light', 'dark'.
 *
 * 'system' deliberately stamps NO attribute on <html>, leaving the CSS
 * prefers-color-scheme rules in charge. An explicit choice stamps
 * data-theme, which the stylesheet gives higher precedence.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? 'system'
    } catch {
      // Private browsing / blocked storage — fall back to following the OS.
      return 'system'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // Not fatal — the theme still applies for this session.
    }
  }, [theme])

  /** Cycle light -> dark -> system, so all three stay reachable from one control. */
  const cycle = () =>
    setTheme((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'))

  return { theme, setTheme, cycle }
}
