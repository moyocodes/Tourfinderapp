import { useEffect, useRef } from 'react'
import Appearance from './Appearance'

/**
 * The header's palette popover — the same controls as onboarding's "look"
 * step, so the chat and the slideshow always offer the same choices.
 */
export default function WallpaperPicker({ onClose, ...appearance }) {
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

  return (
    <div
      ref={ref}
      className="glass thin-scroll absolute top-12 right-0 z-30 max-h-[75dvh] w-[320px] overflow-y-auto rounded-2xl bg-panel-solid/90 p-4"
    >
      <p className="font-heading mb-3 text-[15px] font-bold text-ink">Appearance</p>
      <Appearance compact {...appearance} />
    </div>
  )
}
