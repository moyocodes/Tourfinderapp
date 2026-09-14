/**
 * Minimal markdown renderer for assistant replies.
 *
 * Claude writes bold, bullet lists, and the occasional heading — that's the
 * whole surface we need. Rendering it by hand keeps the bundle small and,
 * more importantly, means no untrusted HTML is ever injected: every node here
 * is a real React element, so there's no dangerouslySetInnerHTML anywhere.
 */

/** Split a line into text and **bold** runs. */
function inline(text, keyPrefix) {
  const parts = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let match
  let i = 0

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      <strong key={`${keyPrefix}-b${i++}`} style={{ color: 'var(--ink)', fontWeight: 600 }}>
        {match[1]}
      </strong>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function Markdown({ text }) {
  const lines = String(text ?? '').split('\n')
  const blocks = []
  let list = null

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

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()

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

  return <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>
}
