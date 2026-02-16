<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { LINKS, callFn } from './lib/api'

const view = ref('home') // home | subject | study
const state = reactive({
  loading: true,
  busy: false,
  error: '',
  user: null,
  limits: { max_subjects: 2, max_cards_per_subject: 10 },
  availableSubjects: [],
  selectedSubjects: [],
  selectedSubjectKey: '',
  cards: [],
  showUpsell: false,
  upsellTitle: '',
  upsellMessage: '',
  studyIndex: 0,
  sessionReviewed: 0,
  revealAnswer: false,
  sessionDone: false,
  catalogWarning: '',
  showSubjectModal: false,
  topicTreeLoading: false,
  topicTreeError: '',
})

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
const cardModal = reactive({
  open: false,
  flipped: false,
  showDetails: false,
  card: null,
  mcqOptions: [],
  selectedOption: '',
  correctOption: '',
  selectedCorrect: null,
})
const examLevelChoices = [
  { label: 'GCSE', values: ['GCSE'] },
  { label: 'A Level', values: ['A_LEVEL', 'A-LEVEL', 'A Level'] },
  { label: 'International GCSE', values: ['INTERNATIONAL_GCSE', 'IGCSE', 'I_GCSE'] },
  { label: 'International A Level', values: ['INTERNATIONAL_A_LEVEL', 'IALEVEL', 'I_ALEVEL', 'I A_LEVEL'] },
  { label: 'Vocational Level 2', values: ['VOCATIONAL_L2', 'CAMBRIDGE_NATIONALS_L2'] },
  { label: 'Vocational Level 3', values: ['VOCATIONAL_L3', 'BTEC_NATIONALS_L3', 'CAMBRIDGE_TECHNICALS_L3'] },
  { label: 'National 5', values: ['NATIONAL_5'] },
  { label: 'Higher / Advanced Higher', values: ['HIGHER', 'ADVANCED_HIGHER', 'SQA_HIGHER'] },
]

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

const boxConfig = [
  { box: 1, title: 'New', interval: '1d' },
  { box: 2, title: 'Warm', interval: '2d' },
  { box: 3, title: 'Solid', interval: '4d' },
  { box: 4, title: 'Strong', interval: '7d' },
  { box: 5, title: 'Mastered', interval: '21d' },
]

function cardBox(card) {
  return Number(card.box_number || 1)
}

