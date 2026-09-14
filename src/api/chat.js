// Client for the World Tourism Chatbot backend.
//
// In dev, requests go to /api/* and Vite proxies them to http://127.0.0.1:8000
// (see vite.config.js). In production, set VITE_API_BASE_URL to the deployed
// backend URL, e.g. https://mobot-api.onrender.com

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

/**
 * The backend returns photo URLs as bare paths ("/places/photo?name=..."), which
 * only resolve against the dev proxy. Prefix them with the API base so they also
 * work when the frontend and backend are on different origins in production.
 */
export function resolveAssetUrl(path) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return `${BASE}${path}`
}

/**
 * Send a chat message. Pass the sessionId returned by the previous call to
 * continue the same conversation; pass null on the first turn.
 *
 * @param {string} message
 * @param {string|null} sessionId
 * @param {object|null} location — the user's Location, if they shared it
 * @returns {Promise<{ session_id: string, reply: string, intent: string|null, sources: {label: string, uri: string|null}[] }>}
 */
export async function sendChat(message, sessionId = null, location = null) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId, location }),
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      // response wasn't JSON; keep the status-code message
    }
    throw new Error(detail)
  }

  return res.json()
}

/** Health/config check — useful to show whether the backend is reachable. */
export async function checkHealth() {
  const res = await fetch(`${BASE}/healthz`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Free-plan usage: { plan, used, limit, remaining, resets }. */
export async function getUsage() {
  const res = await fetch(`${BASE}/usage`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Generic greeting + starter chips, for before a location is shared. */
export async function getSuggestions() {
  const res = await fetch(`${BASE}/suggestions`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Turn coordinates into a city, with a greeting and suggestions for it.
 * The backend degrades to the generic set if geocoding is unavailable.
 */
export async function reverseGeocode(lat, lng) {
  const res = await fetch(`${BASE}/geo/reverse?lat=${lat}&lng=${lng}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Ask the browser for the user's position. Wraps the callback API in a promise
 * and turns the permission/timeout cases into readable messages.
 */
export function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser doesn't support location sharing."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const messages = {
          1: 'Location permission denied.',
          2: 'Location unavailable right now.',
          3: 'Timed out getting your location.',
        }
        reject(new Error(messages[err.code] ?? 'Could not get your location.'))
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  })
}
