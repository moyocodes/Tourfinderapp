import { AnimatePresence, motion } from 'framer-motion'

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
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10, height: 0 }}
      className="group flex items-center gap-1"
    >
      <button
        onClick={onSelect}
        className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 ${
          active ? 'border-accent bg-accent-quiet' : 'border-transparent hover:bg-accent-quiet'
        }`}
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
      <button
        onClick={onDelete}
        aria-label={`Delete ${session.title}`}
        title="Delete"
        className={`shrink-0 rounded p-1 text-ink-faint transition-all hover:text-closed focus-visible:opacity-100 ${
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
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
    </motion.div>
  )
}

/** Free-plan meter. Turns amber then red as the allowance runs down. */
function barColor(usage) {
  return usage.remaining === 0 ? 'var(--closed)' : usage.remaining <= 5 ? 'var(--accent)' : 'var(--accent-2)'
}

function PlanPanel({ usage }) {
  if (!usage) return null
  const pct = usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-accent/[0.08] p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold text-ink">Free plan</span>
        <span className="font-mono text-[11px] text-ink-muted">
          {usage.used}/{usage.limit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          style={{ background: barColor(usage) }}
        />
      </div>
      <p className="text-[10.5px] leading-snug text-ink-faint">
        {usage.remaining > 0
          ? `${usage.remaining} messages left today · resets ${usage.resets}`
          : `Limit reached · resets ${usage.resets}`}
      </p>
    </div>
  )
}

/** The plan meter shrunk to a ring, for the collapsed rail. */
function UsageRing({ usage }) {
  if (!usage) return null
  const pct = usage.limit ? Math.min(1, usage.used / usage.limit) : 0
  const C = 2 * Math.PI * 14
  return (
    <div className="relative flex h-10 w-10 items-center justify-center" title={`${usage.remaining} messages left today`}>
      <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r="14" stroke="var(--panel-border)" strokeWidth="3" fill="none" />
        <motion.circle
          cx="18"
          cy="18"
          r="14"
          stroke={barColor(usage)}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
        />
      </svg>
      <span className="absolute font-mono text-[9px] font-medium text-ink-muted">{usage.remaining}</span>
    </div>
  )
}

const Icons = {
  plus: <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  chats: (
    <path
      d="M2.5 4.5A2 2 0 0 1 4.5 2.5h7a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H7l-3 2.5v-2.5h0a2 2 0 0 1-1.5-2Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  sparkle: (
    <path
      d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8l5.1-1.4Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  pin: (
    <>
      <path d="M8 1.5c-2.5 0-4.5 2-4.5 4.5 0 3.4 4.5 8.5 4.5 8.5s4.5-5.1 4.5-8.5c0-2.5-2-4.5-4.5-4.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="6" r="1.6" fill="currentColor" />
    </>
  ),
  collapse: <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  expand: <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
}

export function Icon({ name, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {Icons[name]}
    </svg>
  )
}

/** Icon button for the collapsed rail, with a tooltip that slides out to the right. */
function RailButton({ icon, label, onClick, primary }) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
        primary ? 'bg-accent text-on-accent shadow-glow' : 'text-ink-muted hover:bg-accent/10 hover:text-accent'
      }`}
    >
      <Icon name={icon} />
      <span className="pointer-events-none absolute left-full ml-3 -translate-x-1 rounded-lg bg-ink px-2 py-1 text-[11px] font-medium whitespace-nowrap text-ground opacity-0 shadow-lg transition-all group-hover:translate-x-0 group-hover:opacity-100">
        {label}
      </span>
    </motion.button>
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
  collapsed,
  onToggleCollapse,
  onPersonalize,
}) {
  // The drawer on small screens always shows the full sidebar.
  const rail = collapsed && !open

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            aria-label="Close sidebar"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: rail ? 68 : 260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className={`glass fixed top-0 left-0 z-40 flex h-full flex-col overflow-hidden transition-transform duration-200 lg:relative lg:z-auto lg:translate-x-0 lg:rounded-[var(--radius)] ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {rail ? (
          <div className="flex h-full flex-col items-center gap-2 py-3.5">
            <RailButton icon="expand" label="Expand sidebar" onClick={onToggleCollapse} />
            <RailButton icon="plus" label="New chat" onClick={onNew} primary />
            <RailButton icon="chats" label={`Chats (${sessions.length})`} onClick={onToggleCollapse} />
            <RailButton icon="sparkle" label="Personalise" onClick={onPersonalize} />
            <div className="mt-auto">
              <UsageRing usage={usage} />
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.08 }}
            className="flex h-full w-[260px] flex-col"
          >
            <div className="flex items-center gap-2 p-3.5">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onNew}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-[13px] font-semibold text-on-accent shadow-glow transition-opacity hover:opacity-90"
              >
                <Icon name="plus" size={13} />
                New chat
              </motion.button>
              <button
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="hidden h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent lg:flex"
              >
                <Icon name="collapse" />
              </button>
            </div>

            <div className="thin-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto px-3.5 pb-3">
              <SectionLabel>Chats</SectionLabel>
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-3 py-6 text-center">
                  <span className="text-[24px]">🗺️</span>
                  <p className="text-[12px] font-light text-ink-faint">Your trips will appear here.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {sessions.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      active={s.id === activeId}
                      onSelect={() => onSelect(s.id)}
                      onDelete={() => onDelete(s.id)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-line p-3.5">
              <button
                onClick={onPersonalize}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-accent/10 hover:text-accent"
              >
                <Icon name="sparkle" size={14} />
                Personalise
              </button>
              <PlanPanel usage={usage} />
              <p className="text-[10.5px] leading-snug text-ink-faint">
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
          </motion.div>
        )}
      </motion.aside>
    </>
  )
}

/**
 * Bottom toolbar on small screens — the sidebar's actions within thumb reach.
 * The active pill glides between items via a shared layoutId.
 */
export function MobileToolbar({ items }) {
  return (
    <nav
      aria-label="Toolbar"
      className="glass fixed inset-x-3 bottom-3 z-20 flex items-center justify-around rounded-2xl px-1 py-1.5 lg:hidden"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      {items.map((it) => (
        <motion.button
          key={it.id}
          whileTap={{ scale: 0.88 }}
          onClick={it.onClick}
          disabled={it.disabled}
          aria-label={it.label}
          className={`relative flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 disabled:opacity-40 ${
            it.active ? 'text-accent' : 'text-ink-muted'
          }`}
        >
          {it.active && <motion.span layoutId="toolbar-pill" className="absolute inset-0 rounded-xl bg-accent/12" />}
          <span className="relative">{it.icon}</span>
          <span className="relative text-[10px] font-medium">{it.label}</span>
        </motion.button>
      ))}
    </nav>
  )
}
