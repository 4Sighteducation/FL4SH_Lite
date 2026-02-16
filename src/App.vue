<script setup>
import { onMounted, reactive, ref } from 'vue'
import { LINKS, callFn } from './lib/api'
import CardDetailModal from './components/lite/CardDetailModal.vue'
import LiteHeader from './components/lite/LiteHeader.vue'
import StudyPanel from './components/lite/StudyPanel.vue'
import SubjectDetailPanel from './components/lite/SubjectDetailPanel.vue'
import SubjectHomePanel from './components/lite/SubjectHomePanel.vue'
import SubjectSidebar from './components/lite/SubjectSidebar.vue'
import SubjectSelectionModal from './components/lite/SubjectSelectionModal.vue'
import UpsellModal from './components/lite/UpsellModal.vue'
import { examLevelChoices } from './features/lite/constants'
import { useLiteComputed } from './features/lite/composables/useLiteComputed'
import { createInitialCardModal, createInitialState } from './features/lite/state'
import {
  createLiteCard,
  deleteLiteCard,
  generateLiteCards,
  getLiteContext,
  getLiteTopicTree,
  listLiteCards,
  saveLiteSubjects,
  submitLiteReview,
} from './features/lite/services/liteClient'
import {
  formatDate,
  formatDateTime,
  isCardDue,
  parseMcq,
  shortLine,
} from './features/lite/utils'
import {
  getSubjectColor as readSubjectColor,
  loadSubjectColors,
  saveSubjectColors,
  setSubjectColorValue,
} from './features/lite/subjectColors'

const view = ref('home') // home | subject | study
const state = reactive(createInitialState())

const subjectDraft = ref([])
const aiTopic = ref('')
const aiCount = ref(3)
const aiType = ref('short_answer')
const manualTopic = ref('')
const manualFront = ref('')
const manualBack = ref('')
const activeTopicFilter = ref('')
const subjectSearch = ref('')
const activeBoxFilter = ref(0)
const pulseBox = ref(0)
const movingCardText = ref('')
const modalLevel = ref('')
const modalSearch = ref('')
const subjectColors = ref({})
const topicTree = ref([])
const expandedTopics = ref({})
const cardModal = reactive(createInitialCardModal())
const {
  selectedSubject,
  dueCards,
  activeStudyCard,
  topicList,
  filteredCards,
  filteredModalSubjects,
  boxStats,
  topicRows,
} = useLiteComputed({
  state,
  subjectSearch,
  modalSearch,
  modalLevel,
  activeTopicFilter,
  activeBoxFilter,
  topicTree,
  expandedTopics,
})

function getSubjectColor(subjectKey) {
  return readSubjectColor(subjectColors.value, subjectKey)
}
function setSubjectColor(subjectKey, color) {
  subjectColors.value = setSubjectColorValue(subjectColors.value, subjectKey, color)
  saveSubjectColors(state.user?.email, subjectColors.value)
}
function setSubjectColorFromSidebar(payload) {
  setSubjectColor(payload?.subjectKey, payload?.color)
}

function neonUpsell(title, message) {
  state.upsellTitle = title
  state.upsellMessage = message
  state.showUpsell = true
}

function closeUpsell() {
  state.showUpsell = false
}

function clearError() {
  state.error = ''
}
function openSubjectModal() {
  subjectDraft.value = state.selectedSubjects.map((s) => s.subject_key)
  modalSearch.value = ''
  modalLevel.value = examLevelChoices[0]?.label || ''
  state.showSubjectModal = true
}
function closeSubjectModal() {
  state.showSubjectModal = false
}
function selectSubjectFromModal(subjectKey) {
  if (subjectDraft.value.includes(subjectKey)) {
    subjectDraft.value = subjectDraft.value.filter((x) => x !== subjectKey)
    return
  }
  if (subjectDraft.value.length >= state.limits.max_subjects) {
    neonUpsell(
      'Subject limit reached in Lite',
      `FL4SH Lite allows ${state.limits.max_subjects} subjects. Download the real FL4SH app for unlimited subjects.`
    )
    return
  }
  subjectDraft.value = [...subjectDraft.value, subjectKey]
}

