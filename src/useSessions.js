import { useCallback, useEffect, useState } from 'react'

const KEY = 'wayfinder-sessions'
const MAX_SESSIONS = 50

/**
 * Conversation list and history, stored in the browser.
 *
 * localStorage rather than the server because the backend keeps sessions in
 * process memory — it loses them on restart, and can't serve a list that
 * outlives one process. Here they persist per-device.
 *
 * Every access is wrapped: private browsing and blocked site-data both make
 * localStorage throw, and losing chat history is not worth a broken page.
 */
function read() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function write(sessions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
  } catch {
    // Quota exceeded or storage blocked — the in-memory copy still works
    // for this tab.
  }
}

export function useSessions() {
  const [sessions, setSessions] = useState(read)
  const [activeId, setActiveId] = useState(() => read()[0]?.id ?? null)

  useEffect(() => {
    write(sessions)
  }, [sessions])

  const active = sessions.find((s) => s.id === activeId) ?? null

  /** Start a fresh conversation. The id is assigned by the server on first reply. */
  const startNew = useCallback(() => {
    setActiveId(null)
  }, [])

  /**
   * Persist a conversation after each exchange. Called with the server's
   * session_id, which is only known once the first reply comes back.
   */
  const upsert = useCallback((id, messages) => {
    if (!id) return
    setSessions((prev) => {
      const firstUser = messages.find((m) => m.role === 'user')
      const existing = prev.find((s) => s.id === id)
      const row = {
        id,
        // The opening question names the chat; later turns don't rename it.
        title: existing?.title ?? (firstUser?.text?.slice(0, 60) || 'New chat'),
        updatedAt: Date.now(),
        messages,
      }
      return [row, ...prev.filter((s) => s.id !== id)]
    })
    setActiveId(id)
  }, [])

  const remove = useCallback(
    (id) => {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      setActiveId((current) => (current === id ? null : current))
      // Best-effort server cleanup; the local list is the source of truth.
      const base = import.meta.env.VITE_API_BASE_URL ?? '/api'
      fetch(`${base}/chat/${id}`, { method: 'DELETE' }).catch(() => {})
    },
    [],
  )

  const clearAll = useCallback(() => {
    setSessions([])
    setActiveId(null)
  }, [])

  return { sessions, active, activeId, setActiveId, startNew, upsert, remove, clearAll }
}
