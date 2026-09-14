import { useEffect, useRef, useState } from 'react'
import { WALLPAPERS } from '../wallpapers'

/** Small preview tile showing what each option looks like. */
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
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
      aria-pressed={active}
    >
      <span
        className="block h-11 w-full rounded-lg transition-all duration-200"
        style={{
          ...preview,
          backgroundColor: 'var(--ground)',
          border: `1.5px solid ${active ? 'var(--accent)' : 'var(--panel-border)'}`,
          boxShadow: active ? 'var(--glow-accent)' : 'none',
        }}
      />
      <span
        className="text-[10px]"
        style={{ color: active ? 'var(--accent)' : 'var(--ink-faint)', fontWeight: 500 }}
      >
        {wallpaper.name}
      </span>
    </button>
  )
}

export default function WallpaperPicker({ id, setId, customUrl, setCustomUrl, onClose }) {
  const [draft, setDraft] = useState(customUrl)
  const ref = useRef(null)

  // Dismiss on outside click or Escape — expected behaviour for a popover.
  useEffect(() => {
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function applyCustom() {
    const url = draft.trim()
    if (!url) return
    setCustomUrl(url)
    setId('custom')
  }

  return (
    <div
      ref={ref}
      className="glass absolute top-12 right-0 z-30 w-[268px] p-3.5"
      style={{ borderRadius: 'var(--radius)' }}
    >
      <p
        className="mb-2.5 text-[10px] tracking-[0.16em] uppercase"
        style={{ color: 'var(--ink-faint)', fontWeight: 600 }}
      >
        Background
      </p>

      <div className="grid grid-cols-3 gap-2">
        {WALLPAPERS.map((w) => (
          <Swatch key={w.id} wallpaper={w} active={id === w.id} onClick={() => setId(w.id)} />
        ))}
      </div>

      <div
        className="mt-3.5 flex flex-col gap-2 pt-3"
        style={{ borderTop: '1px solid var(--panel-border)' }}
      >
        <p
          className="text-[10px] tracking-[0.16em] uppercase"
          style={{ color: 'var(--ink-faint)', fontWeight: 600 }}
        >
          Your own image
        </p>
        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
            placeholder="Paste an image URL"
            className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
            style={{
              background: 'var(--ground)',
              border: '1px solid var(--panel-border)',
              color: 'var(--ink)',
            }}
          />
          <button
            onClick={applyCustom}
            disabled={!draft.trim()}
            className="rounded-lg px-2.5 py-1.5 text-[12px] disabled:opacity-30"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 500 }}
          >
            Set
          </button>
        </div>
        {customUrl && (
          <button
            onClick={() => {
              setCustomUrl('')
              setDraft('')
              setId('aurora')
            }}
            className="self-start text-[11px] underline underline-offset-2"
            style={{ color: 'var(--ink-faint)' }}
          >
            Remove custom image
          </button>
        )}
      </div>
    </div>
  )
}
