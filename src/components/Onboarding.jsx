import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { INTERESTS, STYLES } from '../usePrefs'
import Appearance from './Appearance'

// Shares the three.js chunk with the globe, so it costs nothing extra once loaded.
const Mobot = lazy(() => import('./Mobot'))

/*
 * First-visit flow: name → interests → travel style → look → location.
 * Every step is optional and changes apply live (the accent and theme repaint
 * the page behind the dialog), so the visitor sees what they're choosing.
 */

const STEPS = ['hello', 'interests', 'style', 'look', 'location']

const slide = {
  enter: (dir) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir * -40, opacity: 0 }),
}

export default function Onboarding({ prefs, update, appearance, place, precise, locating, onLocate, onClose }) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [hop, setHop] = useState(0)
  const last = step === STEPS.length - 1

  const go = (n) => {
    setDir(n > step ? 1 : -1)
    setStep(n)
  }
  const finish = () => {
    update({ onboarded: true })
    onClose()
  }

  useEffect(() => {
    const key = (e) => e.key === 'Escape' && finish()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const toggleInterest = (id) => {
    setHop((h) => h + 1)
    update({
      interests: prefs.interests.includes(id)
        ? prefs.interests.filter((i) => i !== id)
        : [...prefs.interests, id],
    })
  }

  const hi = prefs.name ? `, ${prefs.name}` : ''
  const lines = {
    hello: ["Hi! I'm Mobot 👋", 'Your travel buddy. Let me get to know you.', 'wave'],
    interests: [
      `Nice to meet you${hi}!`,
      prefs.interests.length
        ? `${prefs.interests.length} picked — great taste. Any more?`
        : 'What gets you excited on a trip?',
      prefs.interests.length ? 'happy' : 'think',
    ],
    style: ['How do you like to travel?', 'No judgement — I love a good hostel too.', 'think'],
    look: ['Make it yours!', "Pick a colour — I'll wear it too. Got a favourite trip photo? Use it.", 'happy'],
    location: [
      precise ? 'Got you on the map! 📍' : 'Last one!',
      precise ? 'I can find things right around you now.' : 'Want picks near where you are?',
      precise ? 'happy' : 'wave',
    ],
  }
  const [say, sub, mood] = lines[STEPS[step]]

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ground/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Personalise your guide"
        initial={{ y: 40, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="glass flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
      >
        {/* Progress */}
        <div className="flex items-center gap-3 px-6 pt-5">
          <div className="flex flex-1 gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => go(i)}
                aria-label={`Step ${i + 1}`}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
              >
                <motion.span
                  className="block h-full rounded-full bg-accent"
                  animate={{ width: i <= step ? '100%' : '0%' }}
                  transition={{ duration: 0.35 }}
                />
              </button>
            ))}
          </div>
          <button onClick={() => { setHop((h) => h + 1); finish() }} className="text-[12px] font-medium text-ink-faint hover:text-ink">
            Skip
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 pt-2">
          <Suspense fallback={<div className="h-[118px] w-[118px] shrink-0" />}>
            <Mobot mood={mood} hop={hop} size={118} />
          </Suspense>
          <AnimatePresence mode="wait">
            <motion.div
              key={say + sub}
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="relative rounded-2xl rounded-bl-sm border border-accent/30 bg-accent/10 px-4 py-2.5"
            >
              <p className="font-heading text-[15px] font-bold text-ink">{say}</p>
              <p className="text-[12.5px] font-light text-ink-muted">{sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="thin-scroll relative flex-1 overflow-y-auto px-6 pt-3 pb-6">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex flex-col gap-5"
            >
              {STEPS[step] === 'hello' && (
                <>
                  <Heading kicker="Welcome aboard" title={<>Let's tailor your <em className="font-serif font-normal text-accent">guide</em>.</>}>
                    Five quick taps and Mobot will know what you love, how you like to travel and where you are.
                    Everything stays on this device.
                  </Heading>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
                      What should I call you? <span className="font-normal normal-case tracking-normal">(optional)</span>
                    </span>
                    <input
                      autoFocus
                      value={prefs.name}
                      maxLength={30}
                      onChange={(e) => update({ name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && go(1)}
                      placeholder="Your first name"
                      className="rounded-xl border border-line bg-panel px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:shadow-glow"
                    />
                  </label>
                </>
              )}

              {STEPS[step] === 'interests' && (
                <>
                  <Heading kicker="Step 2 of 5" title={<>What makes a trip <em className="font-serif font-normal text-accent">great</em> for you?</>}>
                    Pick as many as you like — your home screen suggestions follow these.
                  </Heading>
                  <div className="grid grid-cols-2 gap-2">
                    {INTERESTS.map((it) => {
                      const on = prefs.interests.includes(it.id)
                      return (
                        <motion.button
                          key={it.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleInterest(it.id)}
                          aria-pressed={on}
                          className={`relative flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition-colors ${
                            on ? 'border-accent bg-accent/12 text-ink' : 'border-line text-ink-muted hover:border-accent/50 hover:bg-accent/5'
                          }`}
                        >
                          <span className="text-[22px] leading-none">{it.emoji}</span>
                          <span className="text-[13px] font-medium">{it.label}</span>
                          <AnimatePresence>
                            {on && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-on-accent"
                              >
                                ✓
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      )
                    })}
                  </div>
                </>
              )}

              {STEPS[step] === 'style' && (
                <>
                  <Heading kicker="Step 3 of 5" title={<>How do you like to <em className="font-serif font-normal text-accent">travel</em>?</>}>
                    I'll lean recommendations toward this budget.
                  </Heading>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLES.map((s) => {
                      const on = prefs.style === s.id
                      return (
                        <motion.button
                          key={s.id}
                          whileHover={{ y: -3 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => {
                            setHop((h) => h + 1)
                            update({ style: s.id })
                          }}
                          aria-pressed={on}
                          className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-4 text-center transition-colors ${
                            on ? 'border-accent bg-accent/12 shadow-glow' : 'border-line hover:border-accent/50'
                          }`}
                        >
                          <span className="text-[30px] leading-none">{s.emoji}</span>
                          <span className="font-heading text-[14px] font-semibold text-ink">{s.label}</span>
                          <span className="text-[11px] font-light text-ink-faint">{s.blurb}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                </>
              )}

              {STEPS[step] === 'look' && (
                <>
                  <Heading kicker="Step 4 of 5" title={<>Make it <em className="font-serif font-normal text-accent">yours</em>.</>}>
                    Theme, colour and background — even your own photo. Changes apply instantly behind this card.
                  </Heading>
                  <Appearance
                    {...appearance}
                    setAccent={(id) => {
                      setHop((h) => h + 1)
                      appearance.setAccent(id)
                    }}
                  />
                  {/* Live preview of the chosen accent on real components. */}
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line p-3">
                    <span className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-on-accent shadow-glow">Ask</span>
                    <span className="rounded-full border border-accent/60 bg-accent/10 px-3 py-1.5 text-[12px] text-ink">Cheap eats</span>
                    <span className="text-[12px] text-accent-2 underline decoration-dotted">a link</span>
                    <span className="ml-auto font-serif text-[15px] italic text-accent">Bon voyage</span>
                  </div>
                </>
              )}

              {STEPS[step] === 'location' && (
                <>
                  <Heading kicker="Last step" title={<>Where are you <em className="font-serif font-normal text-accent">right now</em>?</>}>
                    {place
                      ? `I think you're around ${place}${precise ? '' : ' (from your network)'}. Share your location for street-level picks — it's only used to answer you.`
                      : 'Share your location for picks around you. It is only used to answer your questions.'}
                  </Heading>
                  {precise ? (
                    <p className="rounded-2xl border border-geo/40 bg-geo/10 px-4 py-3 text-[14px] font-medium text-geo">
                      📍 Located — {place}
                    </p>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={onLocate}
                      disabled={locating}
                      className="rounded-2xl border border-geo/50 bg-geo/10 px-4 py-3 text-[14px] font-semibold text-geo transition-colors hover:bg-geo/20 disabled:opacity-60"
                    >
                      {locating ? 'Locating…' : '📍 Use my location'}
                    </motion.button>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <button
            onClick={() => go(step - 1)}
            disabled={step === 0}
            className="text-[13px] font-medium text-ink-muted hover:text-ink disabled:invisible"
          >
            ← Back
          </button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={last ? finish : () => go(step + 1)}
            className="rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-on-accent shadow-glow"
          >
            {last ? (prefs.name ? `Let's go, ${prefs.name}` : 'Start exploring') : 'Continue →'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Heading({ kicker, title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">{kicker}</span>
      <h2 className="font-heading text-[26px] leading-[1.1] font-bold tracking-tight text-balance text-ink">{title}</h2>
      <p className="text-[14px] leading-relaxed font-light text-ink-muted">{children}</p>
    </div>
  )
}
