import { useEffect, useState } from 'react'
import { DEFAULT_WALLPAPER, WALLPAPERS } from './wallpapers'

const KEY = 'wayfinder-wallpaper'
const CUSTOM_KEY = 'wayfinder-wallpaper-custom'

/**
 * Background choice, persisted per-viewer.
 *
 * Storage is wrapped in try/catch throughout: private browsing and blocked
 * site-data both make localStorage throw on access, and a background
 * preference is never worth breaking the page over.
 */
export function useWallpaper() {
  const [id, setId] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? DEFAULT_WALLPAPER
    } catch {
      return DEFAULT_WALLPAPER
    }
  })

  const [customUrl, setCustomUrl] = useState(() => {
    try {
      return localStorage.getItem(CUSTOM_KEY) ?? ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, id)
    } catch {
      // Preference still applies for this session.
    }
  }, [id])

  useEffect(() => {
    try {
      if (customUrl) localStorage.setItem(CUSTOM_KEY, customUrl)
      else localStorage.removeItem(CUSTOM_KEY)
    } catch {
      // As above — non-fatal.
    }
  }, [customUrl])

  const preset = WALLPAPERS.find((w) => w.id === id)

  /** Inline style for the fixed background layer, or null to use the CSS default. */
  let style = null
  if (id === 'custom' && customUrl) {
    style = {
      backgroundImage: `url(${JSON.stringify(customUrl)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  } else if (preset?.css) {
    style = preset.css
  }

  return { id, setId, customUrl, setCustomUrl, style, usesDefault: id === 'aurora' }
}
