import { resolveAssetUrl } from '../api/chat'

/**
 * A single place result, styled as a ticket stub: photo above, details below,
 * with a perforated edge separating them.
 */

/** Google's price levels are 0-4; show them the way a guidebook would. */
function priceLabel(level) {
  if (level === null || level === undefined) return null
  return ['Free', '$', '$$', '$$$', '$$$$'][level] ?? null
}

/**
 * Human label for the place type. Handles both shapes we get:
 *   Google: "italian_restaurant"
 *   OSM:    "amenity:restaurant", "tourism:hotel"
 */
function primaryType(types) {
  const skip = new Set(['point_of_interest', 'establishment', 'food', 'yes'])
  const raw = types?.find((x) => x && !skip.has(x))
  if (!raw) return null
  // Drop an OSM "class:" prefix, then normalise separators.
  const t = raw.includes(':') ? raw.split(':')[1] : raw
  const words = t.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export default function PlaceCard({ place }) {
  const price = priceLabel(place.price_level)
  const type = primaryType(place.types)
  const photo = resolveAssetUrl(place.photo_url)

  return (
    <a
      href={place.maps_uri || undefined}
      target="_blank"
      rel="noreferrer"
      className="glass group flex w-[248px] shrink-0 snap-start flex-col overflow-hidden no-underline transition-transform duration-200 hover:-translate-y-1"
      style={{ borderRadius: 'var(--radius)' }}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="h-32 w-full object-cover"
          style={{ background: 'var(--ground-2)' }}
        />
      ) : (
        /* No photo: a quiet cartographic placeholder rather than a grey box. */
        <div
          className="flex h-32 w-full items-center justify-center"
          style={{
            background: 'var(--ground-2)',
            backgroundImage:
              'repeating-linear-gradient(45deg, var(--panel-border) 0 1px, transparent 1px 12px)',
          }}
        >
          <span
            className="text-2xl opacity-40"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-faint)' }}
          >
            ◎
          </span>
        </div>
      )}

      {/* Perforated edge, like a torn ticket */}
      <div
        aria-hidden="true"
        className="h-px w-full"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, var(--panel-border) 0 4px, transparent 4px 8px)',
        }}
      />

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3
          className="text-[15px] leading-snug font-semibold"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--ink)',
            textWrap: 'balance',
          }}
        >
          {place.name}
        </h3>

        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}
        >
          {place.rating != null && (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: 'var(--accent)' }}>★</span> {place.rating.toFixed(1)}
              {place.rating_count != null && (
                <span style={{ color: 'var(--ink-faint)' }}> ({place.rating_count})</span>
              )}
            </span>
          )}
          {price && <span>{price}</span>}
          {place.open_now != null && (
            <span style={{ color: place.open_now ? 'var(--open)' : 'var(--closed)' }}>
              {place.open_now ? 'Open' : 'Closed'}
            </span>
          )}
        </div>

        {type && (
          <p className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
            {type}
          </p>
        )}

        {place.address && (
          <p
            className="mt-auto line-clamp-2 pt-1 text-[11px] leading-relaxed"
            style={{ color: 'var(--ink-muted)' }}
          >
            {place.address}
          </p>
        )}
      </div>
    </a>
  )
}
