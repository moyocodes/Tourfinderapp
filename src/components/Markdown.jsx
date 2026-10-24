import { useCopy } from '../useCopy'
import CopyButton, { CopyIcon } from './CopyButton'

/**
 * Minimal markdown renderer for assistant replies.
 *
 * Claude writes bold, bullet lists, and the occasional heading — that's the
 * whole surface we need. Plus the two copyable forms: a ``` fenced block (an
 * address for a driver, a phrase to show someone, a message to send) becomes a
 * card with a Copy button, and `backticks` become a tap-to-copy chip. Rendering it by hand keeps the bundle small and,
 * more importantly, means no untrusted HTML is ever injected: every node here
 * is a real React element, so there's no dangerouslySetInnerHTML anywhere.
 */

/** Split a line into text, **bold**, [label](https://url) and `copy` runs. */
function inline(text, keyPrefix) {
  const parts = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`\n]+)`/g
  let last = 0
  let match
  let i = 0

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[3]) {
      // Only http(s) URLs match the regex, so no javascript: links get through.
      parts.push(
        <a
          key={`${keyPrefix}-a${i++}`}
          href={match[3]}
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: 'var(--accent)', textDecoration: 'underline' }}
        >
          {match[2]}
        </a>,
      )
    } else if (match[4]) {
      parts.push(<CopyChip key={`${keyPrefix}-c${i++}`} text={match[4]} />)
    } else {
      parts.push(
        <strong key={`${keyPrefix}-b${i++}`} style={{ color: 'var(--ink)', fontWeight: 600 }}>
          {match[1]}
        </strong>,
      )
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Text meant to be used elsewhere, set apart with its own Copy button. */
function CopyBlock({ text }) {
  return (
    <div className="my-2.5 flex items-start gap-2 rounded-xl border border-line border-l-[3px] border-l-accent bg-panel-solid/70 py-2.5 pr-1.5 pl-3.5">
      <p className="flex-1 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{text}</p>
      <CopyButton text={text} label="Copy text" showLabel />
    </div>
  )
}

/** A short inline value (phone number, postcode) that copies on tap. */
function CopyChip({ text }) {
  const [copied, copy] = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      title={copied ? 'Copied' : 'Tap to copy'}
      aria-label={copied ? `Copied ${text}` : `Copy ${text}`}
      className={`mx-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 align-baseline font-mono text-[12.5px] text-ink transition-colors ${
        copied ? 'border-accent bg-accent-quiet' : 'border-line bg-panel-solid/70 hover:border-accent'
      }`}
    >
      {text}
      <span className={copied ? 'text-accent' : 'text-ink-faint'}>
        <CopyIcon copied={copied} size={11} />
      </span>
    </button>
  )
}

export default function Markdown({ text }) {
  const lines = String(text ?? '').split('\n')
  const blocks = []
  let list = null
  let fence = null // lines of an open ``` block

  const flushList = () => {
    if (!list) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-2 flex flex-col gap-1.5 pl-4">
        {list.map((item, i) => (
          <li key={i} className="relative pl-3 text-[14px] leading-relaxed">
            <span
              aria-hidden="true"
              className="absolute left-0 top-[0.6em] h-1 w-1 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            {inline(item, `li${blocks.length}-${i}`)}
          </li>
        ))}
      </ul>,
    )
    list = null
  }

  const flushFence = () => {
    const body = fence.join('\n').trim()
    if (body) blocks.push(<CopyBlock key={`code-${blocks.length}`} text={body} />)
    fence = null
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()

    // Inside a ``` block everything is kept verbatim until the closing fence.
    if (fence) {
      if (/^\s*```/.test(line)) flushFence()
      else fence.push(line)
      return
    }
    if (/^\s*```/.test(line)) {
      flushList()
      fence = []
      return
    }

    // Bullet: "- foo" or "* foo"
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      list = list ?? []
      list.push(bullet[1])
      return
    }

    flushList()

    if (!line.trim()) return

    // Heading: "## foo" — rendered as a small label, not a giant title.
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      blocks.push(
        <h4
          key={`h-${idx}`}
          className="mt-3 mb-1 text-[11px] tracking-[0.08em] uppercase"
          style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-body)', fontWeight: 600 }}
        >
          {inline(heading[1], `h${idx}`)}
        </h4>,
      )
      return
    }

    blocks.push(
      <p key={`p-${idx}`} className="my-1.5 text-[14px] leading-relaxed">
        {inline(line, `p${idx}`)}
      </p>,
    )
  })

  flushList()
  // An unclosed fence still shows what it held.
  if (fence) flushFence()

  return <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>
}
