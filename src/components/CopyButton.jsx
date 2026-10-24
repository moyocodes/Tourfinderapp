import { motion } from 'framer-motion'
import { useCopy } from '../useCopy'

/** Two overlapping sheets; a tick once copied. */
export function CopyIcon({ copied, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {copied ? (
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 5.5v-2A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2" stroke="currentColor" strokeWidth="1.4" />
        </>
      )}
    </svg>
  )
}

/** Copies `text` on click and shows a tick for a moment. `showLabel` adds the word. */
export default function CopyButton({ text, label = 'Copy', showLabel = false }) {
  const [copied, copy] = useCopy()
  return (
    <motion.button
      type="button"
      onClick={() => copy(text)}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.85 }}
      className={`flex shrink-0 items-center gap-1 rounded-full p-1.5 text-[11.5px] font-medium transition-colors ${
        showLabel ? 'px-2.5' : ''
      } ${copied ? 'bg-accent-quiet text-accent' : 'text-ink-faint hover:text-ink-muted'}`}
    >
      <CopyIcon copied={copied} />
      {showLabel && <span>{copied ? 'Copied' : 'Copy'}</span>}
    </motion.button>
  )
}
