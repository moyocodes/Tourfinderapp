import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import {
  getSuggestions,
  getUsage,
  resolveAssetUrl,
  requestBrowserLocation,
  reverseGeocode,
  sendChat,
  sendFeedback,
} from './api/chat'
import { useTheme } from './useTheme'
import { useWallpaper } from './useWallpaper'
import { useSessions } from './useSessions'
import { useVoice } from './useVoice'
import { usePrefs } from './usePrefs'
import { centroid, coordsOf } from './lib/geo'
import Callout from './components/Callout'
import GlobeStage from './components/GlobeStage'
import Markdown from './components/Markdown'
import PlaceCard from './components/PlaceCard'
import Sidebar, { Icon, MobileToolbar } from './components/Sidebar'
import Onboarding from './components/Onboarding'
import MobotFace from './components/MobotFace'
import WallpaperPicker from './components/WallpaperPicker'
import Welcome from './components/Welcome'

// Three.js is most of the bundle, so the scene loads after the chat has painted.
const Scene = lazy(() => import('./components/Scene'))

const INTRO_MESSAGE = (text) => ({
  role: 'assistant',
  text,
  sources: [],
  places: [],
  intro: true,
})

const FALLBACK_GREETING =
  'Ask me about food, landmarks, transport, safety, or where to stay — anywhere in the world.'

const FALLBACK_SUGGESTIONS = [
  'Cheap eats near the Colosseum',
  'Is it safe to walk around central Lagos at night?',
  'How do I get from Narita Airport to Shibuya?',
  'Budget-friendly hotels in Lisbon',
]

const INTENT_LABELS = {
  food: 'Food',
  landmarks: 'Landmarks',
  transport: 'Transport',
  safety: 'Safety',
  accommodation: 'Stay',
  general: 'General',
}

const spring = { type: 'spring', stiffness: 320, damping: 28 }

