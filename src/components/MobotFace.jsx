import { useEffect, useRef, useState } from 'react'
import { motion, useSpring } from 'framer-motion'

/*
 * Mobot's face as a lightweight SVG, for places where a WebGL canvas per
 * message would be overkill: chat avatars, the thinking indicator, errors.
 * Matches the 3D Mobot — white shell, dark visor, accent eyes and antenna.
 *
 * It's a toy as well as an avatar: the eyes glance toward the pointer, and a
 * tap makes it hop with happy ^^ eyes. Purely decorative, so it stays
 * aria-hidden and does nothing a keyboard user would miss.
 */

const REDUCED =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// One window listener shared by every face on the page, batched per frame —
// a long chat has a face per reply.
const watchers = new Set()
let frame = 0
let last = null
function onMove(e) {
  last = e
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    for (const fn of watchers) fn(last.clientX, last.clientY)
  })
}
function watchPointer(fn) {
  if (!watchers.size) window.addEventListener('pointermove', onMove, { passive: true })
  watchers.add(fn)
  return () => {
    watchers.delete(fn)
    if (!watchers.size) window.removeEventListener('pointermove', onMove)
  }
}

export default function MobotFace({ size = 32, mood = 'idle' }) {
  const ref = useRef(null)
  const [joy, setJoy] = useState(0)
  const lookX = useSpring(0, { stiffness: 180, damping: 18 })
  const lookY = useSpring(0, { stiffness: 180, damping: 18 })

  // Eyes drift up to 2 viewBox units toward the pointer; further away, less pull.
  useEffect(() => {
    if (REDUCED) return
    return watchPointer((px, py) => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const dx = px - (r.left + r.width / 2)
      const dy = py - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy) || 1
      const pull = Math.min(1, d / 160)
      lookX.set((dx / d) * pull * 2)
      lookY.set((dy / d) * pull * 1.5)
    })
  }, [lookX, lookY])

  useEffect(() => {
    if (!joy) return
    const id = setTimeout(() => setJoy(0), 900)
    return () => clearTimeout(id)
  }, [joy])

  const happy = joy > 0
  const eyeH = mood === 'think' ? 3 : mood === 'sad' ? 2.5 : 7
  return (
    <motion.svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      onClick={() => setJoy((n) => n + 1)}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.88 }}
      className="shrink-0 cursor-pointer drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
      // Keying on joy restarts the hop on every tap, even mid-hop.
      key={happy ? `joy-${joy}` : 'rest'}
      animate={
        happy
          ? { y: [0, -6, 0, -2, 0], rotate: [0, -10, 8, -4, 0] }
          : mood === 'think'
            ? { rotate: [-6, 6, -6] }
            : { y: [0, -1.5, 0] }
      }
      transition={
        happy
          ? { duration: 0.7, ease: 'easeOut' }
          : { duration: mood === 'think' ? 1.6 : 3, repeat: Infinity, ease: 'easeInOut' }
      }
    >
      <line x1="20" y1="4" x2="20" y2="9" stroke="var(--accent-2)" strokeWidth="1.6" />
      <motion.circle
        cx="20"
        cy="3.5"
        r={happy ? 3.2 : 2.4}
        fill="var(--accent)"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: happy ? 0.3 : 1.4, repeat: Infinity }}
      />
      <rect x="5" y="17" width="3" height="7" rx="1.5" fill="var(--accent-2)" />
      <rect x="32" y="17" width="3" height="7" rx="1.5" fill="var(--accent-2)" />
      <rect x="6.5" y="8.5" width="27" height="24" rx="11" fill="#eef7fa" />
      <rect x="10" y="13" width="20" height="14" rx="7" fill="#03141f" />
      <motion.g style={{ x: lookX, y: lookY }}>
        {happy
          ? [15, 25].map((cx) => (
              <path
                key={cx}
                d={`M${cx - 2.6} 21.2q2.6-4 5.2 0`}
                stroke="var(--accent)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            ))
          : [15, 25].map((cx) => (
              <motion.rect
                key={cx}
                x={cx - 2}
                width="4"
                rx="2"
                fill="var(--accent)"
                initial={false}
                animate={{ height: [eyeH, eyeH, 0.6, eyeH], y: [20 - eyeH / 2, 20 - eyeH / 2, 19.7, 20 - eyeH / 2] }}
                transition={{ duration: 4, repeat: Infinity, times: [0, 0.9, 0.95, 1] }}
              />
            ))}
        {mood === 'sad' && !happy && (
          <path d="M16 25.5q4-2.5 8 0" stroke="var(--accent)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        )}
      </motion.g>
    </motion.svg>
  )
}
