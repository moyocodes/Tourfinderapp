import { motion } from 'framer-motion'

/*
 * Mobot's face as a lightweight SVG, for places where a WebGL canvas per
 * message would be overkill: chat avatars, the thinking indicator, errors.
 * Matches the 3D Mobot — white shell, dark visor, accent eyes and antenna.
 */
export default function MobotFace({ size = 32, mood = 'idle' }) {
  const eyeH = mood === 'think' ? 3 : mood === 'sad' ? 2.5 : 7
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
      animate={mood === 'think' ? { rotate: [-6, 6, -6] } : { y: [0, -1.5, 0] }}
      transition={{ duration: mood === 'think' ? 1.6 : 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <line x1="20" y1="4" x2="20" y2="9" stroke="var(--accent-2)" strokeWidth="1.6" />
      <motion.circle
        cx="20"
        cy="3.5"
        r="2.4"
        fill="var(--accent)"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      <rect x="5" y="17" width="3" height="7" rx="1.5" fill="var(--accent-2)" />
      <rect x="32" y="17" width="3" height="7" rx="1.5" fill="var(--accent-2)" />
      <rect x="6.5" y="8.5" width="27" height="24" rx="11" fill="#eef7fa" />
      <rect x="10" y="13" width="20" height="14" rx="7" fill="#03141f" />
      {[15, 25].map((cx) => (
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
      {mood === 'sad' && <path d="M16 25.5q4-2.5 8 0" stroke="var(--accent)" strokeWidth="1.3" fill="none" strokeLinecap="round" />}
    </motion.svg>
  )
}
