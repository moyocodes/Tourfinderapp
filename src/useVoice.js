import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * Voice in and out, using the browser's built-in Web Speech API — no backend,
 * no API key, no cost. Recognition exists in Chrome, Edge and Safari (not
 * Firefox), so `canListen` gates the mic button; synthesis is near-universal.
 */

const Recognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

/** Markdown → something pleasant to hear: no symbols, links read as their text. */
export function toSpeech(md) {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>|~]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function useVoice({ onFinal }) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [speakingId, setSpeakingId] = useState(null)
  const rec = useRef(null)
  const finalRef = useRef(onFinal)
  useEffect(() => {
    finalRef.current = onFinal
  })

  const canListen = Boolean(Recognition)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stopSpeaking = useCallback(() => {
    if (canSpeak) window.speechSynthesis.cancel()
    setSpeakingId(null)
  }, [canSpeak])

  const speak = useCallback(
    (id, text) => {
      if (!canSpeak) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(toSpeech(text))
      u.lang = navigator.language || 'en-US'
      u.rate = 1.03
      u.onend = u.onerror = () => setSpeakingId((s) => (s === id ? null : s))
      setSpeakingId(id)
      window.speechSynthesis.speak(u)
    },
    [canSpeak],
  )

  const listen = useCallback(() => {
    if (!Recognition) return
    if (rec.current) {
      rec.current.stop()
      return
    }
    stopSpeaking() // don't transcribe our own voice
    const r = new Recognition()
    r.lang = navigator.language || 'en-US'
    r.interimResults = true
    r.continuous = false
    let finalText = ''
    r.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t
        else live += t
      }
      setInterim(finalText + live)
    }
    r.onerror = () => {}
    r.onend = () => {
      rec.current = null
      setListening(false)
      setInterim('')
      if (finalText.trim()) finalRef.current(finalText.trim())
    }
    rec.current = r
    setListening(true)
    r.start()
  }, [stopSpeaking])

  useEffect(
    () => () => {
      rec.current?.abort()
      if (canSpeak) window.speechSynthesis.cancel()
    },
    [canSpeak],
  )

  return { canListen, canSpeak, listening, interim, listen, speak, speakingId, stopSpeaking }
}
