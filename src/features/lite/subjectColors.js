import { SUBJECT_COLOR_FALLBACK } from './constants'

function colorKey(email) {
  const normalizedEmail = String(email || 'anon').toLowerCase()
  return `fl4sh-lite-subject-colors:${normalizedEmail}`
}

export function loadSubjectColors(email) {
  try {
    return JSON.parse(localStorage.getItem(colorKey(email)) || '{}')
  } catch {
    return {}
  }
}

export function saveSubjectColors(email, colors) {
  localStorage.setItem(colorKey(email), JSON.stringify(colors || {}))
}

export function getSubjectColor(colors, subjectKey) {
  return colors?.[subjectKey] || SUBJECT_COLOR_FALLBACK
}

export function setSubjectColorValue(colors, subjectKey, color) {
  return { ...(colors || {}), [subjectKey]: color }
}