export default function App() {
  const [messages, setMessages] = useState([INTRO_MESSAGE(FALLBACK_GREETING)])
  const [suggestions, setSuggestions] = useState(FALLBACK_SUGGESTIONS)
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [location, setLocation] = useState(null)
  // Approximate, from the request IP. Personalises the welcome and seeds the
  // globe; never sent with chat messages (only a shared `location` is).
  const [ipLocation, setIpLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [usage, setUsage] = useState(null)
  const [highlight, setHighlight] = useState(null)
  const wallpaper = useWallpaper()
  const themeCtl = useTheme()
  const { prefs, update: updatePrefs } = usePrefs()
  const [onboarding, setOnboarding] = useState(false)
  const [nudge, setNudge] = useState(false)
  // Full-screen globe moment after locating, for screens with no globe column.
  const [reveal, setReveal] = useState(false)
  const inputRef = useRef(null)
  const sessions = useSessions()
  const scrollRef = useRef(null)
  const stageRef = useRef(null)
  const calloutRef = useRef(null)
  // A question asked by voice gets its answer read aloud.
  const voice = useVoice({ onFinal: (text) => submit(text, { spoken: true }) })
  const drag = useRef({ active: false, x: 0, y: 0, dx: 0, dy: 0, last: 0 })

  // Follow the conversation down — but the welcome screen reads from the top.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const welcome = messages.length === 1 && messages[0].intro && !loading
    el.scrollTo({ top: welcome ? 0 : el.scrollHeight, behavior: welcome ? 'auto' : 'smooth' })
  }, [messages, loading])

  const refreshUsage = useCallback(() => {
    getUsage()
      .then(setUsage)
      .catch(() => {
        /* sidebar just hides the meter */
      })
  }, [])

  useEffect(refreshUsage, [refreshUsage])

  // Personalisation stays out of the way until the visitor goes quiet for five
  // minutes; then Mobot offers it once per visit (setup, or a review later).
  const nudged = useRef(false)
  useEffect(() => {
    let timer
    const reset = () => {
      clearTimeout(timer)
      if (nudged.current) return
      timer = setTimeout(() => {
        nudged.current = true
        setNudge(true)
      }, 5 * 60 * 1000)
    }
    const events = ['pointermove', 'keydown', 'scroll', 'touchstart', 'wheel']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [])

  // Load a saved conversation when the sidebar selection changes.
  useEffect(() => {
    if (sessions.active) {
      setSessionId(sessions.active.id)
      setMessages(sessions.active.messages)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.activeId])

  // Country-level greeting from the request IP — silent, no permission prompt.
  // Only applies while the intro message is still the only thing on screen.
  useEffect(() => {
    let cancelled = false
    getSuggestions()
      .then((geo) => {
        if (cancelled || !geo?.greeting) return
        if (geo.location) setIpLocation(geo.location)
        setSuggestions(geo.suggestions?.length ? geo.suggestions : FALLBACK_SUGGESTIONS)
        setMessages((m) =>
          m.length === 1 && m[0].intro ? [INTRO_MESSAGE(geo.greeting)] : m,
        )
      })
      .catch(() => {
        // Generic greeting is already rendered — nothing to do.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Only runs on an explicit click, so the browser's permission prompt never
  // appears unannounced on page load.
  async function useMyLocation() {
    if (locating) return
    setError(null)
    setLocating(true)
    try {
      const { lat, lng } = await requestBrowserLocation()
      const geo = await reverseGeocode(lat, lng)
      if (geo.location) {
        setLocation(geo.location)
        if (window.innerWidth < 1280) setReveal(true)
        setSuggestions(geo.suggestions?.length ? geo.suggestions : FALLBACK_SUGGESTIONS)
        // Only rewrite the greeting while it's still the only thing on screen;
        // mid-conversation it would silently rewrite history.
        setMessages((m) => (m.length === 1 ? [INTRO_MESSAGE(geo.greeting)] : m))
      } else {
        setError("Couldn't identify that city. Name the place in your question instead.")
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLocating(false)
    }
  }

  /** Turn transport errors into something a traveller can act on. */
  function friendly(e) {
    if (/failed to fetch|networkerror|load failed/i.test(e.message)) {
      return import.meta.env.DEV
        ? "I can't reach my travel brain. Is the backend running on port 8000?"
        : "I can't reach my travel brain right now. Check your connection and try again."
    }
    return e.message
  }

  // Resend the last question after a failure, without duplicating its bubble.
  function retry() {
    const last = messages[messages.length - 1]
    if (last?.role !== 'user') return
    setMessages(messages.slice(0, -1))
    submit(last.text, { base: messages.slice(0, -1) })
  }

  async function submit(text, { spoken = false, base = messages } = {}) {
    let trimmed = text.trim()
    if (!trimmed || loading) return

    // Typing "2" picks the second choice offered in the last reply.
    const lastOptions = base[base.length - 1]?.options
    if (/^[1-9]$/.test(trimmed) && lastOptions?.[Number(trimmed) - 1]) {
      trimmed = lastOptions[Number(trimmed) - 1]
    }

    setError(null)
    setInput('')
    setHighlight(null)
    const withUser = [...base, { role: 'user', text: trimmed, sources: [], places: [] }]
    setMessages(withUser)
    setLoading(true)

    try {
      const started = performance.now()
      const res = await sendChat(trimmed, sessionId, location)
      const latencyMs = Math.round(performance.now() - started)
      setSessionId(res.session_id)
      const withReply = [
        ...withUser,
        {
          role: 'assistant',
          text: res.reply,
          sources: res.sources ?? [],
          places: res.places ?? [],
          options: res.options ?? [],
          images: res.images ?? [],
          intent: res.intent ?? null,
          answeredBy: res.answered_by ?? 'claude',
          destination: res.destination ?? null,
          latencyMs,
          rating: null,
        },
      ]
      setMessages(withReply)
      if (spoken) voice.speak(withReply.length - 1, res.reply)
      // Persist the conversation locally and refresh the plan meter.
      sessions.upsert(res.session_id, withReply)
      refreshUsage()
    } catch (e) {
      setError(friendly(e))
    } finally {
      setLoading(false)
    }
  }

  function rate(index, rating) {
    const msg = messages[index]
    if (!msg || !sessionId || msg.rating === rating) return
    const updated = messages.map((m, i) => (i === index ? { ...m, rating } : m))
    setMessages(updated)
    sessions.upsert(sessionId, updated)
    sendFeedback({
      session_id: sessionId,
      // The backend counts turns by user messages, starting at 0.
      turn_index: messages.slice(0, index).filter((m) => m.role === 'user').length - 1,
      rating,
      intent: msg.intent ?? null,
      answered_by: msg.answeredBy ?? null,
      latency_ms: msg.latencyMs ?? null,
    })
  }

  function newChat() {
    voice.stopSpeaking()
    sessions.startNew()
    setSessionId(null)
    setMessages([INTRO_MESSAGE(FALLBACK_GREETING)])
    setError(null)
    setHighlight(null)
    setSidebarOpen(false)
  }

  function openSession(id) {
    sessions.setActiveId(id)
    setHighlight(null)
    setSidebarOpen(false)
  }

  // --- What the globe shows -------------------------------------------------

  const home = coordsOf(location) ?? coordsOf(ipLocation)
  const placeName = location?.city || location?.name || ipLocation?.city || ipLocation?.country || null

  // What the conversation is about: the latest reply with place cards or a
  // named destination. Follow-ups that have neither keep the globe where it is.
  const topic = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role !== 'assistant' || m.intro) continue
      const pts = (m.places ?? []).map((p) => coordsOf(p.location)).filter(Boolean)
      const dest = coordsOf(m.destination)
      if (pts.length || dest) return { msg: m, pts, point: pts.length ? centroid(pts) : dest }
    }
    return null
  }, [messages])

  const markers = topic?.pts ?? []
  const focus = reveal ? home : (highlight ?? topic?.point ?? home)

  let callout = null
  if (highlight) {
    callout = {
      kicker: INTENT_LABELS[topic?.msg.intent] ?? 'Place',
      title: highlight.name,
      subtitle: highlight.address,
      intent: topic?.msg.intent,
      image: resolveAssetUrl(highlight.photo),
    }
  } else if (topic) {
    const d = topic.msg.destination
    callout = {
      kicker: INTENT_LABELS[topic.msg.intent] ?? 'Destination',
      title: d?.city || d?.name || `${markers.length} places`,
      subtitle: markers.length
        ? `${markers.length} ${markers.length === 1 ? 'place' : 'places'} on the map`
        : d?.country !== (d?.city || d?.name) ? d?.country : null,
      intent: topic.msg.intent,
      image: topic.msg.images?.[0]?.thumb_url ?? null,
    }
  } else if (placeName) {
    callout = { kicker: location ? 'You are here' : 'Near you', title: placeName, intent: 'general' }
  }

  // Shared by the header popover and onboarding, so both show the same controls.
  const appearance = {
    theme: themeCtl.theme,
    setTheme: themeCtl.setTheme,
    accent: prefs.accent,
    setAccent: (accent) => updatePrefs({ accent }),
    wallpaper,
  }

  // A tile's pencil drops its question into the composer to edit first.
  function draft(text) {
    setInput(text)
    requestAnimationFrame(() => {
      const el = inputRef.current
      el?.focus()
      el?.setSelectionRange(text.length, text.length)
    })
  }

  const showWelcome = messages.length === 1 && messages[0].intro && !loading

  return (
    <MotionConfig reducedMotion="user">
      {/* Custom background layer. Sits above the CSS default (body::before) so
          a chosen wallpaper replaces the drifting orbs rather than mixing. */}
      {wallpaper.style && (
        <div className="fixed inset-0 z-0 bg-ground" style={wallpaper.style} />
      )}

      <Suspense fallback={null}>
        <Scene
          stageRef={stageRef}
          calloutRef={calloutRef}
          drag={drag}
          focus={focus}
          home={home}
          markers={markers}
          highlight={highlight}
          raised={reveal}
        />
      </Suspense>

      <div className="relative z-10 flex h-full gap-0 lg:gap-4 lg:p-6">
        <Sidebar
          sessions={sessions.sessions}
          activeId={sessions.activeId}
          onSelect={openSession}
          onNew={newChat}
          onDelete={sessions.remove}
          usage={usage}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={prefs.sidebarCollapsed}
          onToggleCollapse={() => updatePrefs({ sidebarCollapsed: !prefs.sidebarCollapsed })}
          onPersonalize={() => {
            setSidebarOpen(false)
            setOnboarding(true)
          }}
        />

        <div className="flex min-w-0 flex-1 items-center justify-center p-3 pb-24 sm:p-6 sm:pb-24 lg:p-0">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="glass flex h-full w-full max-w-[900px] flex-col overflow-hidden"
            style={{
              borderRadius: 'var(--radius)',
              // A busy photo behind the glass needs more frosting to keep text
              // readable, but still lets the image show through.
              ...(wallpaper.id === 'custom'
                ? {
                    background: 'color-mix(in srgb, var(--panel-solid) 85%, transparent)',
                    backdropFilter: 'blur(24px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(150%)',
                  }
                : null),
            }}
          >
            <Header
              location={location}
              locating={locating}
              onLocate={useMyLocation}
              theme={themeCtl.theme}
              cycleTheme={themeCtl.cycle}
              appearance={appearance}
            />

            <main ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              {showWelcome ? (
                <Welcome
                  greeting={messages[0].text}
                  place={placeName}
                  precise={Boolean(location)}
                  prefs={prefs}
                  onAsk={submit}
                  onDraft={draft}
                  onPersonalize={() => setOnboarding(true)}
                  onLocate={useMyLocation}
                  locating={locating}
                  suggestions={suggestions}
                />
              ) : (
                <div className="flex flex-col gap-6">
                  {messages.map((msg, i) => (
                    <Message
                      key={i}
                      msg={msg}
                      // Tap choices only make sense on the newest reply, and only
                      // while we're not already waiting on an answer.
                      onPick={i === messages.length - 1 && !loading ? submit : null}
                      onRate={sessionId ? (rating) => rate(i, rating) : null}
                      speaking={voice.speakingId === i}
                      onSpeak={
                        voice.canSpeak
                          ? () => (voice.speakingId === i ? voice.stopSpeaking() : voice.speak(i, msg.text))
                          : null
                      }
                      onHoverPlace={(p) => {
                        const c = p && coordsOf(p.location)
                        setHighlight(c ? { ...c, name: p.name, address: p.address, photo: p.photo_url } : null)
                      }}
                    />
                  ))}

                  <AnimatePresence>
                    {loading && <Thinking place={topic?.msg.destination?.city || placeName} />}
                  </AnimatePresence>
                  <AnimatePresence>
                    {error && !loading && <ErrorCard message={error} onRetry={retry} />}
                  </AnimatePresence>
                </div>
              )}
            </main>

            <Composer
              input={input}
              setInput={setInput}
              onSubmit={submit}
              loading={loading}
              error={showWelcome ? error : null}
              located={Boolean(location)}
              voice={voice}
              inputRef={inputRef}
              quick={
                !showWelcome && !loading && !messages[messages.length - 1]?.options?.length
                  ? QUICK[messages.findLast((m) => m.intent)?.intent] ?? QUICK.general
                  : null
              }
            />
          </motion.div>
        </div>

        <GlobeStage ref={stageRef} drag={drag} reveal={reveal} />
      </div>

      <Callout ref={calloutRef} info={callout} />

      <MobileToolbar
        items={[
          { id: 'chats', label: 'Chats', icon: <Icon name="chats" size={18} />, onClick: () => setSidebarOpen(true), active: sidebarOpen },
          { id: 'new', label: 'New', icon: <Icon name="plus" size={18} />, onClick: newChat, active: !sidebarOpen && showWelcome },
          {
            id: 'locate',
            label: location ? 'Located' : 'Near me',
            icon: <Icon name="pin" size={18} />,
            onClick: location ? () => setReveal(true) : useMyLocation,
            disabled: locating,
            active: Boolean(location),
          },
          { id: 'me', label: 'For you', icon: <Icon name="sparkle" size={18} />, onClick: () => setOnboarding(true), active: onboarding },
          {
            id: 'theme',
            label: { light: 'Day', dark: 'Night', system: 'Auto' }[themeCtl.theme],
            icon: <ThemeIcon theme={themeCtl.theme} />,
            onClick: themeCtl.cycle,
          },
        ]}
      />

      <AnimatePresence>
        {reveal && location && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-between px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...spring, delay: 0.5 }}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <span className="flex items-center gap-2 rounded-full border border-geo/40 bg-geo/15 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-geo uppercase">
                <motion.span
                  className="h-2 w-2 rounded-full bg-geo"
                  animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                You are here
              </span>
              <h2 className="font-heading text-[34px] leading-tight font-bold tracking-tight text-ink">
                <em className="font-serif font-normal text-accent">{location.city || location.name}</em>
              </h2>
              {location.country && location.country !== (location.city || location.name) && (
                <p className="text-[15px] font-light text-ink-muted">{location.country}</p>
              )}
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...spring, delay: 0.8 }}
              className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-3"
            >
              <p className="flex items-center gap-2 text-center text-[13px] font-light text-ink-muted">
                <MobotFace size={28} />
                Got you! I'll tailor picks to {location.city || 'your area'}.
              </p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setReveal(false)}
                className="w-full rounded-full bg-accent py-3 text-[15px] font-semibold text-on-accent shadow-glow"
              >
                Start exploring {location.city || ''}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {nudge && !onboarding && (
          <motion.div
            role="dialog"
            aria-label="Personalise suggestion"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={spring}
            className="glass fixed right-4 bottom-24 z-40 flex max-w-sm items-start gap-3 rounded-2xl p-4 lg:bottom-6"
          >
            <MobotFace size={44} />
            <div className="flex flex-col gap-2">
              <p className="font-heading text-[15px] font-bold text-ink">
                {prefs.onboarded ? 'Still into the same things?' : 'Want me to tailor things?'}
              </p>
              <p className="text-[12.5px] leading-snug font-light text-ink-muted">
                {prefs.onboarded
                  ? 'Take a quick look at your interests, style and colours.'
                  : 'A 30-second slideshow and I’ll suggest places you’ll actually love.'}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setNudge(false)
                    setOnboarding(true)
                  }}
                  className="rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-on-accent shadow-glow"
                >
                  {prefs.onboarded ? 'Review' : 'Personalise'}
                </button>
                <button onClick={() => setNudge(false)} className="rounded-full px-3 py-1.5 text-[12.5px] text-ink-muted hover:text-ink">
                  Not now
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {onboarding && (
          <Onboarding
            prefs={prefs}
            update={updatePrefs}
            appearance={appearance}
            place={placeName}
            precise={Boolean(location)}
            locating={locating}
            onLocate={useMyLocation}
            onClose={() => setOnboarding(false)}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}

function Label({ children }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.16em] text-ink-faint uppercase">{children}</p>
  )
}

