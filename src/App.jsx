import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getSuggestions,
  getUsage,
  requestBrowserLocation,
  reverseGeocode,
  sendChat,
} from './api/chat'
import { useTheme } from './useTheme'
import { useWallpaper } from './useWallpaper'
import { useSessions } from './useSessions'
import Markdown from './components/Markdown'
import PlaceCard from './components/PlaceCard'
import Sidebar from './components/Sidebar'
import WallpaperPicker from './components/WallpaperPicker'

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

export default function App() {
  const [messages, setMessages] = useState([INTRO_MESSAGE(FALLBACK_GREETING)])
  const [suggestions, setSuggestions] = useState(FALLBACK_SUGGESTIONS)
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [usage, setUsage] = useState(null)
  const wallpaper = useWallpaper()
  const sessions = useSessions()
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const refreshUsage = useCallback(() => {
    getUsage()
      .then(setUsage)
      .catch(() => {
        /* sidebar just hides the meter */
      })
  }, [])

  useEffect(refreshUsage, [refreshUsage])

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

  async function submit(text) {
    let trimmed = text.trim()
    if (!trimmed || loading) return

    // Typing "2" picks the second choice offered in the last reply.
    const lastOptions = messages[messages.length - 1]?.options
    if (/^[1-9]$/.test(trimmed) && lastOptions?.[Number(trimmed) - 1]) {
      trimmed = lastOptions[Number(trimmed) - 1]
    }

    setError(null)
    setInput('')
    const withUser = [...messages, { role: 'user', text: trimmed, sources: [], places: [] }]
    setMessages(withUser)
    setLoading(true)

    try {
      const res = await sendChat(trimmed, sessionId, location)
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
        },
      ]
      setMessages(withReply)
      // Persist the conversation locally and refresh the plan meter.
      sessions.upsert(res.session_id, withReply)
      refreshUsage()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function newChat() {
    sessions.startNew()
    setSessionId(null)
    setMessages([INTRO_MESSAGE(FALLBACK_GREETING)])
    setError(null)
    setSidebarOpen(false)
  }

  function openSession(id) {
    sessions.setActiveId(id)
    setSidebarOpen(false)
  }

  const showSuggestions = messages.length === 1 && !loading

  return (
    <>
      {/* Custom background layer. Sits above the CSS default (body::before) so
          a chosen wallpaper replaces the drifting orbs rather than mixing. */}
      {wallpaper.style && (
        <div
          className="fixed inset-0 z-0"
          style={{ backgroundColor: 'var(--ground)', ...wallpaper.style }}
        />
      )}

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
        />

        <div className="flex flex-1 items-center justify-center p-3 sm:p-6 lg:p-0">
          <div
            className="glass flex h-full w-full max-w-3xl flex-col overflow-hidden"
            style={{
              borderRadius: 'var(--radius)',
              // A photo behind translucent glass makes text unreadable, so the
              // panel goes near-opaque whenever a custom image is in use.
              ...(wallpaper.id === 'custom'
                ? { background: 'var(--panel-solid)', opacity: 0.97 }
                : null),
            }}
          >
            <Header
              location={location}
              locating={locating}
              onLocate={useMyLocation}
              wallpaper={wallpaper}
              onMenu={() => setSidebarOpen(true)}
            />

            <main
              ref={scrollRef}
              className="thin-scroll flex-1 overflow-y-auto px-5 py-6 sm:px-7"
            >
              <div className="flex flex-col gap-6">
                {messages.map((msg, i) => (
                  <Message
                    key={i}
                    msg={msg}
                    // Tap choices only make sense on the newest reply, and only
                    // while we're not already waiting on an answer.
                    onPick={i === messages.length - 1 && !loading ? submit : null}
                  />
                ))}

                {loading && <Thinking />}

                {showSuggestions && (
                  <div className="flex flex-col gap-2.5 pt-2">
                    <Label>Try asking</Label>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s) => (
                        <SuggestionChip key={s} onClick={() => submit(s)}>
                          {s}
                        </SuggestionChip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </main>

            <Composer
              input={input}
              setInput={setInput}
              onSubmit={submit}
              loading={loading}
              error={error}
              located={Boolean(location)}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function Label({ children }) {
  return (
    <p
      className="text-[10px] tracking-[0.16em] uppercase"
      style={{ color: 'var(--ink-faint)', fontWeight: 600 }}
    >
      {children}
    </p>
  )
}

function SuggestionChip({ children, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="rounded-full px-3.5 py-1.5 text-[13px] transition-all duration-200"
      style={{
        border: `1px solid ${hover ? 'var(--accent)' : 'var(--panel-border)'}`,
        color: hover ? 'var(--ink)' : 'var(--ink-muted)',
        background: hover ? 'var(--accent-quiet)' : 'transparent',
        boxShadow: hover ? 'var(--glow-accent)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

function Header({ location, locating, onLocate, wallpaper, onMenu }) {
  const { theme, cycle } = useTheme()
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <header
      className="relative flex items-center justify-between gap-3 px-5 py-4 sm:px-7"
      style={{ borderBottom: '1px solid var(--panel-border)' }}
    >
      <div className="flex items-center gap-2.5">
        <button
          onClick={onMenu}
          aria-label="Open sidebar"
          className="flex h-8 w-8 items-center justify-center rounded-lg lg:hidden"
          style={{ border: '1px solid var(--panel-border)', color: 'var(--ink-muted)' }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <Compass />
        <div className="flex flex-col">
          <h1
            className="text-[17px] leading-none tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)' }}
          >
            TourFinderApp
          </h1>
          <span
            className="mt-0.5 hidden text-[9px] tracking-[0.16em] uppercase sm:inline"
            style={{ color: 'var(--ink-faint)', fontWeight: 600 }}
          >
            World tourism guide
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {location ? (
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px]"
            style={{
              background: 'var(--geo-quiet)',
              color: 'var(--geo)',
              fontWeight: 500,
              border: '1px solid var(--panel-border)',
              boxShadow: 'var(--glow-cyan)',
            }}
          >
            <Pin />
            <span className="hidden sm:inline">{location.city || location.name}</span>
          </span>
        ) : (
          <IconButton onClick={onLocate} disabled={locating} label="Use my location">
            <Pin />
          </IconButton>
        )}

        <IconButton onClick={cycle} label={`Theme: ${theme}. Click to change.`}>
          <ThemeIcon theme={theme} />
        </IconButton>

        <IconButton onClick={() => setPickerOpen((o) => !o)} label="Change background">
          <PaletteIcon />
        </IconButton>
      </div>

      {pickerOpen && (
        <div className="absolute top-full right-5 sm:right-7">
          <WallpaperPicker
            id={wallpaper.id}
            setId={wallpaper.setId}
            customUrl={wallpaper.customUrl}
            setCustomUrl={wallpaper.setCustomUrl}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      )}
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
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-40"
      style={{
        border: `1px solid ${hover ? 'var(--accent)' : 'var(--panel-border)'}`,
        color: hover ? 'var(--accent)' : 'var(--ink-muted)',
        boxShadow: hover ? 'var(--glow-accent)' : 'none',
      }}
    >
      {children}
    </button>
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

function Message({ msg, onPick }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] px-4 py-2.5 text-[14px] leading-relaxed"
          style={{
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            fontWeight: 500,
            borderRadius: '16px 16px 4px 16px',
            boxShadow: 'var(--glow-accent)',
          }}
        >
          {msg.text}
        </div>
      </div>
    )
  }

  if (msg.intro) {
    return (
      <p
        className="text-[19px] leading-snug"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          color: 'var(--ink)',
          maxWidth: '32ch',
          textWrap: 'balance',
        }}
      >
        {msg.text}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {msg.intent && INTENT_LABELS[msg.intent] && (
        <span
          className="self-start rounded px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase"
          style={{
            background: 'var(--accent-quiet)',
            color: 'var(--accent)',
            fontWeight: 700,
            border: '1px solid var(--panel-border)',
          }}
        >
          {INTENT_LABELS[msg.intent]}
        </span>
      )}

      <div className="flex justify-start">
        <div
          className="glass max-w-[88%] px-4 py-3"
          style={{
            color: 'var(--ink-muted)',
            borderRadius: '16px 16px 16px 4px',
          }}
        >
          <Markdown text={msg.text} />
        </div>
      </div>

      {msg.images?.length > 0 && <ImageGallery images={msg.images} />}

      {msg.places?.length > 0 && <PlaceRail places={msg.places} />}

      {onPick && msg.options?.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Choose one</Label>
          <div className="flex flex-wrap gap-2">
            {msg.options.map((o) => (
              <SuggestionChip key={o} onClick={() => onPick(o)}>
                {o}
              </SuggestionChip>
            ))}
          </div>
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
                  className="text-[12px] underline decoration-dotted underline-offset-2"
                  style={{ color: 'var(--accent-2)' }}
                >
                  {s.label}
                </a>
              ) : (
                <span key={i} className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                  {s.label}
                </span>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Places break out of the prose column into a horizontal rail — results are
 * browsed, not read in sequence, so they get scanning affordance.
 */
/** Photos from Wikimedia Commons. Each links to its Commons page, which carries the credit and licence. */
function ImageGallery({ images }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Photos</Label>
      <div className="thin-scroll flex snap-x gap-2 overflow-x-auto pb-1">
        {images.map((img) => (
          <a
            key={img.thumb_url}
            href={img.page_url}
            target="_blank"
            rel="noreferrer noopener"
            title={`${img.title}${img.license ? ` · ${img.license}` : ''} — Wikimedia Commons`}
            className="glass relative h-36 w-56 shrink-0 snap-start overflow-hidden"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <img
              src={img.thumb_url}
              alt={img.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <span
              className="absolute right-0 bottom-0 left-0 truncate px-2 py-0.5 text-[9.5px]"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
            >
              {img.license ?? 'Wikimedia Commons'}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

function PlaceRail({ places }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        {places.length} {places.length === 1 ? 'place' : 'places'} found
      </Label>
      <div className="thin-scroll -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-7 sm:px-7">
        {places.map((p, i) => (
          <PlaceCard key={p.maps_uri || `${p.name}-${i}`} place={p} />
        ))}
      </div>
    </div>
  )
}

function Thinking() {
  return (
    <div className="flex items-center gap-2" style={{ color: 'var(--accent)' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: 'currentColor',
            boxShadow: 'var(--glow-accent)',
            animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
      <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
        Searching
      </span>
      <style>{`@keyframes bounce{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
    </div>
  )
}

function Composer({ input, setInput, onSubmit, loading, error, located }) {
  const [focus, setFocus] = useState(false)
  return (
    <div className="px-5 pb-5 sm:px-7" style={{ borderTop: '1px solid var(--panel-border)' }}>
      {error && (
        <p className="pt-3 text-[12px]" style={{ color: 'var(--closed)' }}>
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(input)
        }}
        className="flex items-center gap-2 pt-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={located ? 'Ask about here, or anywhere…' : 'Ask about a destination…'}
          className="flex-1 rounded-full px-4 py-2.5 text-[14px] transition-all duration-200 outline-none"
          style={{
            background: 'var(--panel)',
            border: `1px solid ${focus ? 'var(--accent)' : 'var(--panel-border)'}`,
            color: 'var(--ink)',
            boxShadow: focus ? 'var(--glow-accent)' : 'none',
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-30"
          style={{
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            boxShadow: input.trim() && !loading ? 'var(--glow-accent)' : 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2.5 8h10M8.5 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  )
}
