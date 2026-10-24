import { useEffect, useState } from 'react'

/*
 * What the visitor told us about themselves in onboarding. Per-viewer and
 * local only — it shapes suggestions and looks, and is never sent anywhere.
 */

const KEY = 'tourfinderapp-prefs'

const DEFAULTS = {
  onboarded: false,
  name: '',
  interests: [],
  style: 'comfort',
  accent: 'coral',
  sidebarCollapsed: false,
}

export const INTERESTS = [
  { id: 'food', label: 'Food & drink', emoji: '🍜', ask: (c) => `Where do locals eat in ${c}?` },
  { id: 'culture', label: 'History & culture', emoji: '🏛️', ask: (c) => `Historic sites worth seeing in ${c}` },
  { id: 'nature', label: 'Nature & beaches', emoji: '🏝️', ask: (c) => `Best beaches and parks near ${c}` },
  { id: 'nightlife', label: 'Nightlife', emoji: '🎶', ask: (c) => `Where to go out at night in ${c}` },
  { id: 'shopping', label: 'Markets & shopping', emoji: '🛍️', ask: (c) => `Best markets to explore in ${c}` },
  { id: 'adventure', label: 'Adventure', emoji: '🧗', ask: (c) => `Adventurous things to do around ${c}` },
  { id: 'art', label: 'Art & museums', emoji: '🎨', ask: (c) => `Museums and galleries in ${c}` },
  { id: 'family', label: 'Family trips', emoji: '🧸', ask: (c) => `Family-friendly activities in ${c}` },
]

export const STYLES = [
  { id: 'budget', label: 'Backpacker', emoji: '🎒', blurb: 'Cheap & cheerful', word: 'budget' },
  { id: 'comfort', label: 'Comfort', emoji: '🧳', blurb: 'Good value, no fuss', word: 'mid-range' },
  { id: 'luxury', label: 'Luxury', emoji: '🥂', blurb: 'Treat myself', word: 'luxury' },
]

/** Accent presets, named for where the colour comes from. `swatch` is for the picker only. */
export const ACCENTS = [
  { id: 'coral', label: 'Sunset coral', swatch: '#ff8a5b' },
  { id: 'lagoon', label: 'Lagoon', swatch: '#2dd4bf' },
  { id: 'palm', label: 'Palm', swatch: '#4ade80' },
  { id: 'sky', label: 'Open sky', swatch: '#7cc4ff' },
  { id: 'hibiscus', label: 'Hibiscus', swatch: '#f472b6' },
  { id: 'saffron', label: 'Saffron', swatch: '#fbbf24' },
]

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      // Private browsing — preferences still apply for this visit.
    }
  }, [prefs])

  // Coral is the stylesheet default, so it needs no attribute.
  useEffect(() => {
    const root = document.documentElement
    if (prefs.accent === 'coral') root.removeAttribute('data-accent')
    else root.setAttribute('data-accent', prefs.accent)
  }, [prefs.accent])

  const update = (patch) => setPrefs((p) => ({ ...p, ...patch }))
  return { prefs, update }
}
