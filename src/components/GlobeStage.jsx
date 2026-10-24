import { forwardRef } from 'react'

/**
 * The empty column the globe is drawn over (wide screens only). It owns the
 * drag gesture and writes deltas into `drag`, which the WebGL scene consumes
 * each frame — the canvas itself stays pointer-inert so it never steals clicks.
 */
const GlobeStage = forwardRef(function GlobeStage({ drag, reveal }, ref) {
  function down(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current.active = true
    drag.current.x = e.clientX
    drag.current.y = e.clientY
  }
  function move(e) {
    const d = drag.current
    if (!d.active) return
    d.dx += e.clientX - d.x
    d.dy += e.clientY - d.y
    d.x = e.clientX
    d.y = e.clientY
  }
  function up() {
    drag.current.active = false
    drag.current.last = performance.now()
  }

  return (
    <div
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={`cursor-grab touch-none select-none active:cursor-grabbing ${
        // `reveal` lifts the stage to full screen on any width, so phones get
        // the real globe for a moment; the scene re-measures and moves into it.
        reveal
          ? 'fixed inset-0 z-30 block bg-ground/80 backdrop-blur-md'
          : 'relative hidden w-[30%] max-w-[480px] shrink-0 xl:block'
      }`}
      aria-label="Interactive globe. Drag to spin."
      role="img"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-1">
        <span className="text-[10px] tracking-[0.16em] text-ink-faint uppercase">Drag to spin</span>
      </div>
    </div>
  )
})

export default GlobeStage