async function applyStudyGrade(correct) {
  const card = activeStudyCard.value
  if (!card || state.busy) return
  clearError()
  state.busy = true
  try {
    const data = await submitLiteReview(callFn, card.id, correct)
    const updated = data.card || {}
    const targetBox = Number(updated.box_number || (correct ? Math.min(5, Number(card.box_number || 1) + 1) : 1))
    state.cards = state.cards.map((c) => (c.id === card.id ? { ...c, ...updated } : c))
    movingCardText.value = shortLine(card.front_text, 36)
    pulseBox.value = targetBox
    window.setTimeout(() => {
      pulseBox.value = 0
      movingCardText.value = ''
    }, 900)
    state.revealAnswer = false
    state.sessionReviewed += 1
    if (dueCards.value.length === 0) state.sessionDone = true
  } catch (e) {
    state.error = e.message || 'Could not submit review.'
  } finally {
    state.busy = false
  }
}

async function loadContext() {
  clearError()
  state.loading = true
  try {
    const data = await getLiteContext(callFn)
    state.user = data.user || null
    state.limits = data.limits || state.limits
    state.availableSubjects = Array.isArray(data.available_subjects) ? data.available_subjects : []
    state.catalogWarning = String(data.catalog_warning || '')
    state.selectedSubjects = Array.isArray(data.selected_subjects) ? data.selected_subjects : []
    subjectColors.value = loadSubjectColors(state.user?.email)
    subjectDraft.value = state.selectedSubjects.map((s) => s.subject_key)
    if (!state.selectedSubjectKey && state.selectedSubjects[0]) state.selectedSubjectKey = state.selectedSubjects[0].subject_key
    if (!state.selectedSubjects.length) state.showSubjectModal = true
    await loadCards()
  } catch (e) {
    state.error = e.message || 'Failed to load FL4SH Lite.'
  } finally {
    state.loading = false
  }
}

async function loadCards() {
  if (!state.selectedSubjectKey) {
    state.cards = []
    return
  }
  try {
    const data = await listLiteCards(callFn, state.selectedSubjectKey)
    state.cards = Array.isArray(data.cards) ? data.cards : []
    if (Array.isArray(data.stats) && data.stats[0]) {
      state.selectedSubjects = state.selectedSubjects.map((s) =>
        s.subject_key === state.selectedSubjectKey ? { ...s, ...data.stats[0] } : s
      )
    }
    await loadTopicTree()
  } catch (e) {
    state.error = e.message || 'Failed to load cards.'
  }
}
async function loadTopicTree() {
  if (!state.selectedSubjectKey) {
    topicTree.value = []
    return
  }
  state.topicTreeLoading = true
  state.topicTreeError = ''
  try {
    const data = await getLiteTopicTree(callFn, state.selectedSubjectKey)
    topicTree.value = Array.isArray(data.topics) ? data.topics : []
  } catch (e) {
    state.topicTreeError = e.message || 'Could not load topic tree. Showing fallback topics.'
    const fallback = topicList.value.map((t) => ({ id: t, topic_name: t, topic_code: t, children: [], topic_level: 1, card_count: 0 }))
    topicTree.value = fallback
  } finally {
    state.topicTreeLoading = false
  }
}

async function saveSubjects() {
  clearError()
  state.busy = true
  try {
    if (subjectDraft.value.length > state.limits.max_subjects) {
      throw new Error(`Select up to ${state.limits.max_subjects} subjects only.`)
    }
    const subjects = state.availableSubjects
      .filter((s) => subjectDraft.value.includes(s.subject_key))
      .map((s) => ({
        subject_key: s.subject_key,
        subject_name: s.subject_name,
        exam_board: s.exam_board,
        qualification_type: s.qualification_type,
      }))
    const data = await saveLiteSubjects(callFn, subjects)
    state.selectedSubjects = Array.isArray(data.selected_subjects) ? data.selected_subjects : []
    if (!state.selectedSubjects.some((s) => s.subject_key === state.selectedSubjectKey)) {
      state.selectedSubjectKey = state.selectedSubjects[0]?.subject_key || ''
    }
    await loadCards()
    closeSubjectModal()
  } catch (e) {
    state.error = e.message || 'Could not save subjects.'
  } finally {
    state.busy = false
  }
}