const chipList = { show: { transition: { staggerChildren: 0.05 } } }
const chipItem = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }

function SuggestionChip({ children, onClick }) {
  return (
    <motion.button
      variants={chipItem}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="rounded-full border border-line px-3.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-accent hover:bg-accent-quiet hover:text-ink hover:shadow-glow"
    >
      {children}
    </motion.button>
  )
}

function Header({ location, locating, onLocate, theme, cycleTheme: cycle, appearance }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <header className="relative flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
      <div className="flex items-center gap-2.5">
        <motion.span
          whileHover={{ rotate: 180 }}
          transition={{ type: 'spring', stiffness: 120, damping: 10 }}
          className="inline-flex"
        >
          <Compass />
        </motion.span>
        <div className="flex flex-col">
          <h1 className="font-heading text-[17px] leading-none font-bold tracking-tight text-ink">
            TourFinderApp
          </h1>
          <span className="mt-0.5 hidden text-[9px] font-semibold tracking-[0.16em] text-ink-faint uppercase sm:inline">
            World tourism guide
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* On small screens location and theme live in the bottom toolbar. */}
        <div className="hidden items-center gap-2 lg:flex">
        <AnimatePresence mode="wait" initial={false}>
          {location ? (
            <motion.span
              key="located"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring}
              className="flex items-center gap-1.5 rounded-full border border-line bg-geo-quiet px-3 py-1.5 text-[12px] font-medium text-geo shadow-glow-cyan"
            >
              <Pin />
              <span className="hidden sm:inline">{location.city || location.name}</span>
            </motion.span>
          ) : (
            <motion.span key="locate" exit={{ opacity: 0, scale: 0.8 }}>
              <IconButton onClick={onLocate} disabled={locating} label="Use my location">
                <motion.span
                  animate={locating ? { y: [0, -3, 0] } : { y: 0 }}
                  transition={locating ? { repeat: Infinity, duration: 0.7 } : undefined}
                  className="inline-flex"
                >
                  <Pin />
                </motion.span>
              </IconButton>
            </motion.span>
          )}
        </AnimatePresence>

        <IconButton onClick={cycle} label={`Theme: ${theme}. Click to change.`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex"
            >
              <ThemeIcon theme={theme} />
            </motion.span>
          </AnimatePresence>
        </IconButton>
        </div>

        <IconButton onClick={() => setPickerOpen((o) => !o)} label="Change background">
          <PaletteIcon />
        </IconButton>
      </div>

      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute top-full right-5 z-20 origin-top-right sm:right-7"
          >
            <WallpaperPicker {...appearance} onClose={() => setPickerOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function PaletteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.6a6.4 6.4 0 0 0 0 12.8c.7 0 1.2-.6 1.2-1.2 0-.4-.15-.7-.4-.95a1.2 1.2 0 0 1 .85-2.05h1.4A3.35 3.35 0 0 0 14.4 6.8C14.4 3.9 11.5 1.6 8 1.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="5.2" cy="6.4" r="0.9" fill="currentColor" />
      <circle cx="8" cy="4.6" r="0.9" fill="currentColor" />
      <circle cx="10.9" cy="6.4" r="0.9" fill="currentColor" />
    </svg>
  )
}

