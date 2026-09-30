import { useState } from 'react'

/** Relative time, coarse enough that it never needs re-rendering on a timer. */
function ago(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function SectionLabel({ children }) {
  return (
    <p
      className="px-1 text-[10px] tracking-[0.16em] uppercase"
      style={{ color: 'var(--ink-faint)', fontWeight: 600 }}
    >
      {children}
    </p>
  )
}

function SessionRow({ session, active, onSelect, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group flex items-center gap-1"
    >
      <button
        onClick={onSelect}
        className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left transition-colors duration-150"
        style={{
          background: active ? 'var(--accent-quiet)' : hover ? 'var(--accent-quiet)' : 'transparent',
          border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
        }}
      >
        <span
          className="block truncate text-[12.5px]"
          style={{ color: active ? 'var(--ink)' : 'var(--ink-muted)', fontWeight: active ? 500 : 400 }}
        >
          {session.title}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          {ago(session.updatedAt)}
        </span>
      </button>
      {(hover || active) && (
        <button
          onClick={onDelete}
          aria-label={`Delete ${session.title}`}
          title="Delete"
          className="shrink-0 rounded p-1 transition-colors"
          style={{ color: 'var(--ink-faint)' }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

/** Free-plan meter. Turns amber then red as the allowance runs down. */
function PlanPanel({ usage }) {
  if (!usage) return null
  const pct = usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0
  const barColor =
    usage.remaining === 0
      ? 'var(--closed)'
      : usage.remaining <= 5
        ? 'var(--accent)'
        : 'var(--accent-2)'

  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{ border: '1px solid var(--panel-border)', background: 'var(--accent-quiet)' }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[12px]" style={{ color: 'var(--ink)', fontWeight: 600 }}>
          Free plan
        </span>
        <span
          className="text-[11px]"
          style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {usage.used}/{usage.limit}
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--panel-border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>

      <p className="text-[10.5px] leading-snug" style={{ color: 'var(--ink-faint)' }}>
        {usage.remaining > 0
          ? `${usage.remaining} messages left today · resets ${usage.resets}`
          : `Limit reached · resets ${usage.resets}`}
      </p>
    </div>
  )
}

export default function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  usage,
  open,
  onClose,
}) {
  return (
    <>
      {/* Scrim — only rendered on small screens, where the sidebar overlays. */}
      {open && (
        <button
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        />
      )}

      <aside
        className={`glass fixed top-0 left-0 z-30 flex h-full w-[248px] flex-col transition-transform duration-200 lg:relative lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-col gap-3 p-3.5">
          <button
            onClick={onNew}
            className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] transition-opacity hover:opacity-90"
            style={{
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontWeight: 500,
              boxShadow: 'var(--glow-accent)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            New chat
          </button>
        </div>

        <div className="thin-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto px-3.5 pb-3">
          <SectionLabel>Chats</SectionLabel>
          {sessions.length === 0 ? (
            <p className="px-1 py-2 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
              No conversations yet.
            </p>
          ) : (
            sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === activeId}
                onSelect={() => onSelect(s.id)}
                onDelete={() => onDelete(s.id)}
              />
            ))
          )}
        </div>

        <div
          className="flex flex-col gap-2 p-3.5"
          style={{ borderTop: '1px solid var(--panel-border)' }}
        >
          <PlanPanel usage={usage} />
          <p
            className="text-[10.5px] leading-snug"
            style={{ color: 'var(--ink-faint)' }}
          >
            <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
              Privacy
            </a>
            {' · '}
            <a href="/terms" target="_blank" rel="noreferrer" className="underline">
              Terms
            </a>
            <br />© 2026 James Moyosore. All rights reserved.
          </p>
        </div>
      </aside>
    </>
  )
}