function openSubject(subjectKey) {
  state.selectedSubjectKey = subjectKey
  view.value = 'subject'
  loadCards()
}
function toggleTopicRow(row) {
  if (row.hasChildren) {
    expandedTopics.value = { ...expandedTopics.value, [row.id]: !expandedTopics.value[row.id] }
    return
  }
  activeTopicFilter.value = row.topic_code
  manualTopic.value = row.topic_code
  aiTopic.value = row.topic_code
}
function openCardModal(card) {
  const mcq = parseMcq(card)
  cardModal.open = true
  cardModal.flipped = false
  cardModal.showDetails = false
  cardModal.card = card
  cardModal.mcqOptions = mcq.options
  cardModal.correctOption = mcq.correct
  cardModal.selectedOption = ''
  cardModal.selectedCorrect = null
}
function closeCardModal() {
  cardModal.open = false
}
function chooseMcqOption(optionKey) {
  if (cardModal.selectedOption) return
  cardModal.selectedOption = optionKey
  cardModal.selectedCorrect = cardModal.correctOption
    ? optionKey === cardModal.correctOption
    : null
}
async function reviewFromModal(correct) {
  const card = cardModal.card
  if (!card || state.busy || !isCardDue(card)) return
  state.busy = true
  try {
    const data = await submitLiteReview(callFn, card.id, correct)
    const updated = data.card || {}
    const targetBox = Number(updated.box_number || (correct ? Math.min(5, Number(card.box_number || 1) + 1) : 1))
    state.cards = state.cards.map((c) => (c.id === card.id ? { ...c, ...updated } : c))
    cardModal.card = { ...cardModal.card, ...updated }
    movingCardText.value = shortLine(card.front_text, 36)
    pulseBox.value = targetBox
    window.setTimeout(() => {
      pulseBox.value = 0
      movingCardText.value = ''
    }, 900)
  } catch (e) {
    state.error = e.message || 'Could not submit review.'
  } finally {
    state.busy = false
  }
}
function cardModalBackSummary() {
  return shortLine(cardModal.card?.back_text || '', 220)
}
function cardDueBadge(card) {
  return isCardDue(card) ? 'Due now' : `Due ${formatDate(card?.next_review_at)}`
}
function selectedSubjectMeta() {
  if (!selectedSubject.value) return ''
  return `${selectedSubject.value.exam_board || ''} · ${selectedSubject.value.qualification_type || ''}`
}

async function addManualCard() {
  clearError()
  if (!state.selectedSubjectKey) return
  state.busy = true
  try {
    await createLiteCard(callFn, {
      subject_key: state.selectedSubjectKey,
      topic_code: manualTopic.value || null,
      front_text: manualFront.value,
      back_text: manualBack.value,
      card_type: 'short_answer',
    })
    manualTopic.value = ''
    manualFront.value = ''
    manualBack.value = ''
    await loadCards()
  } catch (e) {
    state.error = e.message || 'Could not create card.'
  } finally {
    state.busy = false
  }
}

async function generateCards() {
  clearError()
  if (!selectedSubject.value) return
  state.busy = true
  try {
    await generateLiteCards(callFn, {
      subject_key: state.selectedSubjectKey,
      subject: selectedSubject.value.subject_name,
      topic: aiTopic.value,
      examBoard: selectedSubject.value.exam_board,
      examType: selectedSubject.value.qualification_type,
      questionType: aiType.value,
      numCards: Math.max(1, Math.min(5, Number(aiCount.value || 3))),
    })
    await loadCards()
    if ((selectedSubject.value?.cards_remaining || 0) <= 0) {
      neonUpsell('Lite card limit reached', 'Get the full FL4SH app for unlimited cards and full study tools.')
    }
  } catch (e) {
    state.error = e.message || 'Could not generate cards.'
  } finally {
    state.busy = false
  }
}

async function deleteCard(cardId) {
  state.busy = true
  try {
    await deleteLiteCard(callFn, cardId)
    await loadCards()
  } catch (e) {
    state.error = e.message || 'Could not delete card.'
  } finally {
    state.busy = false
  }
}

function startStudy() {
  state.studyIndex = 0
  state.sessionReviewed = 0
  state.sessionDone = false
  state.revealAnswer = false
  view.value = 'study'
}

onMounted(loadContext)
</script>