function shortLine(text, max = 44) {
  const t = String(text || '').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max - 1)}...` : t
}
function formatDate(dateValue) {
  if (!dateValue) return 'Not scheduled'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return 'Not scheduled'
  return d.toLocaleDateString()
}
function formatDateTime(dateValue) {
  if (!dateValue) return 'Not scheduled'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return 'Not scheduled'
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}
function isCardDue(card) {
  const dueAt = card?.next_review_at ? new Date(card.next_review_at).getTime() : 0
  return !dueAt || dueAt <= Date.now()
}
function colorKey() {
  const email = String(state.user?.email || 'anon').toLowerCase()
  return `fl4sh-lite-subject-colors:${email}`
}
function loadSubjectColors() {
  try {
    subjectColors.value = JSON.parse(localStorage.getItem(colorKey()) || '{}')
  } catch {
    subjectColors.value = {}
  }
}
function saveSubjectColors() {
  localStorage.setItem(colorKey(), JSON.stringify(subjectColors.value))
}
function getSubjectColor(subjectKey) {
  return subjectColors.value[subjectKey] || '#7c4dff'
}
function setSubjectColor(subjectKey, color) {
  subjectColors.value = { ...subjectColors.value, [subjectKey]: color }
  saveSubjectColors()
}

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
    const data = await callFn('fl4sh-lite-submit-review', {
      card_id: card.id,
      correct,
    })
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
    const data = await callFn('fl4sh-lite-context')
    state.user = data.user || null
    state.limits = data.limits || state.limits
    state.availableSubjects = Array.isArray(data.available_subjects) ? data.available_subjects : []
    state.catalogWarning = String(data.catalog_warning || '')
    state.selectedSubjects = Array.isArray(data.selected_subjects) ? data.selected_subjects : []
    loadSubjectColors()
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
    const data = await callFn('fl4sh-lite-list-cards', { subject_key: state.selectedSubjectKey })
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
    const data = await callFn('fl4sh-lite-topic-tree', { subject_key: state.selectedSubjectKey })
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
    const data = await callFn('fl4sh-lite-select-subjects', { subjects })
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
function flattenTopicRows(nodes, depth = 0, out = []) {
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
    if (children.length && expandedTopics.value[id]) flattenTopicRows(children, depth + 1, out)
  })
  return out
}
const topicRows = computed(() => flattenTopicRows(topicTree.value || []))
function toggleTopicRow(row) {
  if (row.hasChildren) {
    expandedTopics.value = { ...expandedTopics.value, [row.id]: !expandedTopics.value[row.id] }
    return
  }
  activeTopicFilter.value = row.topic_code
  manualTopic.value = row.topic_code
  aiTopic.value = row.topic_code
}
function parseMcq(card) {
  const blob = `${card.front_text || ''}\n${card.back_text || ''}`
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
    const data = await callFn('fl4sh-lite-submit-review', { card_id: card.id, correct })
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
    await callFn('fl4sh-lite-create-card', {
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
    await callFn('fl4sh-lite-generate-cards', {
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
    await callFn('fl4sh-lite-delete-card', { card_id: cardId })
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
    <header class="topbar neon">
      <div class="brand-wrap">
        <div class="logo-mark"><img src="/flashv2.png" alt="FL4SH logo" /></div>
        <div>
          <div class="logo">FL4SH Lite</div>
          <div class="meta">{{ state.user?.name || 'Student' }} · {{ state.user?.school_name || '' }}</div>
        </div>
      </div>
      <div class="badge-row">
        <a :href="LINKS.appStore" target="_blank" rel="noopener" class="store-badge">
          <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" />
        </a>
        <a :href="LINKS.playStore" target="_blank" rel="noopener" class="store-badge">
          <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" />
        </a>
      </div>
    </header>

    <section class="notice neon">
      <strong>FL4SH Lite</strong> is limited to {{ state.limits.max_subjects }} subjects and {{ state.limits.max_cards_per_subject }} cards per subject.
      For full mobile-native experience, visit <a :href="LINKS.website" target="_blank" rel="noopener">fl4shcards.com</a>.
    </section>

    <div v-if="state.error" class="error">{{ state.error }}</div>
    <div v-if="state.catalogWarning" class="error">{{ state.catalogWarning }}</div>
    <div v-if="state.loading" class="loading">Loading FL4SH Lite...</div>

    <main class="layout" v-if="!state.loading">
      <aside class="panel">
        <div class="panel-head">
          <h3>Your subjects</h3>
          <button class="mini-btn active" @click="openSubjectModal">Manage</button>
        </div>
        <p class="muted">Choose up to {{ state.limits.max_subjects }} subjects in Lite.</p>
        <div class="subject-cards">
          <button
            v-for="s in state.selectedSubjects"
            :key="s.subject_key"
            class="subject-card"
            :class="{ active: state.selectedSubjectKey === s.subject_key }"
            @click="openSubject(s.subject_key)"
            :style="{ borderColor: getSubjectColor(s.subject_key) }"
          >
            <span>{{ s.subject_name }}</span>
            <small>{{ s.exam_board }} · {{ s.qualification_type }}</small>
            <small>{{ s.card_count || 0 }}/{{ state.limits.max_cards_per_subject }} cards</small>
            <label class="subject-color-row">
              <span>Color</span>
              <input
                type="color"
                class="subject-color-input"
                :value="getSubjectColor(s.subject_key)"
                @input.stop="setSubjectColor(s.subject_key, $event.target.value)"
              />
            </label>
          </button>
          <div v-if="!state.selectedSubjects.length" class="muted">No subjects selected yet.</div>
        </div>
      </aside>

      <section class="panel main-panel" v-if="view === 'home' || view === 'subject'">
        <template v-if="view === 'home'">
          <h2>Your FL4SH Lite subjects</h2>
          <p class="muted">Each subject appears as a card with board and level metadata. Open one to view its topic tree and create cards in topic shells.</p>
          <div class="subject-grid-main">
            <button
              v-for="s in state.selectedSubjects"
              :key="`main-${s.subject_key}`"
              class="subject-main-card"
              @click="openSubject(s.subject_key)"
              :style="{ borderColor: getSubjectColor(s.subject_key), boxShadow: `0 0 14px ${getSubjectColor(s.subject_key)}33` }"
            >
              <h3>{{ s.subject_name }}</h3>
              <p>{{ s.exam_board }} · {{ s.qualification_type }}</p>
              <small>{{ s.card_count || 0 }} saved cards</small>
            </button>
          </div>
        </template>
        <template v-else>
          <div class="panel-head">
            <h2>{{ selectedSubject?.subject_name || 'Subject' }}</h2>
            <div class="toolbar">
              <button class="btn" @click="startStudy" :disabled="state.cards.length === 0">Study Mode</button>
              <button class="btn ghost" @click="view = 'home'">Back</button>
            </div>
          </div>
          <div class="muted">{{ selectedSubjectMeta() }}</div>
          <div class="leitner-wrap">
            <div class="leitner-head">
              <h3>Leitner Boxes</h3>
              <button class="mini-btn" :class="{ active: !activeBoxFilter }" @click="activeBoxFilter = 0">All cards</button>
            </div>
            <div class="leitner-grid">
              <article
                v-for="b in boxStats"
                :key="b.box"
                class="leitner-box"
                :class="{ active: activeBoxFilter === b.box, pulse: pulseBox === b.box }"
                @click="activeBoxFilter = activeBoxFilter === b.box ? 0 : b.box"
              >
                <div class="box-label">
                  <strong>Box {{ b.box }}</strong>
                  <span>{{ b.title }} · {{ b.interval }}</span>
                </div>
                <div class="box-count">{{ b.count }} card{{ b.count === 1 ? '' : 's' }}</div>
                <div class="box-preview">
                  <small v-for="p in b.preview" :key="p.id">{{ shortLine(p.front_text) }}</small>
                  <small v-if="!b.preview.length" class="muted">No cards yet</small>
                </div>
                <div v-if="pulseBox === b.box && movingCardText" class="box-fly-chip">+ {{ movingCardText }}</div>
              </article>
            </div>
          </div>
          <div class="muted">Saved cards for this subject: {{ state.cards.length }}</div>
          <div v-if="state.topicTreeLoading" class="muted">Loading topic tree...</div>
          <div v-else-if="state.topicTreeError" class="muted">{{ state.topicTreeError }}</div>
          <div class="topic-strip">
            <button class="topic-pill" :class="{ active: !activeTopicFilter }" @click="activeTopicFilter = ''">All topics</button>
            <button
              v-for="row in topicRows"
              :key="row.id"
              class="topic-pill"
              :class="{ active: activeTopicFilter === row.topic_code, topicNode: true }"
              :style="{ marginLeft: `${row.depth * 12}px`, borderColor: getSubjectColor(state.selectedSubjectKey) }"
              @click="toggleTopicRow(row)"
            >
              <span v-if="row.hasChildren">{{ expandedTopics[row.id] ? '▾' : '▸' }}</span>
              {{ row.label }}
              <em v-if="row.count">({{ row.count }})</em>
            </button>
          </div>

          <div class="forms">
            <div class="form-card">
              <h3>Create card in topic shell</h3>
              <input v-model="manualTopic" placeholder="Topic (optional but recommended)" />
              <textarea v-model="manualFront" placeholder="Question / front of card"></textarea>
              <textarea v-model="manualBack" placeholder="Answer / back of card"></textarea>
              <button class="btn neon-btn" :disabled="state.busy" @click="addManualCard">Add card</button>
            </div>
            <div class="form-card">
              <h3>Generate with AI</h3>
              <input v-model="aiTopic" placeholder="Topic (required for good results)" />
              <div class="row">
                <select v-model="aiType">
                  <option value="short_answer">Short answer</option>
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="essay">Essay</option>
                  <option value="acronym">Acronym</option>
                </select>
                <input type="number" min="1" max="5" v-model="aiCount" />
              </div>
              <button class="btn hot" :disabled="state.busy || !aiTopic" @click="generateCards">Generate cards</button>
              <small class="muted">Lite excludes voice feedback on short/essay questions.</small>
            </div>
          </div>

          <div class="cards">
            <article class="card" v-for="c in filteredCards" :key="c.id" @click="openCardModal(c)">
              <h4>{{ c.front_text }}</h4>
              <small class="muted" v-if="c.topic_code">Topic: {{ c.topic_code }}</small>
              <p>{{ shortLine(c.back_text, 160) }}</p>
              <div class="card-actions">
                <span>Box {{ c.box_number || 1 }}</span>
                <button @click.stop="deleteCard(c.id)" :disabled="state.busy">Delete</button>
              </div>
            </article>
            <div v-if="filteredCards.length === 0" class="muted">No saved cards for this filter yet.</div>
          </div>
        </template>
      </section>

      <section class="panel main-panel" v-else>
        <div class="panel-head">
          <h2>Study Mode · {{ selectedSubject?.subject_name }}</h2>
          <button class="btn ghost" @click="view = 'subject'">Back to cards</button>
        </div>
        <div class="leitner-wrap compact">
          <div class="leitner-head">
            <h3>Leitner Boxes (live)</h3>
          </div>
          <div class="leitner-grid">
            <article
              v-for="b in boxStats"
              :key="`study-${b.box}`"
              class="leitner-box"
              :class="{ pulse: pulseBox === b.box }"
            >
              <div class="box-label">
                <strong>Box {{ b.box }}</strong>
                <span>{{ b.interval }}</span>
              </div>
              <div class="box-count">{{ b.count }} card{{ b.count === 1 ? '' : 's' }}</div>
              <div class="box-preview">
                <small v-for="p in b.preview" :key="p.id">{{ shortLine(p.front_text, 30) }}</small>
                <small v-if="!b.preview.length" class="muted">No cards</small>
              </div>
              <div v-if="pulseBox === b.box && movingCardText" class="box-fly-chip">+ {{ movingCardText }}</div>
            </article>
          </div>
        </div>
        <p class="muted" v-if="!state.sessionDone">Due cards left: {{ dueCards.length }} · Reviewed this session: {{ state.sessionReviewed }}</p>
        <div v-if="state.sessionDone" class="notice neon">
          Session complete. You reviewed {{ state.sessionReviewed }} cards.
        </div>
        <template v-else-if="activeStudyCard">
          <article class="study-card">
            <h3>{{ activeStudyCard.front_text }}</h3>
            <p v-if="state.revealAnswer">{{ activeStudyCard.back_text }}</p>
            <button class="btn" v-if="!state.revealAnswer" @click="state.revealAnswer = true">Reveal answer</button>
            <div class="row" v-else>
              <button class="btn ghost" @click="applyStudyGrade(false)">Not quite</button>
              <button class="btn neon-btn" @click="applyStudyGrade(true)">Got it</button>
            </div>
          </article>
        </template>
        <div v-else class="muted">No cards are due right now. Come back later or create more cards.</div>
      </section>
    </main>

    <div class="modal" v-if="state.showUpsell">
      <div class="modal-card neon">
        <h3>{{ state.upsellTitle }}</h3>
        <p>{{ state.upsellMessage }}</p>
        <div class="badge-row">
          <a :href="LINKS.appStore" target="_blank" rel="noopener" class="store-badge">
            <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" />
          </a>
          <a :href="LINKS.playStore" target="_blank" rel="noopener" class="store-badge">
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" />
          </a>
        </div>
        <button class="btn neon-btn" @click="closeUpsell">Continue in Lite</button>
      </div>
    </div>

    <div class="modal" v-if="state.showSubjectModal">
      <div class="modal-card neon">
        <div class="panel-head">
          <h3>Select your subjects</h3>
          <button class="mini-btn" @click="closeSubjectModal">Close</button>
        </div>
        <p class="muted">Step 1: Choose exam level. Step 2: choose up to {{ state.limits.max_subjects }} subjects.</p>
        <select v-model="modalLevel">
          <option v-for="q in examLevelChoices" :key="q.label" :value="q.label">{{ q.label }}</option>
        </select>
        <input v-model="modalSearch" placeholder="Search subjects..." />
        <div class="subject-pick">
          <button
            v-for="subject in filteredModalSubjects"
            :key="`modal-${subject.subject_key}`"
            class="subject-item picker"
            :class="{ active: subjectDraft.includes(subject.subject_key) }"
            @click="selectSubjectFromModal(subject.subject_key)"
          >
            <div>
              <div>{{ subject.subject_name }}</div>
              <small>{{ subject.exam_board }} · {{ subject.qualification_type }}</small>
            </div>
          </button>
        </div>
        <div class="panel-head">
          <small class="muted">Selected: {{ subjectDraft.length }} / {{ state.limits.max_subjects }}</small>
          <button class="btn neon-btn" :disabled="state.busy" @click="saveSubjects">Save subjects</button>
        </div>
        <small class="muted" v-if="subjectDraft.length >= state.limits.max_subjects">
          Subject cap reached in Lite. Use full FL4SH app for unlimited subjects.
        </small>
      </div>
    </div>

    <div class="modal" v-if="cardModal.open">
      <div class="modal-card neon">
        <div class="panel-head">
          <h3>Card</h3>
          <button class="mini-btn" @click="closeCardModal">Close</button>
        </div>
        <div class="modal-meta-row">
          <span class="mini-chip">Box {{ cardModal.card?.box_number || 1 }}</span>
          <span class="mini-chip" :class="{ due: isCardDue(cardModal.card), frozen: !isCardDue(cardModal.card) }">{{ cardDueBadge(cardModal.card) }}</span>
          <span class="mini-chip">Topic: {{ cardModal.card?.topic_code || 'General' }}</span>
          <span class="mini-chip">{{ selectedSubjectMeta() }}</span>
        </div>
        <div class="flip-shell" :class="{ flipped: cardModal.flipped }">
          <article class="flip-face front">
            <h4>{{ cardModal.card?.front_text }}</h4>
            <small class="muted">Tap flip to reveal</small>
          </article>
          <article class="flip-face back">
            <h4>Answer</h4>
            <p>{{ cardModalBackSummary() }}</p>
          </article>
        </div>
        <div v-if="cardModal.mcqOptions.length && cardModal.flipped" class="mcq-options">
          <h4>Multiple choice</h4>
          <div class="mcq-grid">
            <button
              v-for="o in cardModal.mcqOptions"
              :key="o.key"
              class="mcq-option"
              :class="{
                active: cardModal.selectedOption === o.key,
                correct: cardModal.selectedOption && o.key === cardModal.correctOption,
                wrong: cardModal.selectedOption === o.key && cardModal.correctOption && o.key !== cardModal.correctOption
              }"
              @click="chooseMcqOption(o.key)"
            >{{ o.key }}) {{ o.text }}</button>
          </div>
          <small v-if="cardModal.selectedOption" class="muted">
            You chose {{ cardModal.selectedOption }}
            <span v-if="cardModal.correctOption"> · Correct answer: {{ cardModal.correctOption }}</span>
            <span v-if="cardModal.selectedCorrect === true"> · Nice one.</span>
            <span v-if="cardModal.selectedCorrect === false"> · Not this time.</span>
          </small>
        </div>
        <div class="toolbar">
          <button class="btn ghost" @click="cardModal.flipped = !cardModal.flipped">{{ cardModal.flipped ? 'Show question' : 'Flip card' }}</button>
          <button class="btn ghost" @click="cardModal.showDetails = !cardModal.showDetails">{{ cardModal.showDetails ? 'Hide details' : 'View details' }}</button>
          <button class="btn ghost" :disabled="state.busy || !isCardDue(cardModal.card)" @click="reviewFromModal(false)">Not quite</button>
          <button class="btn neon-btn" :disabled="state.busy || !isCardDue(cardModal.card)" @click="reviewFromModal(true)">Got it</button>
        </div>
        <div v-if="cardModal.showDetails" class="card-detail-grid">
          <div><strong>Card type</strong><span>{{ cardModal.card?.card_type || 'short_answer' }}</span></div>
          <div><strong>Streak</strong><span>{{ cardModal.card?.streak || 0 }}</span></div>
          <div><strong>Next review</strong><span>{{ formatDateTime(cardModal.card?.next_review_at) }}</span></div>
          <div><strong>Last reviewed</strong><span>{{ formatDateTime(cardModal.card?.last_reviewed_at) }}</span></div>
          <div><strong>Created</strong><span>{{ formatDateTime(cardModal.card?.created_at) }}</span></div>
        </div>
        <div v-if="!isCardDue(cardModal.card)" class="notice neon">
          This card is not due yet. In Study Mode, only due cards are shown.
        </div>
      </div>
    </div>
  </div>
</template>
