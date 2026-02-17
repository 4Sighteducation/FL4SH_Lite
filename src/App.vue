<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
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
  trackLiteUpsellEvent,
} from './features/lite/services/liteClient'
import {
  formatDate,
  formatDateTime,
  isCardDue,
  parseMcq,
  parseBackTextSections,
  shortLine,
} from './features/lite/utils'
import {
  getSubjectColor as readSubjectColor,
  getSubjectTheme as readSubjectTheme,
  loadSubjectColors,
  saveSubjectColors,
  setSubjectColorValue,
} from './features/lite/subjectColors'
import { loadTopicPriorities, saveTopicPriorities, setTopicPriorityValue } from './features/lite/topicPriorities'

const view = ref('home') // home | subject | study
const state = reactive(createInitialState())

const subjectDraft = ref([])
const aiTopic = ref('')
const aiCount = ref(3)
const aiType = ref('short_answer')
const manualTopic = ref('')
const manualFront = ref('')
const manualBack = ref('')
const manualSelectedTopic = ref('')
const activeTopicFilter = ref('')
const subjectSearch = ref('')
const activeBoxFilter = ref(0)
const pulseBox = ref(0)
const movingCardText = ref('')
const currentUpsellPlacement = ref('general')
const modalLevel = ref('')
const modalSearch = ref('')
const subjectColors = ref({})
const topicTree = ref([])
const expandedTopics = ref({})
const cardModal = reactive(createInitialCardModal())
const topicModalCardIds = ref([])
const topicModalIndex = ref(0)
const createFlowOpen = ref(false)
const createFlowStep = ref('topic')
const createTopicSearch = ref('')
const createSelectedTopic = ref('')
const createSelectedMethod = ref('')
const aiGuidance = ref('')
const aiPreviewCards = ref([])
const previewFlippedByKey = ref({})
const previewSelectionByKey = ref({})
const previewMetaCard = ref(null)
const previewIndex = ref(0)
const aiProgress = ref(0)
const aiProgressLabel = ref('')
let aiProgressTimer = null
const topicPriorities = ref({})
const cardBankOpen = ref(false)
const cardBankSubjectKey = ref('')
const cardBankCardsBySubject = ref({})
const cardBankLoading = ref(false)
const cardBankError = ref('')
const cardBankIndex = ref(0)
const cardBankFlipped = ref(false)
const cardBankSelectedOption = ref('')
const cardBankSelectedCorrect = ref(null)
const cardBankMetaOpen = ref(false)
const boxPreviewOpen = ref(false)
const boxPreviewBox = ref(1)
const boxPreviewIndex = ref(0)
const boxPreviewCardIds = ref([])
const {
  selectedSubject,
  dueCards,
  activeStudyCard,
  topicList,
  filteredCards,
  filteredSelectedSubjects,
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

function dedupeSubjects(subjects) {
  const byKey = new Map()
  ;(Array.isArray(subjects) ? subjects : []).forEach((subject) => {
    const key = String(subject?.subject_key || '').trim()
    if (!key) return
    if (!byKey.has(key)) byKey.set(key, subject)
  })
  return [...byKey.values()]
}

function uniqueKeys(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((v) => String(v || '').trim()).filter(Boolean))]
}

function getSubjectColor(subjectKey) {
  return readSubjectColor(subjectColors.value, subjectKey)
}
function getSubjectTheme(subjectKey) {
  return readSubjectTheme(subjectColors.value, subjectKey)
}
function setSubjectColor(subjectKey, color) {
  subjectColors.value = setSubjectColorValue(subjectColors.value, subjectKey, color)
  saveSubjectColors(state.user?.email, subjectColors.value)
}
function setTopicPriority(payload) {
  const topicCode = String(payload?.topic_code || payload?.topicCode || '').trim()
  const priority = Number(payload?.priority || 0)
  if (!topicCode || !state.selectedSubjectKey) return
  topicPriorities.value = setTopicPriorityValue(topicPriorities.value, topicCode, priority)
  saveTopicPriorities(state.user?.email, state.selectedSubjectKey, topicPriorities.value)
}
function setSubjectColorFromSidebar(payload) {
  setSubjectColor(payload?.subjectKey, payload?.color)
}
const dueCountInSubject = computed(() => state.cards.filter((card) => isCardDue(card)).length)
const masteredCountInSubject = computed(() => state.cards.filter((card) => Number(card?.box_number || 1) === 5).length)
const totalCardsInSubject = computed(() => state.cards.length)
const hasActiveFilters = computed(() => Boolean(activeTopicFilter.value || activeBoxFilter.value))
const topicCountInSubject = computed(() => {
  const set = new Set(
    state.cards
      .map((card) => String(card?.topic_code || '').trim())
      .filter(Boolean)
  )
  return set.size
})
const createLeafTopics = computed(() => {
  const out = []
  const walk = (nodes, path = []) => {
    ;(Array.isArray(nodes) ? nodes : []).forEach((node) => {
      const name = String(node?.topic_name || node?.topic_code || '').trim()
      const code = String(node?.topic_code || node?.topic_name || '').trim()
      if (!name || !code) return
      const nextPath = [...path, name]
      const children = Array.isArray(node?.children) ? node.children : []
      if (!children.length) {
        out.push({
          id: String(node?.id || code),
          topic_code: code,
          label: nextPath.join(' > '),
          count: Number(node?.card_count || 0),
        })
        return
      }
      walk(children, nextPath)
    })
  }
  walk(topicTree.value || [])
  return out
})
const createTopicCandidates = computed(() => {
  const q = createTopicSearch.value.trim().toLowerCase()
  if (q.length < 2) return []
  return createLeafTopics.value.filter((row) =>
    !q ||
    String(row.label || '').toLowerCase().includes(q) ||
    String(row.topic_code || '').toLowerCase().includes(q)
  )
})
const canPrevModalCard = computed(() => topicModalCardIds.value.length > 1 && topicModalIndex.value > 0)
const canNextModalCard = computed(
  () => topicModalCardIds.value.length > 1 && topicModalIndex.value < topicModalCardIds.value.length - 1
)
const modalSequenceLabel = computed(() => {
  const total = topicModalCardIds.value.length
  if (total <= 1) return ''
  return `${topicModalIndex.value + 1} of ${total}`
})
const studyProgressPercent = computed(() => {
  const total = Number(state.sessionTotalDue || 0)
  if (total <= 0) return state.sessionDone ? 100 : 0
  const value = Math.round((state.sessionReviewed / total) * 100)
  return Math.max(0, Math.min(100, value))
})

