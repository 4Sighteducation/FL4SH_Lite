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
    subjectDraft.value = state.selectedSubjects.map((s) => s.subject_key)
    if (!state.selectedSubjectKey && state.selectedSubjects[0]) state.selectedSubjectKey = state.selectedSubjects[0].subject_key
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
  } catch (e) {
    state.error = e.message || 'Failed to load cards.'
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
        <h3>Your subjects</h3>
        <input v-model="subjectSearch" placeholder="Search subjects..." />
        <div class="subject-pick">
          <label v-for="subject in filteredAvailableSubjects" :key="subject.subject_key" class="subject-item">
            <input
              type="checkbox"
              :value="subject.subject_key"
              v-model="subjectDraft"
              :disabled="!subjectDraft.includes(subject.subject_key) && subjectDraft.length >= state.limits.max_subjects"
            />
            <div>
              <div>{{ subject.subject_name }}</div>
              <small>{{ subject.exam_board }} · {{ subject.qualification_type }}</small>
            </div>
          </label>
        </div>
        <button class="btn neon-btn" :disabled="state.busy" @click="saveSubjects">Save subjects</button>

        <div class="subject-cards">
          <button
            v-for="s in state.selectedSubjects"
            :key="s.subject_key"
            class="subject-card"
            :class="{ active: state.selectedSubjectKey === s.subject_key }"
            @click="openSubject(s.subject_key)"
          >
            <span>{{ s.subject_name }}</span>
            <small>{{ s.card_count || 0 }}/{{ state.limits.max_cards_per_subject }} cards</small>
          </button>
        </div>
      </aside>

      <section class="panel main-panel" v-if="view === 'home' || view === 'subject'">
        <template v-if="view === 'home'">
          <h2>Choose a subject card to enter Flashcards</h2>
          <p class="muted">Subject cards are the entry point. Open one to manage saved cards, then move to Study Mode.</p>
        </template>
        <template v-else>
          <div class="panel-head">
            <h2>{{ selectedSubject?.subject_name || 'Subject' }}</h2>
            <div class="toolbar">
              <button class="btn" @click="startStudy" :disabled="state.cards.length === 0">Study Mode</button>
              <button class="btn ghost" @click="view = 'home'">Back</button>
            </div>
          </div>
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
          <div class="topic-strip" v-if="topicList.length">
            <button class="topic-pill" :class="{ active: !activeTopicFilter }" @click="activeTopicFilter = ''">All topics</button>
            <button
              v-for="t in topicList"
              :key="t"
              class="topic-pill"
              :class="{ active: activeTopicFilter === t }"
              @click="activeTopicFilter = t; aiTopic = t"
            >{{ t }}</button>
          </div>

          <div class="forms">
            <div class="form-card">
              <h3>Create card manually</h3>
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
            <article class="card" v-for="c in filteredCards" :key="c.id">
              <h4>{{ c.front_text }}</h4>
              <small class="muted" v-if="c.topic_code">Topic: {{ c.topic_code }}</small>
              <p>{{ c.back_text }}</p>
              <div class="card-actions">
                <span>Box {{ c.box_number || 1 }}</span>
                <button @click="deleteCard(c.id)" :disabled="state.busy">Delete</button>
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
  </div>
</template>
