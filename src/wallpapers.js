/**
 * Background options for the chat surface.
 *
 * All CSS-generated — gradients and repeating patterns, no image files — so
 * they add nothing to the bundle and adapt to whichever theme is active by
 * drawing from the same tokens as the rest of the UI.
 *
 * `custom` is the exception: it renders a user-supplied image URL.
 */

export const WALLPAPERS = [
  {
    id: 'aurora',
    name: 'Aurora',
    // The default: drifting orbs, defined in index.css so it can animate.
    css: null,
  },
  {
    id: 'mesh',
    name: 'Mesh',
    css: {
      backgroundImage: `
        radial-gradient(at 18% 22%, var(--accent-quiet) 0px, transparent 55%),
        radial-gradient(at 82% 18%, var(--geo-quiet) 0px, transparent 50%),
        radial-gradient(at 45% 85%, var(--accent-quiet) 0px, transparent 55%),
        radial-gradient(at 88% 72%, var(--geo-quiet) 0px, transparent 45%)`,
    },
  },
  {
    id: 'grid',
    name: 'Grid',
    css: {
      backgroundImage: `
        linear-gradient(var(--panel-border) 1px, transparent 1px),
        linear-gradient(90deg, var(--panel-border) 1px, transparent 1px)`,
      backgroundSize: '44px 44px',
    },
  },
  {
    id: 'topographic',
    name: 'Contour',
    // Concentric rings echoing a topographic map — the travel reference.
    css: {
      backgroundImage: `repeating-radial-gradient(
        circle at 30% 40%,
        transparent 0 38px,
        var(--panel-border) 38px 39px)`,
    },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    css: {
      backgroundImage: `linear-gradient(160deg,
        var(--ground) 0%,
        var(--ground-2) 45%,
        var(--accent-quiet) 100%)`,
    },
  },
  {
    id: 'plain',
    name: 'Plain',
    css: { backgroundImage: 'none' },
  },
]

export const DEFAULT_WALLPAPER = 'aurora'