async function trackEventSafe(eventType, placement, payload = {}) {
  try {
    await trackLiteUpsellEvent(callFn, eventType, placement, payload)
  } catch {
    // Best-effort telemetry only.
  }
}

function openUpsell(title, message, placement = 'general', payload = {}) {
  currentUpsellPlacement.value = placement
  state.upsellTitle = title
  state.upsellMessage = message
  state.showUpsell = true
  trackEventSafe('upsell_impression', placement, payload)
}

function closeUpsell() {
  state.showUpsell = false
  trackEventSafe('upsell_dismiss', currentUpsellPlacement.value)
}

function clearError() {
  state.error = ''
}
function getErrorCode(error) {
  const code = String(error?.code || error?.message || '').trim()
  if (!code) return ''
  return code.toUpperCase()
}
function handleLiteError(error, fallbackMessage, placement = 'general') {
  const code = getErrorCode(error)
  if (code.includes('CARD_LIMIT_REACHED')) {
    openUpsell(
      'Lite card limit reached',
      `FL4SH Lite allows ${state.limits.max_cards_per_subject} AI-generated cards per subject. Manual cards are unlimited.`,
      placement,
      { error_code: code }
    )
    state.error = ''
    return
  }
  if (code.includes('SUBJECT_LIMIT_REACHED')) {
    openUpsell(
      'Subject limit reached in Lite',
      `FL4SH Lite allows ${state.limits.max_subjects} subjects. Download the real FL4SH app for unlimited subjects.`,
      placement,
      { error_code: code }
    )
    state.error = ''
    return
  }
  if (code.includes('SUBJECT_NOT_SELECTED')) {
    state.error = 'Select and save a subject before creating cards.'
    return
  }
  state.error = error?.message || fallbackMessage
}
function onHeaderStoreClick(channel) {
  trackEventSafe('header_store_click', 'header', { channel })
}
function onHeaderWebsiteClick(placement) {
  trackEventSafe('header_website_click', placement || 'header_notice')
}
function onUpsellStoreClick(channel) {
  trackEventSafe('upsell_store_click', currentUpsellPlacement.value, { channel })
}
function onStudyStoreClick(channel) {
  trackEventSafe('study_store_click', state.sessionDone ? 'study_complete' : 'study_empty', { channel })
}
function openSubjectModal() {
  subjectDraft.value = uniqueKeys(state.selectedSubjects.map((s) => s.subject_key))
  modalSearch.value = ''
  modalLevel.value = examLevelChoices[0]?.label || ''
  state.showSubjectModal = true
  trackEventSafe('subject_modal_open', 'subject_modal', { preselected: subjectDraft.value.length })
}
function closeSubjectModal() {
  state.showSubjectModal = false
  trackEventSafe('subject_modal_close', 'subject_modal', { selected_draft: subjectDraft.value.length })
}
function selectSubjectFromModal(subjectKey) {
  if (subjectDraft.value.includes(subjectKey)) {
    subjectDraft.value = subjectDraft.value.filter((x) => x !== subjectKey)
    trackEventSafe('subject_unselected', 'subject_modal', { subject_key: subjectKey, count: subjectDraft.value.length })
    return
  }
  if (subjectDraft.value.length >= state.limits.max_subjects) {
    openUpsell(
      'Subject limit reached in Lite',
      `FL4SH Lite allows ${state.limits.max_subjects} subjects. Download the real FL4SH app for unlimited subjects.`,
      'subject_modal'
    )
    return
  }
  subjectDraft.value = [...subjectDraft.value, subjectKey]
  trackEventSafe('subject_selected', 'subject_modal', { subject_key: subjectKey, count: subjectDraft.value.length })
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
    state.lastStudyOutcome = correct ? 'correct' : 'incorrect'
    window.setTimeout(() => {
      state.lastStudyOutcome = ''
    }, 1200)
    state.sessionReviewed += 1
    if (dueCards.value.length === 0) state.sessionDone = true
  } catch (e) {
    handleLiteError(e, 'Could not submit review.', 'study_mode')
  } finally {
    state.busy = false
  }
}

function backToSubjectFromStudy() {
  state.studyStarted = false
  view.value = 'subject'
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
    state.selectedSubjects = dedupeSubjects(data.selected_subjects)
    subjectColors.value = loadSubjectColors(state.user?.email)
    subjectDraft.value = uniqueKeys(state.selectedSubjects.map((s) => s.subject_key))
    if (!state.selectedSubjectKey && state.selectedSubjects[0]) state.selectedSubjectKey = state.selectedSubjects[0].subject_key
    if (!state.selectedSubjects.length) state.showSubjectModal = true
    await loadCards()
  } catch (e) {
    handleLiteError(e, 'Failed to load FL4SH Lite.', 'app_load')
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
      state.selectedSubjects = dedupeSubjects(state.selectedSubjects.map((s) =>
        s.subject_key === state.selectedSubjectKey ? { ...s, ...data.stats[0] } : s
      ))
    }
    await loadTopicTree()
    topicPriorities.value = loadTopicPriorities(state.user?.email, state.selectedSubjectKey)
  } catch (e) {
    handleLiteError(e, 'Failed to load cards.', 'cards_list')
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
    // Keep this in console so production debugging is possible.
    console.error('[fl4sh-lite-topic-tree] load failed', e)
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
    const draftKeys = uniqueKeys(subjectDraft.value)
    subjectDraft.value = draftKeys
    if (draftKeys.length > state.limits.max_subjects) {
      throw new Error(`Select up to ${state.limits.max_subjects} subjects only.`)
    }
    const subjects = state.availableSubjects
      .filter((s) => draftKeys.includes(s.subject_key))
      .map((s) => ({
        subject_key: s.subject_key,
        subject_name: s.subject_name,
        exam_board: s.exam_board,
        qualification_type: s.qualification_type,
      }))
    const data = await saveLiteSubjects(callFn, subjects)
    state.selectedSubjects = dedupeSubjects(data.selected_subjects)
    if (!state.selectedSubjects.some((s) => s.subject_key === state.selectedSubjectKey)) {
      state.selectedSubjectKey = state.selectedSubjects[0]?.subject_key || ''
    }
    await loadCards()
    closeSubjectModal()
    trackEventSafe('subjects_saved', 'subject_modal', { selected_count: state.selectedSubjects.length })
  } catch (e) {
    handleLiteError(e, 'Could not save subjects.', 'subject_modal')
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
  openTopicCards(row.topic_code, row.label || row.topic_code || 'this topic')
}

