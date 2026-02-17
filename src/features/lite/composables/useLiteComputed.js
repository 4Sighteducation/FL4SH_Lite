import { computed } from 'vue'
import { boxConfig, examLevelChoices } from '../constants'
import { cardBox, flattenTopicRows, isCardDue, parseTimestampMs } from '../utils'

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')
}

function qualificationMatches(subjectLevel, levelValues) {
  if (!Array.isArray(levelValues) || !levelValues.length) return true
  const normalizedSubject = normalizeCode(subjectLevel)
  if (!normalizedSubject) return false
  return levelValues.some((candidate) => {
    const normalizedCandidate = normalizeCode(candidate)
    return (
      normalizedSubject === normalizedCandidate ||
      normalizedSubject.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedSubject)
    )
  })
}

export function useLiteComputed({
  state,
  subjectSearch,
  modalSearch,
  modalLevel,
  activeTopicFilter,
  activeBoxFilter,
  topicTree,
  expandedTopics,
}) {
  const selectedSubject = computed(() =>
    state.selectedSubjects.find((s) => s.subject_key === state.selectedSubjectKey) || null
  )

  const dueCards = computed(() => {
    return state.cards.filter((c) => isCardDue(c))
  })

  const activeStudyCard = computed(() => dueCards.value[state.studyIndex] || null)

  const topicList = computed(() => {
    const set = new Set()
    state.cards.forEach((c) => {
      const t = String(c.topic_code || '').trim()
      if (t) set.add(t)
    })
    return [...set]
  })

  const filteredCards = computed(() => {
    const now = Date.now()
    const cards = state.cards.filter((c) => {
      const topicOk = !activeTopicFilter.value || String(c.topic_code || '') === activeTopicFilter.value
      const boxOk = !activeBoxFilter.value || cardBox(c) === activeBoxFilter.value
      return topicOk && boxOk
    })
    return [...cards].sort((a, b) => {
      const aDueAt = a?.next_review_at ? parseTimestampMs(a.next_review_at) : NaN
      const bDueAt = b?.next_review_at ? parseTimestampMs(b.next_review_at) : NaN
      const aDue = isCardDue(a)
      const bDue = isCardDue(b)
      if (aDue !== bDue) return aDue ? -1 : 1
      if (Number.isFinite(aDueAt) && Number.isFinite(bDueAt) && aDueAt !== bDueAt) return aDueAt - bDueAt
      return String(a?.front_text || '').localeCompare(String(b?.front_text || ''))
    })
  })

  const filteredAvailableSubjects = computed(() => {
    const q = subjectSearch.value.trim().toLowerCase()
    if (!q) return state.availableSubjects
    return state.availableSubjects.filter((s) =>
      String(s.subject_name || '').toLowerCase().includes(q) ||
      String(s.exam_board || '').toLowerCase().includes(q) ||
      String(s.qualification_type || '').toLowerCase().includes(q)
    )
  })

  const filteredSelectedSubjects = computed(() => {
    const q = subjectSearch.value.trim().toLowerCase()
    if (!q) return state.selectedSubjects
    return state.selectedSubjects.filter((s) =>
      String(s.subject_name || '').toLowerCase().includes(q) ||
      String(s.exam_board || '').toLowerCase().includes(q) ||
      String(s.qualification_type || '').toLowerCase().includes(q)
    )
  })

  const filteredModalSubjects = computed(() => {
    const q = modalSearch.value.trim().toLowerCase()
    const choice = examLevelChoices.find((x) => x.label === modalLevel.value)
    const levelValues = Array.isArray(choice?.values) ? choice.values : []
    return state.availableSubjects.filter((s) => {
      const subjectLevel = String(s.qualification_type || '')
      const levelOk = !modalLevel.value || qualificationMatches(subjectLevel, levelValues)
      const textOk = !q
        || String(s.subject_name || '').toLowerCase().includes(q)
        || String(s.exam_board || '').toLowerCase().includes(q)
        || String(s.qualification_type || '').toLowerCase().includes(q)
      return levelOk && textOk
    })
  })

  const boxStats = computed(() =>
    boxConfig.map((b) => {
      const cards = state.cards.filter((c) => cardBox(c) === b.box)
      return {
        ...b,
        count: cards.length,
        preview: cards.slice(0, 3),
      }
    })
  )

  const topicRows = computed(() => flattenTopicRows(topicTree.value || [], expandedTopics.value || {}))

  return {
    selectedSubject,
    dueCards,
    activeStudyCard,
    topicList,
    filteredCards,
    filteredAvailableSubjects,
    filteredSelectedSubjects,
    filteredModalSubjects,
    boxStats,
    topicRows,
  }
}
