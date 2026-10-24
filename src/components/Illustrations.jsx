import { motion } from 'framer-motion'

/*
 * Small animated line illustrations, one per intent. The main stroke is
 * `currentColor`, so each caller tints them (the accent in callouts, a
 * category hue on welcome tiles); the second colour is always the lagoon.
 */

const loop = (duration, delay = 0) => ({ duration, delay, repeat: Infinity, ease: 'easeInOut' })
const fillSoft = { fill: 'currentColor', fillOpacity: 0.14 }
const second = 'var(--accent-2)'

const ILLUSTRATIONS = {
  food: () => (
    <>
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M${22 + i * 8} 22c-2-3 2-5 0-8`}
          stroke={second}
          strokeWidth="1.6"
          strokeLinecap="round"
          animate={{ y: [2, -3, 2], opacity: [0, 1, 0] }}
          transition={loop(2.2, i * 0.4)}
        />
      ))}
      <path d="M12 30h40a20 16 0 0 1-40 0Z" {...fillSoft} stroke="currentColor" strokeWidth="1.8" />
      <path d="M24 48h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  landmarks: () => (
    <>
      <motion.circle cx="46" cy="16" r="5" fill={second} animate={{ opacity: [0.5, 1, 0.5] }} transition={loop(3)} />
      <path d="M14 50h36M18 50V30h28v20M16 30l16-12 16 12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" {...fillSoft} />
      <path d="M24 50V36M32 50V36M40 50V36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  transport: () => (
    <>
      <path d="M8 48h48" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.4" strokeDasharray="3 4" />
      <motion.g animate={{ x: [-4, 4, -4] }} transition={loop(3)}>
        <rect x="16" y="22" width="32" height="20" rx="5" {...fillSoft} stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 32h32" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="23" cy="44" r="3" fill={second} />
        <circle cx="41" cy="44" r="3" fill={second} />
      </motion.g>
    </>
  ),
  safety: () => (
    <>
      <motion.path
        d="M32 10 50 17v12c0 11-8 19-18 23-10-4-18-12-18-23V17Z"
        {...fillSoft}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        animate={{ scale: [1, 1.05, 1] }}
        transition={loop(2.4)}
        style={{ originX: '32px', originY: '30px' }}
      />
      <path d="m25 31 5 5 9-10" stroke={second} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  accommodation: () => (
    <>
      <motion.path
        d="M44 12a6 6 0 1 0 6 8 5 5 0 0 1-6-8Z"
        fill={second}
        animate={{ rotate: [-8, 8, -8] }}
        transition={loop(4)}
        style={{ originX: '46px', originY: '16px' }}
      />
      <path d="M10 48V26M10 38h44v10M54 48V34a6 6 0 0 0-6-6H28v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...fillSoft} />
      <circle cx="18" cy="32" r="4" fill="currentColor" />
    </>
  ),
  general: () => (
    <>
      <circle cx="32" cy="32" r="20" {...fillSoft} stroke="currentColor" strokeWidth="1.8" />
      <motion.path
        d="M32 16 36 32 32 48 28 32Z"
        fill={second}
        animate={{ rotate: [0, 20, -12, 0] }}
        transition={loop(5)}
        style={{ originX: '32px', originY: '32px' }}
      />
    </>
  ),
}

export function Illustration({ intent, size = 52, className = '' }) {
  const Draw = ILLUSTRATIONS[intent] ?? ILLUSTRATIONS.general
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className={`shrink-0 ${className}`}>
      <Draw />
    </svg>
  )
}
