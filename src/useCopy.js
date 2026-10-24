import { useCallback, useEffect, useRef, useState } from 'react'

/** Put text on the clipboard. Resolves true on success; never throws. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // No async clipboard (older browser, non-secure origin) — fall back below.
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  } catch {
    return false
  }
}

/** `[copied, copy]` — `copied` stays true briefly after a successful copy, for the ✓. */
export function useCopy(ms = 1600) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (text) => {
      if (!(await copyText(text))) return
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), ms)
    },
    [ms],
  )

  return [copied, copy]
}