<template>
  <div class="page">
    <LiteHeader :user="state.user" :limits="state.limits" :links="LINKS" />

    <div v-if="state.error" class="error">{{ state.error }}</div>
    <div v-if="state.catalogWarning" class="error">{{ state.catalogWarning }}</div>
    <div v-if="state.loading" class="loading">Loading FL4SH Lite...</div>

    <main class="layout" v-if="!state.loading">
      <SubjectSidebar
        :selected-subjects="state.selectedSubjects"
        :selected-subject-key="state.selectedSubjectKey"
        :limits="state.limits"
        :get-subject-color="getSubjectColor"
        @manage-subjects="openSubjectModal"
        @open-subject="openSubject"
        @set-subject-color="setSubjectColorFromSidebar"
      />

      <SubjectHomePanel
        :visible="view === 'home'"
        :selected-subjects="state.selectedSubjects"
        :get-subject-color="getSubjectColor"
        @open-subject="openSubject"
      />

      <SubjectDetailPanel
        :visible="view === 'subject'"
        :selected-subject="selectedSubject"
        :cards="state.cards"
        :box-stats="boxStats"
        :active-box-filter="activeBoxFilter"
        :pulse-box="pulseBox"
        :moving-card-text="movingCardText"
        :topic-tree-loading="state.topicTreeLoading"
        :topic-tree-error="state.topicTreeError"
        :active-topic-filter="activeTopicFilter"
        :topic-rows="topicRows"
        :expanded-topics="expandedTopics"
        :selected-subject-key="state.selectedSubjectKey"
        :selected-subject-meta="selectedSubjectMeta"
        :get-subject-color="getSubjectColor"
        :short-line="shortLine"
        :manual-topic="manualTopic"
        :manual-front="manualFront"
        :manual-back="manualBack"
        :ai-topic="aiTopic"
        :ai-type="aiType"
        :ai-count="aiCount"
        :busy="state.busy"
        :filtered-cards="filteredCards"
        @start-study="startStudy"
        @back-home="view = 'home'"
        @set-active-box-filter="activeBoxFilter = $event"
        @set-active-topic-filter="activeTopicFilter = $event"
        @toggle-topic-row="toggleTopicRow"
        @update:manualTopic="manualTopic = $event"
        @update:manualFront="manualFront = $event"
        @update:manualBack="manualBack = $event"
        @update:aiTopic="aiTopic = $event"
        @update:aiType="aiType = $event"
        @update:aiCount="aiCount = $event"
        @add-manual-card="addManualCard"
        @generate-cards="generateCards"
        @open-card-modal="openCardModal"
        @delete-card="deleteCard"
      />

      <StudyPanel
        :visible="view === 'study'"
        :selected-subject="selectedSubject"
        :box-stats="boxStats"
        :pulse-box="pulseBox"
        :moving-card-text="movingCardText"
        :short-line="shortLine"
        :session-done="state.sessionDone"
        :due-cards-length="dueCards.length"
        :session-reviewed="state.sessionReviewed"
        :active-study-card="activeStudyCard"
        :reveal-answer="state.revealAnswer"
        @back-to-subject="view = 'subject'"
        @set-reveal-answer="state.revealAnswer = $event"
        @apply-study-grade="applyStudyGrade"
      />
    </main>

    <UpsellModal
      :visible="state.showUpsell"
      :title="state.upsellTitle"
      :message="state.upsellMessage"
      :links="LINKS"
      @close="closeUpsell"
    />

    <SubjectSelectionModal
      :visible="state.showSubjectModal"
      :exam-level-choices="examLevelChoices"
      :modal-level="modalLevel"
      :modal-search="modalSearch"
      :filtered-modal-subjects="filteredModalSubjects"
      :subject-draft="subjectDraft"
      :max-subjects="state.limits.max_subjects"
      :busy="state.busy"
      @close="closeSubjectModal"
      @update:modal-level="modalLevel = $event"
      @update:modal-search="modalSearch = $event"
      @toggle-subject="selectSubjectFromModal"
      @save-subjects="saveSubjects"
    />

    <CardDetailModal
      :visible="cardModal.open"
      :card-modal="cardModal"
      :busy="state.busy"
      :is-card-due="isCardDue"
      :card-due-badge="cardDueBadge"
      :selected-subject-meta="selectedSubjectMeta"
      :card-modal-back-summary="cardModalBackSummary"
      :format-date-time="formatDateTime"
      @close="closeCardModal"
      @toggle-flip="cardModal.flipped = !cardModal.flipped"
      @toggle-details="cardModal.showDetails = !cardModal.showDetails"
      @choose-option="chooseMcqOption"
      @review="reviewFromModal"
    />
  </div>
</template>
