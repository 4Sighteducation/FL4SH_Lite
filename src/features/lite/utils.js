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

export function isCardDue(card) {
  const dueAt = card?.next_review_at ? new Date(card.next_review_at).getTime() : 0
  return !dueAt || dueAt <= Date.now()
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
  const blob = `${card?.front_text || ''}\n${card?.back_text || ''}`
  const lines = blob.split('\n').map((l) => l.trim()).filter(Boolean)
  const options = lines
    .map((l) => {
      const m = l.match(/^([A-D])[)\].:\-]\s+(.+)$/i)
      return m ? { key: m[1].toUpperCase(), text: m[2] } : null
    })
    .filter(Boolean)
  const correct = (blob.match(/correct\s*answer\s*[:\-]?\s*([A-D])/i) || [])[1] || ''
  return { options, correct: String(correct || '').toUpperCase() }
}