function IconButton({ children, onClick, disabled, label }) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent hover:shadow-glow disabled:opacity-40"
    >
      {children}
    </motion.button>
  )
}

/** Sun / moon / auto — shows which of the three states is active. */
function ThemeIcon({ theme }) {
  if (theme === 'light') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (theme === 'dark') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  // system
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.8" y="3" width="12.4" height="8.4" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 13.8h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function Compass() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="var(--accent-quiet)" />
      <path
        d="M16 5 18.9 13.1 27 16l-8.1 2.9L16 27l-2.9-8.1L5 16l8.1-2.9Z"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="1.7" fill="var(--accent-2)" />
    </svg>
  )
}

function Pin() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5c-2.5 0-4.5 2-4.5 4.5 0 3.4 4.5 8.5 4.5 8.5s4.5-5.1 4.5-8.5c0-2.5-2-4.5-4.5-4.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6" r="1.6" fill="currentColor" />
    </svg>
  )
}

function Message({ msg, onPick, onRate, onHoverPlace, onSpeak, speaking }) {
  if (msg.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 16, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={spring}
        className="flex justify-end"
      >
        <div className="max-w-[80%] rounded-[16px_16px_4px_16px] bg-accent px-4 py-2.5 text-[14px] leading-relaxed font-medium text-on-accent shadow-glow">
          {msg.text}
        </div>
      </motion.div>
    )
  }

  if (msg.intro) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-gradient-to-r from-accent/12 via-accent/5 to-transparent p-4"
      >
        <MobotFace size={44} />
        <div className="flex flex-col">
          <span className="text-[10.5px] font-semibold tracking-[0.14em] text-accent uppercase">Mobot · your guide</span>
          <p className="font-heading text-[16px] leading-snug font-medium text-balance text-ink">{msg.text}</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.05 }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-end gap-2.5">
        <MobotFace size={30} />
        <div className="flex max-w-[88%] flex-col gap-1.5">
          <span className="flex items-center gap-2 pl-1">
            <span className="font-heading text-[12px] font-bold text-ink">Mobot</span>
            {msg.intent && INTENT_LABELS[msg.intent] && (
              <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[9.5px] font-bold tracking-[0.12em] text-accent uppercase">
                {INTENT_LABELS[msg.intent]}
              </span>
            )}
            {msg.destination?.city && (
              <span className="font-serif text-[12px] text-ink-faint italic">· {msg.destination.city}</span>
            )}
          </span>
          <div className="glass rounded-[18px_18px_18px_4px] px-4 py-3 text-ink-muted">
            <Markdown text={msg.text} />
          </div>
        </div>
      </div>

      {msg.images?.length > 0 && <ImageGallery images={msg.images} />}

      {msg.places?.length > 0 && <PlaceRail places={msg.places} onHover={onHoverPlace} />}

      {onPick && msg.options?.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Choose one</Label>
          <motion.div variants={chipList} initial="hidden" animate="show" className="flex flex-wrap gap-2">
            {msg.options.map((o) => (
              <SuggestionChip key={o} onClick={() => onPick(o)}>
                {o}
              </SuggestionChip>
            ))}
          </motion.div>
        </div>
      )}

      {msg.sources?.length > 0 && msg.places?.length === 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Sources</Label>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {msg.sources.map((s, i) =>
              s.uri ? (
                <a
                  key={i}
                  href={s.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-accent-2 underline decoration-dotted underline-offset-2"
                >
                  {s.label}
                </a>
              ) : (
                <span key={i} className="text-[12px] text-ink-faint">
                  {s.label}
                </span>
              ),
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1">
        {onSpeak && <SpeakButton speaking={speaking} onClick={onSpeak} />}
        {onRate && <Feedback rating={msg.rating} onRate={onRate} />}
      </div>
    </motion.div>
  )
}

const THUMB_UP =
  'M5 7v7H2.5V7H5Zm0 0 3-5.5c1 0 1.8.8 1.6 1.8L9.2 6H13a1.5 1.5 0 0 1 1.5 1.8l-1 5A1.5 1.5 0 0 1 12 14H5'
const THUMB_DOWN =
  'M5 9V2H2.5v7H5Zm0 0 3 5.5c1 0 1.8-.8 1.6-1.8L9.2 10H13a1.5 1.5 0 0 0 1.5-1.8l-1-5A1.5 1.5 0 0 0 12 2H5'

/** Read a reply aloud; while it plays, shows live bars and stops on click. */
function SpeakButton({ speaking, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={speaking ? 'Stop reading' : 'Read aloud'}
      aria-pressed={speaking}
      title={speaking ? 'Stop reading' : 'Read aloud'}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.85 }}
      className={`flex h-[26px] items-center gap-[2px] rounded-full px-1.5 transition-colors ${
        speaking ? 'bg-accent-quiet text-accent' : 'text-ink-faint hover:text-ink-muted'
      }`}
    >
      {speaking ? (
        [0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="w-[2px] rounded-full bg-current"
            animate={{ height: [4, 12, 6, 10, 4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
          />
        ))
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2.5 6v4h2.5l3.5 3V3L5 6H2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6 6 0 0 1 0 8.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </motion.button>
  )
}

/** Thumbs up/down under a reply. Ratings feed the backend's quality metrics. */
function Feedback({ rating, onRate }) {
  return (
    <div className="flex items-center gap-1">
      {[
        ['up', 'Helpful', THUMB_UP],
        ['down', 'Not helpful', THUMB_DOWN],
      ].map(([value, label, path]) => {
        const active = rating === value
        return (
          <motion.button
            key={value}
            onClick={() => onRate(value)}
            aria-label={label}
            aria-pressed={active}
            title={label}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.8, rotate: value === 'up' ? -12 : 12 }}
            animate={active ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            className={`rounded-full p-1.5 transition-colors ${
              active ? 'bg-accent-quiet text-accent' : 'text-ink-faint hover:text-ink-muted'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d={path} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )
      })}
      <AnimatePresence>
        {rating && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-[11px] text-ink-faint"
          >
            Thanks for the feedback
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

const railList = { show: { transition: { staggerChildren: 0.06 } } }
const railItem = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
}

/** Photos from Wikimedia Commons. Each links to its Commons page, which carries the credit and licence. */
function ImageGallery({ images }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Photos</Label>
      <motion.div
        variants={railList}
        initial="hidden"
        animate="show"
        className="thin-scroll flex snap-x gap-2 overflow-x-auto pb-1"
      >
        {images.map((img) => (
          <motion.a
            key={img.thumb_url}
            variants={railItem}
            whileHover={{ y: -3 }}
            href={img.page_url}
            target="_blank"
            rel="noreferrer noopener"
            title={`${img.title}${img.license ? ` · ${img.license}` : ''} — Wikimedia Commons`}
            className="glass group relative h-36 w-56 shrink-0 snap-start overflow-hidden"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <img
              src={img.thumb_url}
              alt={img.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute right-0 bottom-0 left-0 truncate bg-black/55 px-2 py-0.5 text-[9.5px] text-white">
              {img.license ?? 'Wikimedia Commons'}
            </span>
          </motion.a>
        ))}
      </motion.div>
    </div>
  )
}

/**
 * Places break out of the prose column into a horizontal rail — results are
 * browsed, not read in sequence, so they get scanning affordance. Hovering a
 * card flies the globe to it.
 */
function PlaceRail({ places, onHover }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        {places.length} {places.length === 1 ? 'place' : 'places'} found
      </Label>
      <motion.div
        variants={railList}
        initial="hidden"
        animate="show"
        onMouseLeave={() => onHover(null)}
        className="thin-scroll -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-7 sm:px-7"
      >
        {places.map((p, i) => (
          <motion.div key={p.maps_uri || `${p.name}-${i}`} variants={railItem} className="flex shrink-0 snap-start">
            <PlaceCard place={p} onHover={onHover} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

const QUICK = {
  food: ['Cheaper options', 'Vegetarian spots', 'Open late'],
  landmarks: ['Opening hours', 'Hidden gems', 'Best time to visit'],
  transport: ['From the airport', 'Is it walkable?', 'Taxi or ride-hailing?'],
  safety: ['Safe areas to stay', 'Common scams', 'Emergency numbers'],
  accommodation: ['Near the centre', 'Under $100', 'With a pool'],
  general: ['What should I eat?', 'Top sights', 'Getting around'],
}

/** Mobot at work, narrating plausible steps so the wait feels like progress. */
function Thinking({ place }) {
  const steps = [
    'Reading your question…',
    place ? `Searching local spots in ${place}…` : 'Searching local spots…',
    'Checking reviews and opening hours…',
    'Putting it all together…',
  ]
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 1600)
    return () => clearInterval(t)
  }, [steps.length])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2.5"
    >
      <MobotFace size={30} mood="think" />
      <div className="glass flex items-center gap-2.5 rounded-[18px_18px_18px_4px] px-4 py-2.5">
        <span className="flex gap-1 text-accent">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              animate={{ y: [0, -4, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.15, ease: 'easeInOut' }}
              className="h-1.5 w-1.5 rounded-full bg-current"
            />
          ))}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-[13px] font-light text-ink-muted"
          >
            {steps[i]}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function ErrorCard({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-closed/30 bg-closed/[0.08] p-3.5"
    >
      <MobotFace size={36} mood="sad" />
      <p className="flex-1 text-[13px] leading-snug text-ink-muted">{message}</p>
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={onRetry}
        className="shrink-0 rounded-full border border-closed/40 px-3.5 py-1.5 text-[12.5px] font-semibold text-closed transition-colors hover:bg-closed/10"
      >
        ↻ Retry
      </motion.button>
    </motion.div>
  )
}

function Composer({ input, setInput, onSubmit, loading, error, located, voice, inputRef, quick }) {
  const ready = input.trim() && !loading
  return (
    <div className="border-t border-line px-5 pb-5 sm:px-7">
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-3 text-[12px] text-closed"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {quick && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={chipList}
          className="thin-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pt-3"
        >
          {quick.map((q) => (
            <motion.button
              key={q}
              variants={chipItem}
              whileTap={{ scale: 0.94 }}
              onClick={() => onSubmit(q)}
              className="shrink-0 rounded-full border border-line bg-panel/50 px-3 py-1 text-[12px] font-medium whitespace-nowrap text-ink-muted transition-colors hover:border-accent hover:bg-accent/10 hover:text-ink"
            >
              {q}
            </motion.button>
          ))}
        </motion.div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(input)
        }}
        className="flex items-center gap-2 pt-3"
      >
        {voice.canListen && (
          <motion.button
            type="button"
            onClick={voice.listen}
            disabled={loading}
            aria-label={voice.listening ? 'Stop listening' : 'Ask by voice'}
            aria-pressed={voice.listening}
            title={voice.listening ? 'Stop listening' : 'Ask by voice — the answer is read aloud'}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
              voice.listening
                ? 'border-accent bg-accent text-on-accent'
                : 'border-line text-ink-muted hover:border-accent hover:text-accent'
            }`}
          >
            {voice.listening && (
              <motion.span
                className="absolute inset-0 rounded-full bg-accent"
                animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="relative">
              <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.button>
        )}
        <input
          ref={inputRef}
          value={voice.listening ? voice.interim : input}
          readOnly={voice.listening}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            voice.listening ? 'Listening…' : located ? 'Ask about here, or anywhere…' : 'Ask about a destination…'
          }
          className="flex-1 rounded-full border border-line bg-panel px-4 py-2.5 text-[14px] text-ink transition-all duration-200 outline-none placeholder:text-ink-faint focus:border-accent focus:shadow-glow"
        />
        <motion.button
          type="submit"
          disabled={!ready}
          aria-label="Send message"
          whileHover={ready ? { scale: 1.08 } : undefined}
          whileTap={ready ? { scale: 0.9 } : undefined}
          animate={{ opacity: ready ? 1 : 0.35 }}
          className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent ${
            ready ? 'shadow-glow' : ''
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            <path
              d="M2.5 8h10M8.5 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
      </form>
    </div>
  )
}