function resetCreateFlow() {
  createFlowStep.value = 'topic'
  createTopicSearch.value = ''
  createSelectedTopic.value = activeTopicFilter.value || aiTopic.value || manualTopic.value || ''
  createSelectedMethod.value = ''
  manualSelectedTopic.value = createSelectedTopic.value
  manualFront.value = ''
  manualBack.value = ''
  aiTopic.value = createSelectedTopic.value
  aiGuidance.value = ''
  aiPreviewCards.value = []
  previewFlippedByKey.value = {}
  previewSelectionByKey.value = {}
  previewMetaCard.value = null
  previewIndex.value = 0
}

function isValidLeafTopic(topicCode) {
  const code = String(topicCode || '').trim()
  if (!code) return false
  return createLeafTopics.value.some((t) => String(t.topic_code) === code)
}

function openCreateFlow(topicCode = '') {
  clearError()
  resetCreateFlow()
  const picked = String(topicCode || '').trim()
  if (picked && isValidLeafTopic(picked)) {
    createSelectedTopic.value = picked
    manualSelectedTopic.value = picked
    aiTopic.value = picked
    createFlowStep.value = 'method'
  } else if (createSelectedTopic.value && isValidLeafTopic(createSelectedTopic.value)) {
    // If the user already selected a leaf topic in the topic tree, skip re-picking.
    createFlowStep.value = 'method'
  }
  createFlowOpen.value = true
}

function closeCreateFlow() {
  createFlowOpen.value = false
  resetCreateFlow()
}

function pickCreateTopic(topicCode) {
  createSelectedTopic.value = String(topicCode || '').trim()
  manualSelectedTopic.value = createSelectedTopic.value
  aiTopic.value = createSelectedTopic.value
  createFlowStep.value = 'method'
}

function chooseCreateMethod(method) {
  createSelectedMethod.value = method
  createFlowStep.value = method === 'manual' ? 'manual' : 'ai_options'
}

async function createManualFromFlow() {
  clearError()
  if (!state.selectedSubjectKey || !manualSelectedTopic.value) {
    state.error = 'Pick a topic before creating a card.'
    return
  }
  if (!manualFront.value.trim() || !manualBack.value.trim()) {
    state.error = 'Add both question and answer to create a manual card.'
    return
  }
  state.busy = true
  try {
    await createLiteCard(callFn, {
      subject_key: state.selectedSubjectKey,
      topic_code: manualSelectedTopic.value,
      front_text: manualFront.value,
      back_text: manualBack.value,
      card_type: 'manual',
    })
    await loadCards()
    closeCreateFlow()
  } catch (e) {
    handleLiteError(e, 'Could not create manual card.', 'manual_card_create')
  } finally {
    state.busy = false
  }
}

async function generatePreviewCards() {
  clearError()
  if (!selectedSubject.value || !aiTopic.value.trim()) {
    state.error = 'Choose a topic before generating AI cards.'
    return
  }
  state.busy = true
  aiProgress.value = 0
  aiProgressLabel.value = 'Starting…'
  if (aiProgressTimer) window.clearInterval(aiProgressTimer)
  aiProgressTimer = window.setInterval(() => {
    // Simulated progress so the UI feels alive.
    aiProgress.value = Math.min(95, Number(aiProgress.value || 0) + (aiProgress.value < 70 ? 7 : 3))
    if (aiProgress.value < 25) aiProgressLabel.value = 'Preparing prompt…'
    else if (aiProgress.value < 55) aiProgressLabel.value = 'Generating cards…'
    else if (aiProgress.value < 80) aiProgressLabel.value = 'Formatting answers…'
    else aiProgressLabel.value = 'Finalising…'
  }, 420)
  try {
    const data = await generateLiteCards(callFn, {
      subject_key: state.selectedSubjectKey,
      subject: selectedSubject.value.subject_name,
      topic: aiTopic.value,
      topic_code: aiTopic.value,
      examBoard: selectedSubject.value.exam_board,
      examType: selectedSubject.value.qualification_type,
      questionType: aiType.value,
      numCards: Math.max(1, Math.min(5, Number(aiCount.value || 3))),
      contentGuidance: aiGuidance.value || '',
      preview_only: true,
    })
    aiProgress.value = 100
    aiProgressLabel.value = 'Done'
    aiPreviewCards.value = Array.isArray(data.preview_cards) ? data.preview_cards : []
    previewFlippedByKey.value = {}
    previewSelectionByKey.value = {}
    previewMetaCard.value = null
    previewIndex.value = 0
    if (!aiPreviewCards.value.length) {
      state.error = 'No preview cards generated. Try different guidance or topic wording.'
      return
    }
    createFlowStep.value = 'ai_preview'
  } catch (e) {
    handleLiteError(e, 'Could not generate preview cards.', 'ai_generate')
  } finally {
    state.busy = false
    if (aiProgressTimer) window.clearInterval(aiProgressTimer)
    aiProgressTimer = null
    window.setTimeout(() => {
      aiProgress.value = 0
      aiProgressLabel.value = ''
    }, 800)
  }
}

function removePreviewCard(index) {
  aiPreviewCards.value = aiPreviewCards.value.filter((_, i) => i !== index)
  previewIndex.value = Math.max(0, Math.min(previewIndex.value, aiPreviewCards.value.length - 1))
}

const activePreviewCard = computed(() => aiPreviewCards.value[previewIndex.value] || null)
const canPrevPreview = computed(() => aiPreviewCards.value.length > 1 && previewIndex.value > 0)
const canNextPreview = computed(() => aiPreviewCards.value.length > 1 && previewIndex.value < aiPreviewCards.value.length - 1)

function prevPreview() {
  if (!canPrevPreview.value) return
  previewIndex.value -= 1
}

function nextPreview() {
  if (!canNextPreview.value) return
  previewIndex.value += 1
}

function removeActivePreviewCard() {
  if (!activePreviewCard.value) return
  removePreviewCard(previewIndex.value)
}

function previewCardKey(card, index) {
  const previewId = String(card?.preview_id || '').trim()
  if (previewId) return previewId
  const front = String(card?.front_text || '').trim()
  return `${index}:${front.slice(0, 60)}`
}

function normalizeOptionText(value) {
  return String(value || '').trim().replace(/^([A-D])[)\].:\-]\s*/i, '')
}

