export function cardBox(card) {
  return Number(card?.box_number || 1)
}

export function shortLine(text, max = 44) {
  const t = String(text || '').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max - 1)}...` : t
}

export function formatDate(dateValue) {
  if (!dateValue) return 'Not scheduled'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return 'Not scheduled'
  return d.toLocaleDateString()
}

export function formatDateTime(dateValue) {
  if (!dateValue) return 'Not scheduled'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return 'Not scheduled'
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function parseTimestampMs(value) {
  if (!value) return NaN
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const raw = String(value).trim()
  if (!raw) return NaN

  // Fast path: native parse.
  let ms = Date.parse(raw)
  if (Number.isFinite(ms)) return ms

  // Common Postgres textual timestamp: "YYYY-MM-DD HH:MM:SS(.sss)+00"
  // Normalise to ISO-ish: replace first space with "T" and "+00" -> "+00:00".
  const isoish = raw
    .replace(' ', 'T')
    .replace(/([+\-]\d{2})$/, '$1:00')
  ms = Date.parse(isoish)
  if (Number.isFinite(ms)) return ms

  return NaN
}

export function isCardDue(card) {
  // Missing schedule => treat as due. Unparseable schedule => treat as NOT due (safer than forcing early review).
  if (!card?.next_review_at) return true
  const dueAt = parseTimestampMs(card.next_review_at)
  if (!Number.isFinite(dueAt)) return false
  return dueAt <= Date.now()
}

export function flattenTopicRows(nodes, expandedTopics, depth = 0, out = []) {
  nodes.forEach((n) => {
    const id = String(n.id || n.topic_code || n.topic_name)
    const children = Array.isArray(n.children) ? n.children : []
    out.push({
      id,
      depth,
      label: String(n.topic_name || n.topic_code || ''),
      topic_code: String(n.topic_code || n.topic_name || ''),
      count: Number(n.card_count || 0),
      hasChildren: children.length > 0,
    })
    if (children.length && expandedTopics[id]) flattenTopicRows(children, expandedTopics, depth + 1, out)
  })
  return out
}

export function parseMcq(card) {
  const backText = String(card?.back_text || '')
  const lines = backText
    .split('\n')
    .map((l) => String(l || '').trim())
    .filter(Boolean)

  const options = []
  const infoLines = []
  const relatedTopics = []
  let correct = ''
  let inRelated = false

  lines.forEach((line) => {
    const opt = line.match(/^([A-D])[)\].:\-]\s+(.+)$/i)
    if (opt) {
      const rawText = String(opt[2] || '').trim()
      // Sometimes generators repeat the label in the option text (e.g. "A) a) ...").
      const cleaned = rawText.replace(/^([A-D])[)\].:\-]\s*/i, '').trim()
      options.push({ key: String(opt[1] || '').toUpperCase(), text: cleaned })
      return
    }
    const correctMatch = line.match(/^correct\s*answer\s*[:\-]?\s*([A-D])$/i)
    if (correctMatch) {
      correct = String(correctMatch[1] || '').toUpperCase()
      return
    }
    // Ignore headings like "Detailed answer:" in info parsing.
    if (/^detailed\s*answer\s*[:\-]?$/i.test(line)) return
    if (/^related\s*topics\s*[:\-]?$/i.test(line)) {
      inRelated = true
      return
    }
    if (inRelated) {
      const bullet = line.replace(/^[\-•]\s*/, '').trim()
      if (bullet) relatedTopics.push(bullet)
      return
    }
    infoLines.push(line)
  })

  const info = infoLines.join('\n').trim()
  return { options, correct: String(correct || '').toUpperCase(), info, relatedTopics }
}

export function parseBackTextSections(card) {
  const text = String(card?.back_text || '')
  const out = {
    answer: '',
    detailed: '',
    relatedTopics: [],
    raw: text,
  }
  if (!text.trim()) return out

  // Normalise line breaks and split into sections.
  const lines = text.split('\n').map((l) => String(l || '').trim())
  let mode = 'unknown' // unknown | answer | detailed | related
  const answerLines = []
  const detailedLines = []
  const related = []

  lines.forEach((line) => {
    const l = line.trim()
    if (!l) return
    if (/^answer\s*[:\-]?$/i.test(l)) {
      mode = 'answer'
      return
    }
    if (/^detailed\s*answer\s*[:\-]?$/i.test(l)) {
      mode = 'detailed'
      return
    }
    if (/^related\s*topics\s*[:\-]?$/i.test(l)) {
      mode = 'related'
      return
    }
    if (mode === 'related') {
      const bullet = l.replace(/^[\-•]\s*/, '').trim()
      if (bullet) related.push(bullet)
      return
    }
    if (mode === 'detailed') {
      detailedLines.push(l)
      return
    }
    if (mode === 'answer') {
      answerLines.push(l)
      return
    }
    // Fallback: if no explicit headings, treat as "detailed" content.
    detailedLines.push(l)
  })

  out.answer = answerLines.join('\n').trim()
  out.detailed = detailedLines.join('\n').trim()
  out.relatedTopics = related
  return out
}
