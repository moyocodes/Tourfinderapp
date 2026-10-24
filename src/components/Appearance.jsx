import { useState } from 'react'
import { motion } from 'framer-motion'
import { ACCENTS } from '../usePrefs'
import { WALLPAPERS } from '../wallpapers'

/*
 * Every look-and-feel control in one place — theme, accent and background
 * (including the visitor's own image). Rendered by both the onboarding "look"
 * step and the header's palette popover, so the two can never drift apart.
 * Everything applies live.
 */

const THEMES = [
  ['light', '☀️', 'Day'],
  ['dark', '🌙', 'Night'],
  ['system', '🖥️', 'Auto'],
]

export default function Appearance({ theme, setTheme, accent, setAccent, wallpaper, compact = false }) {
  return (
    <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-5'}`}>
      <Section label="Theme">
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-panel-solid/40 p-1">
          {THEMES.map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={`relative rounded-xl py-2 text-[13px] font-medium transition-colors ${
                theme === id ? 'text-on-accent' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {theme === id && (
                <motion.span
                  layoutId={compact ? 'theme-pill-pop' : 'theme-pill'}
                  className="absolute inset-0 rounded-xl bg-accent shadow-glow"
                />
              )}
              <span className="relative">
                {icon} {label}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section label="Accent colour">
        <div className="grid grid-cols-6 gap-2">
          {ACCENTS.map((a) => {
            const on = accent === a.id
            return (
              <motion.button
                key={a.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setAccent(a.id)}
                aria-pressed={on}
                aria-label={a.label}
                title={a.label}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={`rounded-full transition-shadow ${compact ? 'h-8 w-8' : 'h-10 w-10'} ${
                    on ? 'ring-2 ring-ink ring-offset-2 ring-offset-panel-solid' : ''
                  }`}
                  style={{ background: `radial-gradient(circle at 30% 30%, #fff8 0, transparent 45%), ${a.swatch}` }}
                />
                {!compact && (
                  <span className={`text-[10.5px] leading-tight ${on ? 'font-semibold text-ink' : 'text-ink-faint'}`}>
                    {a.label}
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
      </Section>

      <Section label="Background">
        <div className="grid grid-cols-3 gap-2">
          {WALLPAPERS.map((w) => (
            <Swatch key={w.id} wallpaper={w} active={wallpaper.id === w.id} onClick={() => wallpaper.setId(w.id)} />
          ))}
        </div>
        <CustomImage wallpaper={wallpaper} />
      </Section>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10.5px] font-semibold tracking-[0.14em] text-ink-faint uppercase">{label}</span>
      {children}
    </div>
  )
}

function Swatch({ wallpaper, active, onClick }) {
  const preview =
    wallpaper.id === 'aurora'
      ? {
          backgroundImage: `
            radial-gradient(circle at 30% 30%, var(--accent-quiet) 0%, transparent 60%),
            radial-gradient(circle at 70% 70%, var(--geo-quiet) 0%, transparent 60%)`,
        }
      : (wallpaper.css ?? { backgroundImage: 'none' })

  return (
    <button onClick={onClick} aria-pressed={active} className="group flex flex-col items-center gap-1">
      <span
        className={`block h-10 w-full rounded-xl border-[1.5px] bg-ground transition-all ${
          active ? 'border-accent shadow-glow' : 'border-line group-hover:border-accent/50'
        }`}
        style={preview}
      />
      <span className={`text-[10.5px] font-medium ${active ? 'text-accent' : 'text-ink-faint'}`}>{wallpaper.name}</span>
    </button>
  )
}

/** Paste an image URL; a live thumbnail confirms it loads before it's applied. */
function CustomImage({ wallpaper }) {
  const [draft, setDraft] = useState(wallpaper.customUrl)
  const [status, setStatus] = useState('idle') // idle | ok | bad
  const url = draft.trim()
  const active = wallpaper.id === 'custom' && wallpaper.customUrl

  function apply() {
    if (!url || status === 'bad') return
    wallpaper.setCustomUrl(url)
    wallpaper.setId('custom')
  }

  return (
    <div
      className={`mt-1 flex flex-col gap-2 rounded-2xl border p-2.5 transition-colors ${
        active ? 'border-accent bg-accent/[0.07]' : 'border-dashed border-line'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-line bg-ground-2">
          {url ? (
            <img
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              onLoad={() => setStatus('ok')}
              onError={() => setStatus('bad')}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[18px]">🖼️</span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[12.5px] font-semibold text-ink">Your own image</span>
          <span className={`truncate text-[11px] ${status === 'bad' ? 'text-closed' : 'text-ink-faint'}`}>
            {status === 'bad'
              ? "That link didn't load as an image"
              : active
                ? 'In use — your photo, behind frosted glass'
                : 'A trip photo, a dream destination…'}
          </span>
        </div>
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setStatus('idle')
          }}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          placeholder="Paste an image URL"
          className="min-w-0 flex-1 rounded-xl border border-line bg-panel-solid/70 px-3 py-2 text-[12.5px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
        />
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={apply}
          disabled={!url || status === 'bad'}
          className="rounded-xl bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-on-accent disabled:opacity-30"
        >
          Use
        </motion.button>
      </div>
      {wallpaper.customUrl && (
        <button
          onClick={() => {
            wallpaper.setCustomUrl('')
            setDraft('')
            setStatus('idle')
            if (wallpaper.id === 'custom') wallpaper.setId('aurora')
          }}
          className="self-start text-[11px] text-ink-faint underline underline-offset-2 hover:text-ink"
        >
          Remove image
        </button>
      )}
    </div>
  )
}
