const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const BRIDGE_SECRET = import.meta.env.VITE_FL4SH_LITE_BRIDGE_SECRET || ''
const ENABLE_LOCAL_MOCK = String(import.meta.env.VITE_ENABLE_LOCAL_MOCK || 'false') === 'true'

export const LINKS = {
  appStore: 'https://apps.apple.com/in/app/fl4sh-study-smarter/id6747457678',
  playStore: 'https://play.google.com/store/apps/details?id=com.foursighteducation.flash&pcampaignid=web_share',
  website: 'https://www.fl4shcards.com',
}

function getFnUrl(name) {
  if (!SUPABASE_URL) throw new Error('Missing VITE_SUPABASE_URL')
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`
}

function getKnackIdentity() {
  try {
    const k = window.Knack
    if (!k) return null
    const attrs = typeof k.getUserAttributes === 'function' ? (k.getUserAttributes() || {}) : {}
    const email = String(attrs.email || attrs?.attributes?.email || '').trim().toLowerCase()
    if (!email) return null
    return {
      email,
      name: String(attrs.name || attrs?.attributes?.name || '').trim() || null,
      school_name: String(attrs.school || attrs?.attributes?.school || '').trim() || null,
      qualification_level: String(
        attrs.qualification_level ||
          attrs.qualificationLevel ||
          attrs.level ||
          attrs.exam_level ||
          attrs.year_group ||
          attrs?.attributes?.qualification_level ||
          ''
      ).trim() || null,
      knack_user_id: String(attrs.id || attrs.record_id || '').trim() || null,
    }
  } catch {
    return null
  }
}

function getLocalMockIdentity() {
  if (!ENABLE_LOCAL_MOCK) return null
  return {
    email: String(import.meta.env.VITE_LOCAL_MOCK_EMAIL || 'student@example.com').trim().toLowerCase(),
    name: String(import.meta.env.VITE_LOCAL_MOCK_NAME || 'Test Student').trim(),
    school_name: String(import.meta.env.VITE_LOCAL_MOCK_SCHOOL || 'Test School').trim(),
    qualification_level: String(import.meta.env.VITE_LOCAL_MOCK_QUALIFICATION || 'A_LEVEL').trim(),
    knack_user_id: 'local-mock-user',
  }
}

export function getIdentity() {
  return getKnackIdentity() || getLocalMockIdentity()
}

export async function callFn(name, body = {}) {
  const identity = getIdentity()
  if (!identity?.email) {
    throw new Error('No Knack user identity found. Open this inside Knack or enable local mock.')
  }
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  }
  if (BRIDGE_SECRET) headers['x-fl4sh-lite-secret'] = BRIDGE_SECRET

  const res = await fetch(getFnUrl(name), {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...identity, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}
