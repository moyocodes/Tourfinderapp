import { motion } from 'framer-motion'
import { INTERESTS, STYLES } from '../usePrefs'
import { Illustration } from './Illustrations'

/*
 * First screen. Shows what the app is for by example: one tile per thing it
 * can answer, each phrased as a ready question about the visitor's own city
 * and travel style. Tiles the visitor said they care about come first, and a
 * "For you" row turns their onboarding interests into one-tap questions.
 */

// Literal class strings per hue so Tailwind can see them at build time.
const HUES = {
  orange: { tile: 'bg-panel-solid/80 bg-gradient-to-br from-orange-500/15 to-orange-500/[0.04] border-orange-500/30 hover:border-orange-500/70 hover:from-orange-500/25', ink: 'text-orange-500', chip: 'bg-orange-500/15' },
  amber: { tile: 'bg-panel-solid/80 bg-gradient-to-br from-amber-500/15 to-amber-500/[0.04] border-amber-500/30 hover:border-amber-500/70 hover:from-amber-500/25', ink: 'text-amber-500', chip: 'bg-amber-500/15' },
  sky: { tile: 'bg-panel-solid/80 bg-gradient-to-br from-sky-500/15 to-sky-500/[0.04] border-sky-500/30 hover:border-sky-500/70 hover:from-sky-500/25', ink: 'text-sky-500', chip: 'bg-sky-500/15' },
  emerald: { tile: 'bg-panel-solid/80 bg-gradient-to-br from-emerald-500/15 to-emerald-500/[0.04] border-emerald-500/30 hover:border-emerald-500/70 hover:from-emerald-500/25', ink: 'text-emerald-500', chip: 'bg-emerald-500/15' },
  rose: { tile: 'bg-panel-solid/80 bg-gradient-to-br from-rose-500/15 to-rose-500/[0.04] border-rose-500/30 hover:border-rose-500/70 hover:from-rose-500/25', ink: 'text-rose-500', chip: 'bg-rose-500/15' },
}

const CATEGORIES = [
  {
    id: 'food',
    title: 'Food',
    blurb: 'Local dishes & where to eat',
    hue: 'orange',
    likes: ['food', 'nightlife', 'shopping'],
    ask: (c, w) => (c ? `Best ${w === 'luxury' ? 'fine-dining' : 'local'} food to try in ${c}` : 'Best street food in Bangkok'),
  },
  {
    id: 'landmarks',
    title: 'Landmarks',
    blurb: 'Sights worth the trip',
    hue: 'amber',
    likes: ['culture', 'art', 'nature', 'adventure'],
    ask: (c) => (c ? `Must-see landmarks in ${c}` : 'Must-see landmarks in Rome'),
  },
  {
    id: 'transport',
    title: 'Transport',
    blurb: 'Getting around, airport runs',
    hue: 'sky',
    likes: ['adventure'],
    ask: (c) => (c ? `How do I get around ${c}?` : 'How do I get from Narita to Shibuya?'),
  },
  {
    id: 'safety',
    title: 'Safety',
    blurb: 'Areas, scams, night-time',
    hue: 'emerald',
    likes: ['nightlife', 'family'],
    ask: (c) => (c ? `Safety tips for visiting ${c}` : 'Is central Lagos safe at night?'),
  },
  {
    id: 'accommodation',
    title: 'Stay',
    blurb: 'Hotels for every budget',
    hue: 'rose',
    likes: ['family'],
    ask: (c, w) => (c ? `${w[0].toUpperCase() + w.slice(1)} places to stay in ${c}` : `${w[0].toUpperCase() + w.slice(1)} hotels in Lisbon`),
  },
]

function timeGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const list = { show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
}

