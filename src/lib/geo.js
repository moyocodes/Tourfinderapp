const DEG = Math.PI / 180

/**
 * Point on a sphere for a lat/lng, in the globe's own frame: (0°, 0°) faces +z
 * (the camera), north is +y. Rotating the globe by (lat, -lng) on X then Y brings
 * that point to face the camera, which is how the fly-to works.
 */
export function latLngToVec3(lat, lng, r = 1) {
  const phi = lat * DEG
  const lambda = lng * DEG
  return [r * Math.cos(phi) * Math.sin(lambda), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(lambda)]
}

/** Signed shortest step from angle `from` to `to`, in degrees (-180..180]. */
export function shortestAngle(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180
}

/** Coordinates of a place or Location, or null when it has none. */
export function coordsOf(loc) {
  if (loc?.lat == null || loc?.lng == null) return null
  return { lat: loc.lat, lng: loc.lng }
}

/**
 * Centre of a set of points. A plain average is fine here: results are always a
 * single city's worth of places, nowhere near the antimeridian in practice.
 */
export function centroid(points) {
  if (!points.length) return null
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length
  return { lat, lng }
}
