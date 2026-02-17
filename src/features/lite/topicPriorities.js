function storageKey(userEmail, subjectKey) {
  const email = String(userEmail || '').trim().toLowerCase()
  const subject = String(subjectKey || '').trim()
  return `fl4sh_lite_topic_priorities:${email || 'anon'}:${subject || 'none'}`
}

export function loadTopicPriorities(userEmail, subjectKey) {
  try {
    const raw = window.localStorage.getItem(storageKey(userEmail, subjectKey))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveTopicPriorities(userEmail, subjectKey, priorities) {
  try {
    window.localStorage.setItem(storageKey(userEmail, subjectKey), JSON.stringify(priorities || {}))
  } catch {
    // ignore
  }
}

export function setTopicPriorityValue(priorities, topicCode, priority) {
  const next = { ...(priorities && typeof priorities === 'object' ? priorities : {}) }
  const key = String(topicCode || '').trim()
  const value = Number(priority || 0)
  if (!key) return next
  if (!value) {
    delete next[key]
    return next
  }
  next[key] = Math.max(1, Math.min(3, value))
  return next
}