export default function Welcome({ greeting, place, precise, prefs, onAsk, onDraft, onLocate, locating, onPersonalize, suggestions }) {
  const word = STYLES.find((s) => s.id === prefs.style)?.word ?? 'mid-range'
  const liked = new Set(prefs.interests)
  const score = (c) => c.likes.filter((l) => liked.has(l)).length
  const tiles = [...CATEGORIES].sort((a, b) => score(b) - score(a))
  const forYou = INTERESTS.filter((i) => liked.has(i.id)).slice(0, 4)

  return (
    <motion.div initial="hidden" animate="show" variants={list} className="flex flex-col gap-7">
      <motion.div variants={item} className="flex flex-col gap-2.5">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
          <span className="h-px w-6 bg-accent/60" />
          {timeGreeting()}
          {prefs.name ? `, ${prefs.name}` : ''}
        </p>
        <h2 className="font-heading max-w-[22ch] text-[28px] leading-[1.08] font-bold tracking-tight text-balance text-ink sm:text-[34px]">
          {place ? (
            <>
              Your guide to <em className="font-serif font-normal text-accent">{place}</em>
              <span className="font-light text-ink-muted"> — and everywhere else.</span>
            </>
          ) : (
            <>
              Your guide to <em className="font-serif font-normal text-accent">the world</em>, one question at a time.
            </>
          )}
        </h2>
        <p className="max-w-[48ch] text-[14.5px] leading-relaxed font-light text-ink-muted">{greeting}</p>
      </motion.div>

      {/* For you — or an invitation to tell us what "for you" means. */}
      <motion.div variants={item}>
        {forYou.length ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <SectionLabel>For you{place ? ` in ${place}` : ''}</SectionLabel>
              <button onClick={onPersonalize} className="text-[11.5px] font-medium text-accent hover:underline">
                Edit interests
              </button>
            </div>
            <div className="thin-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {forYou.map((it) => (
                <motion.button
                  key={it.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onAsk(it.ask(place || 'the city I\'m visiting'))}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.08] py-1.5 pr-4 pl-1.5 text-[13px] font-medium text-ink transition-colors hover:border-accent hover:bg-accent/15"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel-solid/70 text-[15px]">{it.emoji}</span>
                  {it.ask(place || 'my destination')}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={onPersonalize}
            className="group flex w-full items-center gap-4 rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/15 via-accent/5 to-transparent p-4 text-left"
          >
            <span className="flex -space-x-2 text-[22px]">
              {['🍜', '🏝️', '🏛️'].map((e) => (
                <span key={e} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel-solid">
                  {e}
                </span>
              ))}
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-heading text-[15px] font-semibold text-ink">Tell me what you love</span>
              <span className="text-[12.5px] font-light text-ink-muted">30 seconds to personal picks, colours and your city.</span>
            </span>
            <span className="text-[18px] text-accent transition-transform group-hover:translate-x-1">→</span>
          </motion.button>
        )}
      </motion.div>

      <motion.div variants={item} className="flex flex-col gap-2.5">
        <SectionLabel>What I can help with{place ? ` in ${place}` : ''}</SectionLabel>
        <motion.div variants={list} className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-3">
          {tiles.map((t, i) => {
            const q = t.ask(place, word)
            const h = HUES[t.hue]
            const pick = score(t) > 0
            return (
              <motion.div
                key={t.id}
                variants={item}
                whileHover="hover"
                className={`group relative flex flex-col gap-2 overflow-hidden rounded-2xl border p-4 transition-colors ${h.tile} ${
                  i === 0 && pick ? 'sm:col-span-2' : ''
                }`}
              >
                {/* The whole tile sends; the pencil only drafts. */}
                <button onClick={() => onAsk(q)} className="absolute inset-0 z-0" aria-label={`Ask: ${q}`} />

                <motion.span
                  variants={{ hover: { scale: 1.12, rotate: -4 } }}
                  className={`pointer-events-none absolute -top-1 -right-1 opacity-90 ${h.ink}`}
                >
                  <Illustration intent={t.id} size={i === 0 && pick ? 76 : 60} />
                </motion.span>

                <span className="pointer-events-none flex flex-wrap items-center gap-2 pr-14">
                  <span className={`font-heading text-[16px] font-bold tracking-tight text-ink`}>{t.title}</span>
                  {pick && (
                    <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold tracking-wider uppercase ${h.chip} ${h.ink}`}>
                      For you
                    </span>
                  )}
                </span>
                <span className="pointer-events-none max-w-[70%] text-[12.5px] text-ink-muted">{t.blurb}</span>
                <span className="pointer-events-none mt-3 font-serif text-[15px] leading-snug text-ink italic">
                  “{q}”
                </span>
                <span className="relative z-10 mt-auto flex items-center justify-between pt-1">
                  <span className={`pointer-events-none text-[12px] font-semibold ${h.ink}`}>
                    Ask <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </span>
                  <button
                    onClick={() => onDraft(q)}
                    title="Edit before sending"
                    aria-label={`Edit "${q}" before sending`}
                    className="rounded-full p-1.5 text-ink-faint opacity-70 transition hover:bg-ink/10 hover:text-ink group-hover:opacity-100"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  </button>
                </span>
              </motion.div>
            )
          })}

          {!precise && (
            <motion.button
              variants={item}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={onLocate}
              disabled={locating}
              className="flex flex-col items-start justify-center gap-1.5 rounded-2xl border border-dashed border-geo/60 bg-panel-solid/80 p-4 text-left transition-colors hover:bg-geo/15 disabled:opacity-60"
            >
              <span className="text-[22px]">📍</span>
              <span className="font-heading text-[15px] font-bold text-geo">{locating ? 'Locating…' : 'Use my location'}</span>
              <span className="text-[12px] leading-snug font-light text-ink-muted">
                Picks for the street you're on, not just the city.
              </span>
            </motion.button>
          )}
        </motion.div>
      </motion.div>

      {suggestions?.length > 0 && (
        <motion.div variants={item} className="flex flex-col gap-2.5">
          <SectionLabel>{place ? `Popular around ${place}` : 'Popular right now'}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <motion.button
                key={s}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onAsk(s)}
                className="rounded-full border border-line bg-panel-solid/75 px-3.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-accent hover:bg-accent/10 hover:text-ink"
              >
                {s}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-[10.5px] font-semibold tracking-[0.16em] text-ink-faint uppercase">{children}</p>
}