function parsePreviewMcq(card) {
  const backText = String(card?.back_text || '')
  const lines = backText
    .split('\n')
    .map((line) => String(line || '').trim())
    .filter(Boolean)

  const options = []
  const infoLines = []
  lines.forEach((line) => {
    const optionMatch = line.match(/^([A-D])[)\].:\-]\s*(.+)$/i)
    if (optionMatch) {
      options.push({
        key: String(optionMatch[1] || '').toUpperCase(),
        text: normalizeOptionText(optionMatch[2] || ''),
      })
      return
    }
    if (/^correct\s*answer\s*[:\-]?\s*[A-D]/i.test(line)) return
    infoLines.push(line)
  })

  const correct = String((backText.match(/correct\s*answer\s*[:\-]?\s*([A-D])/i) || [])[1] || '').toUpperCase()
  return {
    options,
    correct,
    info: infoLines.join('\n').trim(),
  }
}

function isPreviewFlipped(card, index) {
  const key = previewCardKey(card, index)
  return Boolean(previewFlippedByKey.value[key])
}

function togglePreviewFlip(card, index) {
  const key = previewCardKey(card, index)
  previewFlippedByKey.value = {
    ...previewFlippedByKey.value,
    [key]: !previewFlippedByKey.value[key],
  }
}

function choosePreviewOption(card, index, optionKey) {
  const key = previewCardKey(card, index)
  previewSelectionByKey.value = {
    ...previewSelectionByKey.value,
    [key]: optionKey,
  }
}

function previewOptionClass(card, index, optionKey, correctKey) {
  const key = previewCardKey(card, index)
  const selected = String(previewSelectionByKey.value[key] || '')
  return {
    selected: selected === optionKey,
    correct: Boolean(correctKey) && optionKey === correctKey && Boolean(selected),
    wrong: Boolean(selected) && selected === optionKey && optionKey !== correctKey,
  }
}

function openPreviewMeta(card, index) {
  const parsed = parsePreviewMcq(card)
  previewMetaCard.value = {
    index: index + 1,
    info: parsed.info,
  }
}

function closePreviewMeta() {
  previewMetaCard.value = null
}

async function savePreviewCardsToBank() {
  clearError()
  if (!state.selectedSubjectKey || !aiPreviewCards.value.length) {
    state.error = 'No preview cards selected to save.'
    return
  }
  state.busy = true
  try {
    for (const card of aiPreviewCards.value) {
      await createLiteCard(callFn, {
        subject_key: state.selectedSubjectKey,
        topic_code: String(card?.topic_code || aiTopic.value || '').trim() || null,
        front_text: String(card?.front_text || '').trim(),
        back_text: String(card?.back_text || '').trim(),
        card_type: String(card?.card_type || `ai_${aiType.value}`),
      })
    }
    await loadCards()
    closeCreateFlow()
  } catch (e) {
    handleLiteError(e, 'Could not save generated cards.', 'ai_generate_save')
  } finally {
    state.busy = false
  }
}
function openCardModal(card) {
  if (!card) return
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

async function ensureCardBankCards(subjectKey) {
  const key = String(subjectKey || '').trim()
  if (!key) return
  if (cardBankCardsBySubject.value[key]) return
  cardBankLoading.value = true
  cardBankError.value = ''
  try {
    const data = await listLiteCards(callFn, key)
    cardBankCardsBySubject.value = {
      ...cardBankCardsBySubject.value,
      [key]: Array.isArray(data.cards) ? data.cards : [],
    }
  } catch (e) {
    cardBankError.value = e?.message || 'Could not load cards for Card Bank.'
  } finally {
    cardBankLoading.value = false
  }
}

async function openCardBank(subjectKey = '') {
  const target = String(subjectKey || state.selectedSubjectKey || '').trim()
  cardBankSubjectKey.value = target
  cardBankIndex.value = 0
  cardBankFlipped.value = false
  cardBankSelectedOption.value = ''
  cardBankSelectedCorrect.value = null
  cardBankMetaOpen.value = false
  cardBankOpen.value = true
  await ensureCardBankCards(target)
}

function closeCardBank() {
  cardBankOpen.value = false
  cardBankSubjectKey.value = ''
  cardBankIndex.value = 0
  cardBankFlipped.value = false
  cardBankSelectedOption.value = ''
  cardBankSelectedCorrect.value = null
  cardBankMetaOpen.value = false
  cardBankError.value = ''
}

function openBoxPreview(boxNumber) {
  const box = Math.max(1, Math.min(5, Number(boxNumber || 1)))
  boxPreviewBox.value = box
  const ids = state.cards
    .filter((c) => Number(c?.box_number || 1) === box)
    .map((c) => c.id)
  boxPreviewCardIds.value = ids
  boxPreviewIndex.value = 0
  boxPreviewOpen.value = true
}
function closeBoxPreview() {
  boxPreviewOpen.value = false
  boxPreviewCardIds.value = []
  boxPreviewIndex.value = 0
}
const boxPreviewCards = computed(() => {
  const ids = boxPreviewCardIds.value
  if (!ids.length) return []
  return ids
    .map((id) => state.cards.find((c) => c.id === id))
    .filter(Boolean)
})
const activeBoxPreviewCard = computed(() => boxPreviewCards.value[boxPreviewIndex.value] || null)
const canPrevBoxPreview = computed(() => boxPreviewCards.value.length > 1 && boxPreviewIndex.value > 0)
const canNextBoxPreview = computed(() => boxPreviewCards.value.length > 1 && boxPreviewIndex.value < boxPreviewCards.value.length - 1)
function prevBoxPreview() {
  if (!canPrevBoxPreview.value) return
  boxPreviewIndex.value -= 1
}
function nextBoxPreview() {
  if (!canNextBoxPreview.value) return
  boxPreviewIndex.value += 1
}
function goToStudyFromPreview() {
  closeBoxPreview()
  startStudy()
}

const activeCardBankCards = computed(() => {
  const key = String(cardBankSubjectKey.value || '').trim()
  const cards = cardBankCardsBySubject.value[key]
  return Array.isArray(cards) ? cards : []
})
const activeCardBankCard = computed(() => activeCardBankCards.value[cardBankIndex.value] || null)
const activeCardBankMcq = computed(() => parseMcq(activeCardBankCard.value || {}))
const isCardBankMcq = computed(() => activeCardBankMcq.value.options.length > 0)
const activeCardBankSections = computed(() => parseBackTextSections(activeCardBankCard.value || {}))

function bankPrev() {
  if (cardBankIndex.value <= 0) return
  cardBankIndex.value -= 1
  cardBankFlipped.value = false
  cardBankSelectedOption.value = ''
  cardBankSelectedCorrect.value = null
}
function bankNext() {
  if (cardBankIndex.value >= activeCardBankCards.value.length - 1) return
  cardBankIndex.value += 1
  cardBankFlipped.value = false
  cardBankSelectedOption.value = ''
  cardBankSelectedCorrect.value = null
}
function bankToggleFlip() {
  if (isCardBankMcq.value) return
  cardBankFlipped.value = !cardBankFlipped.value
}
function bankChooseOption(key) {
  if (!isCardBankMcq.value) return
  if (cardBankSelectedOption.value) return
  cardBankSelectedOption.value = key
  const correct = String(activeCardBankMcq.value?.correct || '').toUpperCase()
  cardBankSelectedCorrect.value = correct ? key === correct : null
}
function bankOpenMeta() {
  cardBankMetaOpen.value = true
}
function bankCloseMeta() {
  cardBankMetaOpen.value = false
}
async function bankSwitchSubject(subjectKey) {
  const key = String(subjectKey || '').trim()
  if (!key) return
  cardBankSubjectKey.value = key
  cardBankIndex.value = 0
  cardBankFlipped.value = false
  cardBankSelectedOption.value = ''
  cardBankSelectedCorrect.value = null
  cardBankMetaOpen.value = false
  await ensureCardBankCards(key)
}

function sortedCardsForTopic(topicCode) {
  const now = Date.now()
  return state.cards
    .filter((card) => String(card?.topic_code || '') === String(topicCode || ''))
    .sort((a, b) => {
      const aDueAt = a?.next_review_at ? new Date(a.next_review_at).getTime() : 0
      const bDueAt = b?.next_review_at ? new Date(b.next_review_at).getTime() : 0
      const aDue = !aDueAt || aDueAt <= now
      const bDue = !bDueAt || bDueAt <= now
      if (aDue !== bDue) return aDue ? -1 : 1
      if (aDueAt !== bDueAt) return aDueAt - bDueAt
      return String(a?.front_text || '').localeCompare(String(b?.front_text || ''))
    })
}

function openTopicCards(topicCode, label = 'this topic') {
  const cardsForTopic = sortedCardsForTopic(topicCode)
  if (!cardsForTopic.length) {
    state.error = `No cards saved yet for ${label}. Add or generate cards first.`
    return
  }
  clearError()
  topicModalCardIds.value = cardsForTopic.map((card) => card.id)
  topicModalIndex.value = 0
  openCardModal(cardsForTopic[0])
}

function openModalCardByIndex(nextIndex) {
  const ids = topicModalCardIds.value
  if (!ids.length) return
  const index = Math.max(0, Math.min(ids.length - 1, nextIndex))
  const targetId = ids[index]
  const targetCard = state.cards.find((card) => card.id === targetId)
  if (!targetCard) return
  topicModalIndex.value = index
  openCardModal(targetCard)
}

function openPrevModalCard() {
  if (!canPrevModalCard.value) return
  openModalCardByIndex(topicModalIndex.value - 1)
}

function openNextModalCard() {
  if (!canNextModalCard.value) return
  openModalCardByIndex(topicModalIndex.value + 1)
}

function closeCardModal() {
  cardModal.open = false
  topicModalCardIds.value = []
  topicModalIndex.value = 0
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
    handleLiteError(e, 'Could not submit review.', 'card_modal')
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
    handleLiteError(e, 'Could not create card.', 'manual_card_create')
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
      openUpsell('Lite card limit reached', 'Get the full FL4SH app for unlimited cards and full study tools.', 'ai_generate')
    }
  } catch (e) {
    handleLiteError(e, 'Could not generate cards.', 'ai_generate')
  } finally {
    state.busy = false
  }
}

