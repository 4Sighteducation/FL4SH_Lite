<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

const APP_STORE_URL = 'https://apps.apple.com/in/app/fl4sh-study-smarter/id6747457678'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.foursighteducation.flash&pcampaignid=web_share'
const WEBSITE_URL = 'https://www.fl4shcards.com'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const BRIDGE_SECRET = import.meta.env.VITE_FL4SH_LITE_BRIDGE_SECRET || ''
const ENABLE_LOCAL_MOCK = String(import.meta.env.VITE_ENABLE_LOCAL_MOCK || 'false') === 'true'

const appState = reactive({
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
  upsellTitle: 'Get the full FL4SH experience',
  upsellMessage: 'Download FL4SH for the complete mobile-native experience.',
})

const manualForm = reactive({
  front_text: '',
  back_text: '',
  card_type: 'short_answer',
})

const aiForm = reactive({
  topic: '',
  questionType: 'short_answer',
  numCards: 3,
})

const subjectDraft = ref([])

const selectedSubject = computed(() =>
  appState.selectedSubjects.find((s) => s.subject_key === appState.selectedSubjectKey) || null
)

const canCreateMore = computed(() => Number(selectedSubject.value?.cards_remaining || 0) > 0)

function clearError() {
  appState.error = ''
}

function openUpsell(title, message) {
  appState.upsellTitle = title
  appState.upsellMessage = message
  appState.showUpsell = true
}

