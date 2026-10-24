import { forwardRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Illustration } from './Illustrations'

/*
 * A card pinned to the point on the globe the conversation is about. The
 * WebGL scene moves the outer element every frame (via ref, no re-render) so
 * it tracks the spinning globe; this component only decides what it shows.
 */

const Callout = forwardRef(function Callout({ info }, ref) {
  return (
    <div
      ref={ref}
      aria-live="polite"
      className="pointer-events-none fixed top-0 left-0 z-10 transition-opacity duration-300"
      style={{ opacity: 0 }}
    >
      {/* Leader line from the beacon up to the card. */}
      <svg width="44" height="44" className="absolute -top-[44px] left-0 overflow-visible" aria-hidden="true">
        <path d="M0 44 L22 22 L44 22" stroke="var(--accent)" strokeWidth="1.2" fill="none" opacity="0.8" />
      </svg>

      <AnimatePresence mode="wait">
        {info && (
          <motion.div
            key={info.title}
            initial={{ opacity: 0, x: -8, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="glass absolute -top-[66px] left-[44px] flex w-max max-w-[260px] items-center gap-3 rounded-2xl p-2.5 pr-4"
          >
            {info.image ? (
              <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl bg-ground-2">
                <img src={info.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </div>
            ) : (
              <Illustration intent={info.intent} className="text-accent" />
            )}
            <div className="flex min-w-0 flex-col">
              {info.kicker && (
                <span className="text-[9.5px] font-semibold tracking-[0.14em] text-accent uppercase">{info.kicker}</span>
              )}
              <span className="font-heading truncate text-[15px] leading-tight font-semibold text-ink">{info.title}</span>
              {info.subtitle && <span className="truncate text-[11.5px] text-ink-faint">{info.subtitle}</span>}
            </div>
            {info.image && (
              <span className="absolute -right-2 -bottom-2 rounded-full bg-panel-solid p-0.5 shadow-glow">
                <Illustration intent={info.intent} size={26} className="text-accent" />
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

export default Callout