async function requestDeleteCard(cardId) {
  if (!cardId || state.busy) return
  const confirmed = window.confirm('Delete this card permanently from Lite?')
  if (!confirmed) return
  await deleteCard(cardId)
}

async function deleteCard(cardId) {
  state.busy = true
  try {
    await deleteLiteCard(callFn, cardId)
    await loadCards()
  } catch (e) {
    handleLiteError(e, 'Could not delete card.', 'card_delete')
  } finally {
    state.busy = false
  }
}

function startStudy() {
  const dueTotal = dueCards.value.length
  state.studyIndex = 0
  state.studyStarted = false
  state.sessionReviewed = 0
  state.sessionTotalDue = dueTotal
  state.lastStudyOutcome = ''
  state.sessionDone = false
  state.revealAnswer = false
  view.value = 'study'
}

function beginStudySession() {
  if (dueCards.value.length <= 0) return
  state.studyStarted = true
  state.revealAnswer = false
  state.lastStudyOutcome = ''
}

onMounted(loadContext)
</script>

<template>
  <div class="page">
    <LiteHeader
      :user="state.user"
      :limits="state.limits"
      :links="LINKS"
      @store-click="onHeaderStoreClick"
      @website-click="onHeaderWebsiteClick"
    />

    <div v-if="state.error" class="error">{{ state.error }}</div>
    <div v-if="state.catalogWarning" class="error">{{ state.catalogWarning }}</div>
    <div v-if="state.loading" class="loading">Loading FL4SH Lite...</div>

    <main class="layout" v-if="!state.loading">
      <SubjectSidebar
        :selected-subjects="filteredSelectedSubjects"
        :all-selected-subjects-length="state.selectedSubjects.length"
        :selected-subject-key="state.selectedSubjectKey"
        :limits="state.limits"
        :subject-search="subjectSearch"
        :get-subject-color="getSubjectColor"
        :get-subject-theme="getSubjectTheme"
        @manage-subjects="openSubjectModal"
        @open-subject="openSubject"
        @set-subject-color="setSubjectColorFromSidebar"
        @update:subject-search="subjectSearch = $event"
      />

      <SubjectHomePanel
        :visible="view === 'home'"
        :selected-subjects="filteredSelectedSubjects"
        :all-selected-subjects-length="state.selectedSubjects.length"
        :subject-search="subjectSearch"
        :limits="state.limits"
        :get-subject-color="getSubjectColor"
        @open-subject="openSubject"
        @update:subject-search="subjectSearch = $event"
        @manage-subjects="openSubjectModal"
      />

      <SubjectDetailPanel
        :visible="view === 'subject'"
        :selected-subject="selectedSubject"
        :cards="state.cards"
        :box-stats="boxStats"
        :topic-tree-loading="state.topicTreeLoading"
        :topic-tree-error="state.topicTreeError"
        :active-topic-filter="activeTopicFilter"
        :topic-priorities="topicPriorities"
        :topic-tree="topicTree"
        :topic-rows="topicRows"
        :expanded-topics="expandedTopics"
        :selected-subject-key="state.selectedSubjectKey"
        :selected-subject-meta="selectedSubjectMeta"
        :get-subject-color="getSubjectColor"
        :due-count="dueCountInSubject"
        :mastered-count="masteredCountInSubject"
        :topic-count="topicCountInSubject"
        :has-active-filters="hasActiveFilters"
        @start-study="startStudy"
        @back-home="view = 'home'"
        @set-active-topic-filter="activeTopicFilter = $event"
        @toggle-topic-row="toggleTopicRow"
        @open-create-flow="openCreateFlow($event)"
        @open-card-bank="openCardBank"
        @set-topic-priority="setTopicPriority"
        @open-box-preview="openBoxPreview($event)"
      />

      <StudyPanel
        :visible="view === 'study'"
        :selected-subject="selectedSubject"
        :all-cards="state.cards"
        :box-stats="boxStats"
        :pulse-box="pulseBox"
        :moving-card-text="movingCardText"
        :short-line="shortLine"
        :parse-mcq="parseMcq"
        :session-done="state.sessionDone"
        :session-started="state.studyStarted"
        :due-cards-length="dueCards.length"
        :total-cards-length="totalCardsInSubject"
        :session-reviewed="state.sessionReviewed"
        :session-total-due="state.sessionTotalDue"
        :progress-percent="studyProgressPercent"
        :last-outcome="state.lastStudyOutcome"
        :active-study-card="activeStudyCard"
        :reveal-answer="state.revealAnswer"
        :links="LINKS"
        @back-to-subject="backToSubjectFromStudy"
        @begin-session="beginStudySession"
        @set-reveal-answer="state.revealAnswer = $event"
        @apply-study-grade="applyStudyGrade"
        @store-click="onStudyStoreClick"
      />
    </main>

    <div class="modal" v-if="cardBankOpen">
      <div class="modal-card neon create-flow-modal">
        <div class="panel-head">
          <div>
            <h3>Card Bank</h3>
            <small class="muted">Revise cards in a slideshow (front ↔ back) with quick access to extra info.</small>
          </div>
          <button class="mini-btn" @click="closeCardBank">Close</button>
        </div>

        <div class="toolbar" style="flex-wrap: wrap; justify-content: flex-start;">
          <button
            v-for="s in state.selectedSubjects"
            :key="`bank-subject-${s.subject_key}`"
            class="mini-btn"
            :class="{ active: cardBankSubjectKey === s.subject_key }"
            @click="bankSwitchSubject(s.subject_key)"
          >
            {{ s.subject_name }}
          </button>
        </div>

        <div v-if="cardBankLoading" class="muted" style="padding: 8px 2px;">Loading cards…</div>
        <div v-else-if="cardBankError" class="muted" style="padding: 8px 2px;">{{ cardBankError }}</div>
        <div v-else-if="!activeCardBankCards.length" class="muted" style="padding: 8px 2px;">
          No cards in this subject yet. Create some cards first, then come back here to revise.
        </div>

        <template v-else>
          <div class="preview-header-row" style="margin-top: 10px;">
            <span class="muted">{{ selectedSubjectMeta() }}</span>
            <div class="toolbar">
              <span class="box-chip" :class="`box-${activeCardBankCard.box_number || 1}`">Box {{ activeCardBankCard.box_number || 1 }}</span>
              <button class="mini-btn" :disabled="cardBankIndex <= 0" @click="bankPrev">‹</button>
              <span class="mini-chip">{{ `${cardBankIndex + 1} / ${activeCardBankCards.length}` }}</span>
              <button class="mini-btn" :disabled="cardBankIndex >= activeCardBankCards.length - 1" @click="bankNext">›</button>
            </div>
          </div>

          <div class="preview-stage" v-if="activeCardBankCard">
            <div class="preview-counter">{{ cardBankIndex + 1 }} / {{ activeCardBankCards.length }}</div>

            <div class="preview-body">
              <div class="preview-question">{{ activeCardBankCard.front_text }}</div>

              <div class="preview-options" v-if="isCardBankMcq">
                <button
                  v-for="opt in activeCardBankMcq.options"
                  :key="`bank-opt-${activeCardBankCard.id}-${opt.key}`"
                  class="preview-option"
                  :class="{
                    selected: cardBankSelectedOption === opt.key,
                    correct: Boolean(cardBankSelectedOption) && opt.key === activeCardBankMcq.correct,
                    wrong: Boolean(cardBankSelectedOption) && cardBankSelectedOption === opt.key && opt.key !== activeCardBankMcq.correct,
                  }"
                  @click="bankChooseOption(opt.key)"
                >
                  <span class="preview-option-key">{{ opt.key }}</span>
                  <span class="preview-option-text">{{ opt.text }}</span>
                </button>
                <div v-if="cardBankSelectedOption" class="preview-answer" style="margin-top: 10px;">
                  <div class="preview-answer-head">
                    <span class="muted">Detailed answer</span>
                  </div>
                  <div class="preview-answer-box">
                    {{ activeCardBankMcq.info || 'Detailed answer not available for this card.' }}
                  </div>
                </div>
              </div>

              <div class="preview-answer" v-else>
                <div class="preview-answer-head">
                  <span class="muted">Answer</span>
                  <button class="mini-btn ghost" @click="bankToggleFlip">{{ cardBankFlipped ? 'Hide' : 'Reveal' }}</button>
                </div>
                <div v-if="cardBankFlipped" class="preview-answer-box">
                  {{ activeCardBankSections.answer || shortLine(activeCardBankSections.detailed, 520) || activeCardBankCard.back_text }}
                </div>
              </div>
            </div>

            <div class="preview-footer">
              <div class="preview-footer-left">
                <button class="info-icon-btn" title="More info" @click="bankOpenMeta"><span>i</span></button>
              </div>
              <div class="toolbar">
                <button class="mini-btn ghost" :disabled="cardBankIndex <= 0" @click="bankPrev">Prev</button>
                <button class="mini-btn ghost" :disabled="cardBankIndex >= activeCardBankCards.length - 1" @click="bankNext">Next</button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="modal" v-if="cardBankMetaOpen && activeCardBankCard">
      <div class="modal-card neon">
        <div class="panel-head">
          <h3>Card info</h3>
          <button class="mini-btn" @click="bankCloseMeta">Close</button>
        </div>
        <div class="modal-meta-row">
          <span class="mini-chip">Box {{ activeCardBankCard.box_number || 1 }}</span>
          <span class="mini-chip">{{ cardDueBadge(activeCardBankCard) }}</span>
          <span class="mini-chip">Topic: {{ activeCardBankCard.topic_code || 'General' }}</span>
          <span class="mini-chip">{{ selectedSubjectMeta() }}</span>
        </div>
        <div class="section-shell">
          <strong class="muted">Question</strong>
          <p>{{ activeCardBankCard.front_text }}</p>
          <strong class="muted">Answer</strong>
          <p style="white-space: pre-wrap;">{{ activeCardBankSections.answer || '—' }}</p>
          <strong class="muted">Detailed breakdown</strong>
          <p style="white-space: pre-wrap;">{{ activeCardBankSections.detailed || 'Open FL4SH for the deeper breakdown, examples, and links to related topics.' }}</p>
          <div v-if="activeCardBankSections.relatedTopics && activeCardBankSections.relatedTopics.length" style="margin-top: 10px;">
            <strong class="muted">Related topics</strong>
            <div class="toolbar" style="margin-top: 6px; flex-wrap: wrap; justify-content:flex-start;">
              <span v-for="t in activeCardBankSections.relatedTopics.slice(0, 8)" :key="`rel-${t}`" class="mini-chip">{{ t }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal" v-if="boxPreviewOpen">
      <div class="modal-card neon create-flow-modal">
        <div class="panel-head">
          <div>
            <h3>Box {{ boxPreviewBox }} preview</h3>
            <small class="muted">Questions only — no answers shown here.</small>
          </div>
          <button class="mini-btn" @click="closeBoxPreview">Close</button>
        </div>

        <div v-if="!boxPreviewCards.length" class="muted" style="padding: 10px 2px;">
          No cards in this box yet.
        </div>

        <template v-else>
          <div class="preview-header-row" style="margin-top: 10px;">
            <span class="muted">{{ selectedSubjectMeta() }}</span>
            <div class="toolbar">
              <button class="mini-btn" :disabled="!canPrevBoxPreview" @click="prevBoxPreview">‹</button>
              <span class="mini-chip">{{ `${boxPreviewIndex + 1} / ${boxPreviewCards.length}` }}</span>
              <button class="mini-btn" :disabled="!canNextBoxPreview" @click="nextBoxPreview">›</button>
            </div>
          </div>

          <div class="preview-stage" v-if="activeBoxPreviewCard">
            <div class="preview-counter">{{ boxPreviewIndex + 1 }} / {{ boxPreviewCards.length }}</div>
            <div class="preview-body" style="min-height: 260px;">
              <div class="preview-question">{{ activeBoxPreviewCard.front_text }}</div>

              <div v-if="!isCardDue(activeBoxPreviewCard)" class="locked-cover">
                <div class="locked-card">
                  <strong>Locked</strong>
                  <div class="muted">Locked until {{ formatDate(activeBoxPreviewCard.next_review_at) }}</div>
                </div>
              </div>

              <div v-else class="notice neon" style="margin-top: 8px;">
                Would you like to <strong>study</strong> these cards now?
                <div class="toolbar" style="margin-top: 8px;">
                  <button class="btn neon-btn" style="width:auto;" @click="goToStudyFromPreview">Go to Study Mode</button>
                </div>
              </div>
            </div>
            <div class="preview-footer">
              <div class="preview-footer-left"></div>
              <div class="toolbar">
                <button class="mini-btn ghost" :disabled="!canPrevBoxPreview" @click="prevBoxPreview">Prev</button>
                <button class="mini-btn ghost" :disabled="!canNextBoxPreview" @click="nextBoxPreview">Next</button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <UpsellModal
      :visible="state.showUpsell"
      :title="state.upsellTitle"
      :message="state.upsellMessage"
      :links="LINKS"
      @close="closeUpsell"
      @store-click="onUpsellStoreClick"
    />

    <SubjectSelectionModal
      :visible="state.showSubjectModal"
      :exam-level-choices="examLevelChoices"
      :modal-level="modalLevel"
      :modal-search="modalSearch"
      :filtered-modal-subjects="filteredModalSubjects"
      :result-count="filteredModalSubjects.length"
      :subject-draft="subjectDraft"
      :max-subjects="state.limits.max_subjects"
      :busy="state.busy"
      @close="closeSubjectModal"
      @update:modal-level="modalLevel = $event"
      @update:modal-search="modalSearch = $event"
      @toggle-subject="selectSubjectFromModal"
      @save-subjects="saveSubjects"
    />

    <div class="modal" v-if="createFlowOpen">
      <div class="modal-card neon create-flow-modal">
        <div class="panel-head">
          <h3>Create Flashcards</h3>
          <button class="mini-btn" @click="closeCreateFlow">Close</button>
        </div>

        <template v-if="createFlowStep === 'topic'">
          <p class="muted">Step 1: choose a topic</p>
          <input v-model="createTopicSearch" placeholder="Search topic..." />
          <div class="topic-tree-list">
            <div v-if="createTopicSearch.trim().length < 2" class="muted" style="padding: 10px 4px;">
              Start typing to search topics (at least 2 characters). This avoids loading hundreds of topics at once.
            </div>
            <template v-else>
              <button
                v-for="row in createTopicCandidates"
                :key="`create-${row.id}`"
                class="topic-row"
                :class="{ active: createSelectedTopic === row.topic_code }"
                @click="pickCreateTopic(row.topic_code)"
              >
                <span class="topic-label">{{ row.label }}</span>
                <strong>{{ row.count || 0 }}</strong>
              </button>
              <div v-if="!createTopicCandidates.length" class="muted" style="padding: 8px 4px;">
                No topics matched your search for this subject.
              </div>
            </template>
          </div>
        </template>

        <template v-else-if="createFlowStep === 'method'">
          <div class="panel-head" style="margin-bottom: 8px;">
            <p class="muted" style="margin:0;">Step 2: choose creation method</p>
            <button class="mini-btn ghost" @click="createFlowStep = 'topic'">Change topic</button>
          </div>
          <small class="muted">Topic: <strong>{{ createSelectedTopic }}</strong></small>
          <div class="create-method-grid">
            <button class="create-method-card" @click="chooseCreateMethod('ai')">
              <h4>AI Generated</h4>
              <p>Create exam-style cards quickly from your selected topic.</p>
            </button>
            <button class="create-method-card" @click="chooseCreateMethod('manual')">
              <h4>Create Manually</h4>
              <p>Write your own custom flashcards for this topic.</p>
            </button>
          </div>
        </template>

        <template v-else-if="createFlowStep === 'manual'">
          <p class="muted">Manual card for <strong>{{ manualSelectedTopic }}</strong></p>
          <textarea v-model="manualFront" placeholder="Question / front of card"></textarea>
          <textarea v-model="manualBack" placeholder="Answer / back of card"></textarea>
          <div class="toolbar">
            <button class="btn ghost" @click="createFlowStep = 'method'">Back</button>
            <button class="btn neon-btn" :disabled="state.busy" @click="createManualFromFlow">
              {{ state.busy ? 'Saving...' : 'Save manual card' }}
            </button>
          </div>
        </template>

        <template v-else-if="createFlowStep === 'ai_options'">
          <div class="panel-head" style="margin-bottom: 8px;">
            <p class="muted" style="margin:0;">AI generation</p>
            <button class="mini-btn ghost" @click="createFlowStep = 'method'">Change method</button>
          </div>
          <small class="muted">Topic: <strong>{{ aiTopic }}</strong></small>
          <div class="forms">
            <div class="form-card">
              <label class="muted">AI Card Type</label>
              <select v-model="aiType">
                <option value="short_answer">Short answer</option>
                <option value="multiple_choice">Multiple choice</option>
                <option value="essay">Essay</option>
                <option value="acronym">Acronym</option>
              </select>
              <label class="muted">Number of Cards (max 5 per run)</label>
              <input type="number" min="1" max="5" v-model="aiCount" />
              <label class="muted">Additional guidance (optional)</label>
              <textarea v-model="aiGuidance" placeholder="Focus on practical examples, key terms..." />
            </div>
          </div>
          <small class="muted">Lite allows up to 20 AI-generated cards per subject. Manual cards are unlimited.</small>
          <div v-if="state.busy && aiProgress" class="ai-progress-shell">
            <div class="ai-progress-head">
              <small class="muted">{{ aiProgressLabel || 'Generating…' }}</small>
              <small class="muted">{{ aiProgress }}%</small>
            </div>
            <div class="ai-progress-track">
              <div class="ai-progress-fill" :style="{ width: `${aiProgress}%` }"></div>
            </div>
          </div>
          <div class="toolbar" style="margin-top:8px;">
            <button class="btn ghost" @click="createFlowStep = 'method'">Back</button>
            <button class="btn hot" :disabled="state.busy" @click="generatePreviewCards">
              {{ state.busy ? 'Generating...' : 'Generate preview' }}
            </button>
          </div>
        </template>

        <template v-else-if="createFlowStep === 'ai_preview'">
          <div class="preview-header-row">
            <span class="muted">Preview generated cards</span>
            <div class="toolbar">
              <button class="mini-btn ghost" @click="createFlowStep = 'ai_options'">Back</button>
              <button class="mini-btn" :disabled="!canPrevPreview" @click="prevPreview">‹</button>
              <span class="mini-chip">{{ aiPreviewCards.length ? `${previewIndex + 1} / ${aiPreviewCards.length}` : '0 / 0' }}</span>
              <button class="mini-btn" :disabled="!canNextPreview" @click="nextPreview">›</button>
            </div>
          </div>

          <div class="preview-stage" v-if="activePreviewCard">
            <div class="preview-counter">{{ previewIndex + 1 }} / {{ aiPreviewCards.length }}</div>

            <div class="preview-body">
              <div class="preview-question">
                {{ activePreviewCard.front_text }}
              </div>

              <div class="preview-options" v-if="parsePreviewMcq(activePreviewCard).options.length">
                <button
                  v-for="opt in parsePreviewMcq(activePreviewCard).options"
                  :key="`opt-${previewIndex}-${opt.key}`"
                  class="preview-option"
                  :class="previewOptionClass(activePreviewCard, previewIndex, opt.key, parsePreviewMcq(activePreviewCard).correct)"
                  @click="choosePreviewOption(activePreviewCard, previewIndex, opt.key)"
                >
                  <span class="preview-option-key">{{ opt.key }}</span>
                  <span class="preview-option-text">{{ opt.text }}</span>
                </button>
              </div>

              <div class="preview-answer" v-else>
                <div class="preview-answer-head">
                  <span class="muted">Answer</span>
                  <button class="mini-btn ghost" @click="togglePreviewFlip(activePreviewCard, previewIndex)">
                    {{ isPreviewFlipped(activePreviewCard, previewIndex) ? 'Hide' : 'Reveal' }}
                  </button>
                </div>
                <div v-if="isPreviewFlipped(activePreviewCard, previewIndex)" class="preview-answer-box">
                  {{ shortLine(activePreviewCard.back_text, 520) }}
                </div>
              </div>
            </div>

            <div class="preview-footer">
              <div class="preview-footer-left">
                <button class="preview-footer-btn remove" @click="removeActivePreviewCard">Remove</button>
                <button class="preview-footer-btn info" @click="openPreviewMeta(activePreviewCard, previewIndex)">More info</button>
              </div>
              <button class="btn neon-btn" :disabled="state.busy || aiPreviewCards.length === 0" @click="savePreviewCardsToBank">
                {{ state.busy ? 'Saving...' : `Save ${aiPreviewCards.length} card${aiPreviewCards.length === 1 ? '' : 's'}` }}
              </button>
            </div>
          </div>

          <div v-else class="muted" style="padding: 10px 2px;">
            All preview cards removed. Go back to generate more.
          </div>

          <div class="toolbar" style="margin-top:8px;">
            <button class="btn ghost" @click="createFlowStep = 'ai_options'">Generate different cards</button>
          </div>
        </template>
      </div>
    </div>

    <div class="modal" v-if="previewMetaCard">
      <div class="modal-card neon">
        <div class="panel-head">
          <h3>Additional Information</h3>
          <button class="mini-btn" @click="closePreviewMeta">Close</button>
        </div>
        <div class="section-shell">
          <strong class="muted">Card {{ previewMetaCard.index }}</strong>
          <p>{{ previewMetaCard.info || 'No additional metadata extracted from this card.' }}</p>
        </div>
      </div>
    </div>

    <CardDetailModal
      :visible="cardModal.open"
      :card-modal="cardModal"
      :busy="state.busy"
      :is-card-due="isCardDue"
      :card-due-badge="cardDueBadge"
      :selected-subject-meta="selectedSubjectMeta"
      :card-modal-back-summary="cardModalBackSummary"
      :format-date-time="formatDateTime"
      :can-prev-card="canPrevModalCard"
      :can-next-card="canNextModalCard"
      :sequence-label="modalSequenceLabel"
      @close="closeCardModal"
      @toggle-flip="cardModal.flipped = !cardModal.flipped"
      @toggle-details="cardModal.showDetails = !cardModal.showDetails"
      @choose-option="chooseMcqOption"
      @review="reviewFromModal"
      @prev-card="openPrevModalCard"
      @next-card="openNextModalCard"
    />
  </div>
</template>