function closeUpsell() {
  appState.showUpsell = false
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

function getIdentity() {
  return getKnackIdentity() || getLocalMockIdentity()
}

async function callFn(name, body = {}) {
  const identity = getIdentity()
  if (!identity?.email) {
    throw new Error('No Knack user identity found. Open this inside Knack (or enable local mock).')
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

async function loadContext() {
  clearError()
  appState.loading = true
  try {
    const data = await callFn('fl4sh-lite-context')
    appState.user = data.user || null
    appState.limits = data.limits || appState.limits
    appState.availableSubjects = Array.isArray(data.available_subjects) ? data.available_subjects : []
    appState.selectedSubjects = Array.isArray(data.selected_subjects) ? data.selected_subjects : []
    subjectDraft.value = appState.selectedSubjects.map((s) => s.subject_key)
    if (!appState.selectedSubjectKey && appState.selectedSubjects[0]) {
      appState.selectedSubjectKey = appState.selectedSubjects[0].subject_key
    }
    await loadCards()
  } catch (e) {
    appState.error = e.message || 'Failed to load FL4SH Lite.'
  } finally {
    appState.loading = false
  }
}

async function loadCards() {
  if (!appState.selectedSubjectKey) {
    appState.cards = []
    return
  }
  try {
    const data = await callFn('fl4sh-lite-list-cards', { subject_key: appState.selectedSubjectKey })
    appState.cards = Array.isArray(data.cards) ? data.cards : []
    if (Array.isArray(data.stats) && data.stats[0]) {
      appState.selectedSubjects = appState.selectedSubjects.map((s) =>
        s.subject_key === appState.selectedSubjectKey ? { ...s, ...data.stats[0] } : s
      )
    }
  } catch (e) {
    appState.error = e.message || 'Failed to load cards.'
  }
}

async function saveSubjectSelection() {
  clearError()
  appState.busy = true
  try {
    if (subjectDraft.value.length > appState.limits.max_subjects) {
      throw new Error(`You can only choose up to ${appState.limits.max_subjects} subjects in FL4SH Lite.`)
    }
    const subjects = appState.availableSubjects
      .filter((s) => subjectDraft.value.includes(s.subject_key))
      .map((s) => ({
        subject_key: s.subject_key,
        subject_name: s.subject_name,
        exam_board: s.exam_board,
        qualification_type: s.qualification_type,
      }))
    const data = await callFn('fl4sh-lite-select-subjects', { subjects })
    appState.selectedSubjects = Array.isArray(data.selected_subjects) ? data.selected_subjects : []
    if (!appState.selectedSubjects.some((s) => s.subject_key === appState.selectedSubjectKey)) {
      appState.selectedSubjectKey = appState.selectedSubjects[0]?.subject_key || ''
    }
    await loadCards()
    if (appState.selectedSubjects.length >= appState.limits.max_subjects) {
      openUpsell(
        'Subject limit reached in Lite',
        'You have reached your Lite subject limit. Get the full FL4SH app for unlimited subjects and full study tools.'
      )
    }
  } catch (e) {
    appState.error = e.message || 'Could not save subject selection.'
  } finally {
    appState.busy = false
  }
}

async function createManualCard() {
  clearError()
  if (!appState.selectedSubjectKey) return
  if (!canCreateMore.value) {
    openUpsell(
      'Card limit reached in this subject',
      'You have reached 10 cards for this subject in Lite. Download FL4SH for unlimited cards and advanced revision.'
    )
    return
  }
  appState.busy = true
  try {
    const data = await callFn('fl4sh-lite-create-card', {
      subject_key: appState.selectedSubjectKey,
      front_text: manualForm.front_text,
      back_text: manualForm.back_text,
      card_type: manualForm.card_type,
    })
    manualForm.front_text = ''
    manualForm.back_text = ''
    if (data?.stats) {
      appState.selectedSubjects = appState.selectedSubjects.map((s) =>
        s.subject_key === appState.selectedSubjectKey ? { ...s, ...data.stats } : s
      )
    }
    await loadCards()
  } catch (e) {
    appState.error = e.message || 'Could not create card.'
  } finally {
    appState.busy = false
  }
}

async function generateAICards() {
  clearError()
  if (!appState.selectedSubjectKey || !selectedSubject.value) return
  if (!canCreateMore.value) {
    openUpsell(
      'Card limit reached in this subject',
      'You have reached 10 cards for this subject in Lite. Download FL4SH for unlimited AI generation and full study features.'
    )
    return
  }
  appState.busy = true
  try {
    const count = Math.min(Number(aiForm.numCards || 1), Number(selectedSubject.value.cards_remaining || 1))
    await callFn('fl4sh-lite-generate-cards', {
      subject_key: appState.selectedSubjectKey,
      subject: selectedSubject.value.subject_name,
      topic: aiForm.topic,
      examBoard: selectedSubject.value.exam_board,
      examType: selectedSubject.value.qualification_type,
      questionType: aiForm.questionType,
      numCards: count,
    })
    await loadContext()
    if (Number(selectedSubject.value?.cards_remaining || 0) <= 0) {
      openUpsell(
        'Lite AI limit reached',
        'You are at the Lite card limit for this subject. Get full FL4SH for unlimited AI card generation.'
      )
    }
  } catch (e) {
    appState.error = e.message || 'Could not generate AI cards.'
  } finally {
    appState.busy = false
  }
}

async function deleteCard(cardId) {
  clearError()
  appState.busy = true
  try {
    await callFn('fl4sh-lite-delete-card', { card_id: cardId })
    await loadCards()
  } catch (e) {
    appState.error = e.message || 'Could not delete card.'
  } finally {
    appState.busy = false
  }
}

onMounted(() => {
  loadContext()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="logo">FL4SH Lite</div>
        <div class="meta">{{ appState.user?.name || 'Student' }} · {{ appState.user?.school_name || '' }}</div>
      </div>
      <div class="cta-row">
        <a :href="APP_STORE_URL" target="_blank" rel="noopener">Download iOS App</a>
        <a :href="PLAY_STORE_URL" target="_blank" rel="noopener">Get Android App</a>
        <a :href="WEBSITE_URL" target="_blank" rel="noopener">fl4shcards.com</a>
      </div>
    </header>

    <section class="notice">
      <strong>FL4SH Lite</strong> gives you a limited preview. Full FL4SH unlocks unlimited cards, mobile-native study, and advanced features.
    </section>

    <main class="layout" v-if="!appState.loading">
      <aside class="panel">
        <h2>Choose up to {{ appState.limits.max_subjects }} subjects</h2>
        <div class="subjects">
          <label v-for="subject in appState.availableSubjects" :key="subject.subject_key" class="subject-item">
            <input
              type="checkbox"
              :value="subject.subject_key"
              v-model="subjectDraft"
              :disabled="!subjectDraft.includes(subject.subject_key) && subjectDraft.length >= appState.limits.max_subjects"
            />
            <span>{{ subject.subject_name }}</span>
            <small>{{ subject.exam_board }} · {{ subject.qualification_type }}</small>
          </label>
        </div>
        <button class="btn" @click="saveSubjectSelection" :disabled="appState.busy">Save subjects</button>

        <h3>My selected subjects</h3>
        <div v-if="appState.selectedSubjects.length === 0" class="muted">No subjects selected yet.</div>
        <button
          v-for="s in appState.selectedSubjects"
          :key="s.subject_key"
          class="subject-chip"
          :class="{ active: appState.selectedSubjectKey === s.subject_key }"
          @click="appState.selectedSubjectKey = s.subject_key; loadCards()"
        >
          <span>{{ s.subject_name }}</span>
          <small>{{ s.card_count || 0 }}/{{ appState.limits.max_cards_per_subject }}</small>
        </button>
      </aside>

      <section class="panel main-panel">
        <div class="panel-head">
          <h2>Flashcards</h2>
          <div class="muted" v-if="selectedSubject">
            {{ selectedSubject.subject_name }} · {{ selectedSubject.cards_remaining || 0 }} remaining in Lite
          </div>
        </div>

        <div class="forms">
          <div class="form-card">
            <h3>Create manually</h3>
            <textarea v-model="manualForm.front_text" placeholder="Question / front of card"></textarea>
            <textarea v-model="manualForm.back_text" placeholder="Answer / back of card"></textarea>
            <button class="btn" @click="createManualCard" :disabled="appState.busy || !appState.selectedSubjectKey">
              Add card
            </button>
          </div>

          <div class="form-card">
            <h3>Generate with AI</h3>
            <input v-model="aiForm.topic" placeholder="Topic to generate from (e.g. Photosynthesis)" />
            <div class="row">
              <select v-model="aiForm.questionType">
                <option value="short_answer">Short answer</option>
                <option value="multiple_choice">Multiple choice</option>
                <option value="essay">Essay</option>
                <option value="acronym">Acronym</option>
              </select>
              <input type="number" min="1" max="5" v-model="aiForm.numCards" />
            </div>
            <button class="btn hot" @click="generateAICards" :disabled="appState.busy || !appState.selectedSubjectKey">
              Generate cards
            </button>
          </div>
        </div>

        <div class="error" v-if="appState.error">{{ appState.error }}</div>

        <div class="cards">
          <article v-for="card in appState.cards" :key="card.id" class="card">
            <h4>{{ card.front_text }}</h4>
            <p>{{ card.back_text }}</p>
            <div class="card-actions">
              <span>{{ card.card_type }}</span>
              <button @click="deleteCard(card.id)" :disabled="appState.busy">Delete</button>
            </div>
          </article>
          <div v-if="appState.cards.length === 0" class="muted">No cards yet for this subject.</div>
        </div>
      </section>
    </main>

    <div class="loading" v-else>Loading FL4SH Lite...</div>

    <div class="modal" v-if="appState.showUpsell">
      <div class="modal-card">
        <h3>{{ appState.upsellTitle }}</h3>
        <p>{{ appState.upsellMessage }}</p>
        <div class="cta-row">
          <a :href="APP_STORE_URL" target="_blank" rel="noopener">App Store</a>
          <a :href="PLAY_STORE_URL" target="_blank" rel="noopener">Google Play</a>
          <a :href="WEBSITE_URL" target="_blank" rel="noopener">Website</a>
        </div>
        <button class="btn" @click="closeUpsell">Continue in Lite</button>
      </div>
    </div>
  </div>
</template>
