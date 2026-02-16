import { computed } from 'vue'
import { boxConfig, examLevelChoices } from '../constants'
import { cardBox, flattenTopicRows } from '../utils'

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
    const now = Date.now()
    return state.cards.filter((c) => {
      const dueAt = c.next_review_at ? new Date(c.next_review_at).getTime() : 0
      return !dueAt || dueAt <= now
    })
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
    return state.cards.filter((c) => {
      const topicOk = !activeTopicFilter.value || String(c.topic_code || '') === activeTopicFilter.value
      const boxOk = !activeBoxFilter.value || cardBox(c) === activeBoxFilter.value
      return topicOk && boxOk
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

  const filteredModalSubjects = computed(() => {
    const q = modalSearch.value.trim().toLowerCase()
    const choice = examLevelChoices.find((x) => x.label === modalLevel.value)
    const levelSet = new Set((choice?.values || []).map((v) => String(v).toUpperCase()))
    return state.availableSubjects.filter((s) => {
      const subjectLevel = String(s.qualification_type || '').toUpperCase()
      const levelOk = !modalLevel.value || levelSet.has(subjectLevel)
      const textOk = !q
        || String(s.subject_name || '').toLowerCase().includes(q)
        || String(s.exam_board || '').toLowerCase().includes(q)
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
    filteredModalSubjects,
    boxStats,
    topicRows,
  }
}
