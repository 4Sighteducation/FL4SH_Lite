import { SUBJECT_COLOR_FALLBACK } from './constants'

function colorKey(email) {
  const normalizedEmail = String(email || 'anon').toLowerCase()
  return `fl4sh-lite-subject-colors:${normalizedEmail}`
}

function isHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(value.trim())
}

function firstHexFromCss(value) {
  if (typeof value !== 'string') return ''
  const m = value.match(/#([0-9a-f]{6}|[0-9a-f]{3})/i)
  return m ? `#${m[1]}` : ''
}

export function normalizeSubjectTheme(themeValue) {
  // Backwards compatible: historically stored as a single hex string.
  if (isHexColor(themeValue)) {
    return { accent: themeValue.trim(), gradient: '' }
  }
  if (typeof themeValue === 'string' && themeValue.trim().startsWith('linear-gradient')) {
    const accent = firstHexFromCss(themeValue) || SUBJECT_COLOR_FALLBACK
    return { accent, gradient: themeValue.trim() }
  }
  if (themeValue && typeof themeValue === 'object') {
    const accent = isHexColor(themeValue.accent) ? themeValue.accent.trim() : SUBJECT_COLOR_FALLBACK
    const gradient = typeof themeValue.gradient === 'string' ? themeValue.gradient.trim() : ''
    return { accent, gradient: gradient.startsWith('linear-gradient') ? gradient : '' }
  }
  return { accent: SUBJECT_COLOR_FALLBACK, gradient: '' }
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

export function getSubjectTheme(colors, subjectKey) {
  return normalizeSubjectTheme(colors?.[subjectKey])
}

export function getSubjectColor(colors, subjectKey) {
  return getSubjectTheme(colors, subjectKey).accent
}

export function getSubjectGradient(colors, subjectKey) {
  return getSubjectTheme(colors, subjectKey).gradient
}

export function setSubjectColorValue(colors, subjectKey, themeValue) {
  return { ...(colors || {}), [subjectKey]: themeValue }
}
