import { useEffect, useState } from 'react'

// Custom properties come back unresolved (e.g. "light-dark(…)"), so colours
// are read through a hidden probe element that the browser resolves to rgb().
let probe
function resolve(name) {
  if (!probe) {
    probe = document.createElement('span')
    probe.style.display = 'none'
    document.body.appendChild(probe)
  }
  probe.style.color = `var(${name})`
  return getComputedStyle(probe).color
}

function read() {
  const s = getComputedStyle(document.documentElement)
  const v = resolve
  return {
    accent: v('--accent'),
    accent2: v('--accent-2'),
    geo: v('--geo'),
    sand: v('--sand'),
    ground2: v('--ground-2'),
    faint: v('--ink-faint'),
    dark: s.colorScheme === 'dark',
  }
}

/**
 * The CSS colour tokens, for code that can't use CSS — the WebGL scene.
 * Re-reads whenever the theme changes, either by an explicit choice (the
 * data-theme attribute) or by the OS switching while on 'system'.
 */
export function useThemeColors() {
  const [colors, setColors] = useState(read)

  useEffect(() => {
    const update = () => setColors(read())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    return () => {
      observer.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [])

  return colors
}
