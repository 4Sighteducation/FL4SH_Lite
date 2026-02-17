<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, required: true },
  selectedSubject: { type: Object, default: null },
  allCards: { type: Array, default: () => [] },
  boxStats: { type: Array, required: true },
  pulseBox: { type: Number, required: true },
  movingCardText: { type: String, required: true },
  shortLine: { type: Function, required: true },
  parseMcq: { type: Function, required: true },
  sessionDone: { type: Boolean, required: true },
  sessionStarted: { type: Boolean, required: true },
  dueCardsLength: { type: Number, required: true },
  totalCardsLength: { type: Number, required: true },
  sessionReviewed: { type: Number, required: true },
  sessionTotalDue: { type: Number, required: true },
  progressPercent: { type: Number, required: true },
  lastOutcome: { type: String, required: true },
  activeStudyCard: { type: Object, default: null },
  revealAnswer: { type: Boolean, required: true },
  links: { type: Object, required: true },
})

const emit = defineEmits(['back-to-subject', 'begin-session', 'set-reveal-answer', 'apply-study-grade', 'store-click'])

const selectedOption = ref('')
const selectedCorrect = ref(null)
const activeMcq = computed(() => props.parseMcq(props.activeStudyCard || {}))
const isFlipped = ref(false)
const isBusyGrading = ref(false)
const showSelfGrade = ref(false)
const toastType = ref('') // correct | incorrect | ''
const toastTargetBox = ref(0)
const showExplanation = ref(false)
const countdownSeconds = ref(10)
const countdownRunning = ref(false)
let countdownTimer = null

const NON_MCQ_THINK_TIME_SECONDS = 10
const GRADE_TOAST_MS = 1600

const isMcqCard = computed(() => activeMcq.value.options.length > 0)
const backBadgeLabel = computed(() => {
  if (isMcqCard.value) return 'Explanation'
  const raw = String(props.activeStudyCard?.card_type || '').toLowerCase()
  if (raw.includes('essay')) return 'Model answer'
  return 'Answer'
})
const boxJourney = computed(() => {
  const colors = ['#56d2ff', '#8b8cf9', '#ff55b8', '#ffa944', '#27e48f']
  return (props.boxStats || []).map((box, index) => ({
    ...box,
    color: colors[index % colors.length],
  }))
})

const cardsByBox = computed(() => {
  const groups = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  ;(Array.isArray(props.allCards) ? props.allCards : []).forEach((card) => {
    const box = Math.max(1, Math.min(5, Number(card?.box_number || 1)))
    groups[box].push(card)
  })
  Object.keys(groups).forEach((k) => {
    groups[k] = groups[k].slice().sort((a, b) => String(a?.front_text || '').localeCompare(String(b?.front_text || '')))
  })
  return groups
})

watch(
  () => props.activeStudyCard?.id,
  () => {
    if (countdownTimer) {
      window.clearInterval(countdownTimer)
      countdownTimer = null
    }
    selectedOption.value = ''
    selectedCorrect.value = null
    isFlipped.value = false
    showSelfGrade.value = false
    showExplanation.value = false
    toastType.value = ''
    toastTargetBox.value = 0
    isBusyGrading.value = false
    emit('set-reveal-answer', false)

    // For non-MCQ cards, run a fixed "think time" countdown then reveal answer.
    if (!isMcqCard.value && props.activeStudyCard?.id && props.sessionStarted) {
      countdownSeconds.value = NON_MCQ_THINK_TIME_SECONDS
      countdownRunning.value = true
      countdownTimer = window.setInterval(() => {
        if (!countdownRunning.value) return
        countdownSeconds.value = Math.max(0, Number(countdownSeconds.value || 0) - 1)
        if (countdownSeconds.value <= 0) {
          countdownRunning.value = false
          if (countdownTimer) {
            window.clearInterval(countdownTimer)
            countdownTimer = null
          }
          emit('set-reveal-answer', true)
          showSelfGrade.value = true
        }
      }, 1000)
    } else {
      countdownRunning.value = false
      countdownSeconds.value = NON_MCQ_THINK_TIME_SECONDS
    }
  }
)

function computeTargetBox(isCorrect) {
  const current = Number(props.activeStudyCard?.box_number || 1)
  if (!isCorrect) return 1
  return Math.max(1, Math.min(5, current + 1))
}

function chooseOption(key) {
  if (selectedOption.value || isBusyGrading.value) return
  selectedOption.value = key
  const correct = String(activeMcq.value?.correct || '').toUpperCase()
  selectedCorrect.value = correct ? key === correct : null
  showExplanation.value = true

  // MCQ auto-marks and advances.
  const isCorrect = selectedCorrect.value === true
  toastType.value = isCorrect ? 'correct' : 'incorrect'
  toastTargetBox.value = computeTargetBox(isCorrect)
  isBusyGrading.value = true
  window.setTimeout(() => {
    emit('apply-study-grade', isCorrect)
    // reset UI quickly; next card watcher will run too
    isBusyGrading.value = false
    toastType.value = ''
    toastTargetBox.value = 0
    selectedOption.value = ''
    selectedCorrect.value = null
    showExplanation.value = false
  }, GRADE_TOAST_MS)
}

function toggleFlip() {
  if (isBusyGrading.value || isMcqCard.value) return
  // Study flow for non-MCQ is timer-driven (no manual flipping).
  return
}

function closeSelfGrade() {
  showSelfGrade.value = false
}

function selfGrade(correct) {
  if (isBusyGrading.value) return
  countdownRunning.value = false
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
  toastType.value = correct ? 'correct' : 'incorrect'
  toastTargetBox.value = computeTargetBox(Boolean(correct))
  isBusyGrading.value = true
  showSelfGrade.value = false
  window.setTimeout(() => {
    emit('apply-study-grade', Boolean(correct))
    isBusyGrading.value = false
    toastType.value = ''
    toastTargetBox.value = 0
    isFlipped.value = false
    emit('set-reveal-answer', false)
  }, GRADE_TOAST_MS)
}

function revealNow() {
  if (isMcqCard.value) return
  countdownRunning.value = false
  countdownSeconds.value = 0
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
  emit('set-reveal-answer', true)
  showSelfGrade.value = true
}
</script>

<template>
  <section class="panel main-panel" v-if="props.visible">
    <div class="panel-head">
      <h2>Study Mode · {{ props.selectedSubject?.subject_name }}</h2>
      <button class="btn ghost" @click="emit('back-to-subject')">Back to cards</button>
    </div>
    <template v-if="!props.sessionStarted && !props.sessionDone">
      <article class="study-hub-hero">
        <div class="study-hub-icon">🔥</div>
        <h3>Ready to Study?</h3>
        <p class="study-hub-due">{{ props.dueCardsLength }} cards due today</p>
        <button class="btn study-start-btn" :disabled="props.dueCardsLength === 0" @click="emit('begin-session')">
          Start Review →
        </button>
      </article>
      <div class="study-hub-stats">
        <div>
          <strong>{{ props.totalCardsLength }}</strong>
          <span>Total cards</span>
        </div>
        <div>
          <strong>{{ props.dueCardsLength }}</strong>
          <span>Due now</span>
        </div>
      </div>
      <div class="journey-panel">
        <h3>Your Learning Journey</h3>
        <small class="muted">Tap a stage in the full app to focus revision.</small>
      </div>
      <div class="journey-grid">
        <article
          v-for="b in boxJourney"
          :key="`study-${b.box}`"
          class="journey-card"
          :class="{ pulse: props.pulseBox === b.box }"
          :style="{ borderColor: `${b.color}99`, boxShadow: `inset 0 0 0 1px ${b.color}44` }"
        >
          <div class="journey-title">
            <strong>{{ b.title }}</strong>
            <span>{{ b.interval }}</span>
          </div>
          <div class="journey-count">{{ b.count }}</div>
          <small>card{{ b.count === 1 ? '' : 's' }}</small>
        </article>
      </div>

      <div class="journey-panel" style="margin-top: 12px;">
        <h3>Preview by Box</h3>
        <small class="muted">Fronts only — a quick view of what’s coming up.</small>
      </div>
      <div class="cards">
        <div v-for="box in [1,2,3,4,5]" :key="`hubbox-${box}`" class="panel neon" style="padding: 12px; margin-bottom: 10px;">
          <div class="panel-head" style="margin-bottom: 8px;">
            <h3 style="margin:0;">Box {{ box }}</h3>
            <small class="muted">{{ cardsByBox[box].length }} cards</small>
          </div>
          <div class="topic-tree-list" style="margin-top: 0;">
            <div v-if="cardsByBox[box].length === 0" class="muted" style="padding: 6px 2px;">No cards in this box yet.</div>
            <div
              v-for="card in cardsByBox[box].slice(0, 5)"
              :key="`hubfront-${box}-${card.id}`"
              class="sd-topic-row"
              style="cursor: default;"
            >
              <span class="sd-topic-name" :data-depth="0">{{ props.shortLine(card.front_text, 96) }}</span>
              <span class="sd-topic-meta">{{ card.topic_code || 'General' }}</span>
            </div>
            <div v-if="cardsByBox[box].length > 5" class="muted" style="padding: 6px 2px;">
              Showing 5 of {{ cardsByBox[box].length }}. Use <strong>Card Bank</strong> to browse everything.
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else-if="props.sessionDone">
      <div class="notice neon">
        <strong>Session complete.</strong> You reviewed {{ props.sessionReviewed }} cards.
        <div class="toolbar" style="margin-top:8px;">
          <a class="mini-btn active" :href="props.links.appStore" target="_blank" rel="noopener" @click="emit('store-click', 'app_store')">Get iOS App</a>
          <a class="mini-btn active" :href="props.links.playStore" target="_blank" rel="noopener" @click="emit('store-click', 'play_store')">Get Android App</a>
        </div>
      </div>

      <div class="journey-panel" style="margin-top: 12px;">
        <h3>Tomorrow’s Preview</h3>
        <small class="muted">Fronts only — this is your “what’s coming up” view by Leitner box.</small>
      </div>

      <div class="journey-grid" style="grid-template-columns: repeat(5, minmax(120px, 1fr));">
        <article v-for="b in boxJourney" :key="`done-${b.box}`" class="journey-card" :style="{ borderColor: `${b.color}99` }">
          <div class="journey-title">
            <strong>Box {{ b.box }}</strong>
            <span>{{ b.interval }}</span>
          </div>
          <div class="journey-count">{{ b.count }}</div>
          <small>card{{ b.count === 1 ? '' : 's' }}</small>
        </article>
      </div>

      <div class="cards" style="margin-top: 10px;">
        <div v-for="box in [1,2,3,4,5]" :key="`boxlist-${box}`" class="panel neon" style="padding: 12px; margin-bottom: 10px;">
          <div class="panel-head" style="margin-bottom: 8px;">
            <h3 style="margin:0;">Box {{ box }}</h3>
            <small class="muted">{{ cardsByBox[box].length }} cards</small>
          </div>
          <div class="topic-tree-list" style="margin-top: 0;">
            <div v-if="cardsByBox[box].length === 0" class="muted" style="padding: 6px 2px;">No cards in this box yet.</div>
            <div
              v-for="card in cardsByBox[box].slice(0, 8)"
              :key="`boxfront-${box}-${card.id}`"
              class="sd-topic-row"
              style="cursor: default;"
            >
              <span class="sd-topic-name" :data-depth="0">{{ props.shortLine(card.front_text, 96) }}</span>
              <span class="sd-topic-meta">{{ card.topic_code || 'General' }}</span>
            </div>
            <div v-if="cardsByBox[box].length > 8" class="muted" style="padding: 6px 2px;">
              Showing 8 of {{ cardsByBox[box].length }}. Use <strong>Card Bank</strong> to browse everything.
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else-if="props.activeStudyCard">
      <!-- Keep Study page structure; run the review experience in a modal overlay -->
      <div class="modal" v-if="props.sessionStarted">
        <div class="modal-card neon study-modal-card">
          <div class="panel-head">
            <div>
              <h3>{{ props.selectedSubject?.subject_name }}</h3>
              <small class="muted">Daily Review · {{ props.sessionReviewed }}/{{ props.sessionTotalDue || props.sessionReviewed }}</small>
            </div>
            <button class="mini-btn" @click="emit('back-to-subject')">Close</button>
          </div>

          <div class="study-progress-shell">
            <div class="study-progress-head">
              <small>Session progress</small>
              <small>{{ props.sessionReviewed }}/{{ props.sessionTotalDue || props.sessionReviewed }}</small>
            </div>
            <div class="study-progress-track">
              <div class="study-progress-fill" :style="{ width: `${props.progressPercent}%` }"></div>
            </div>
          </div>

          <!-- MCQ: no flip, inline reveal -->
          <div v-if="isMcqCard" class="mcq-card-stage">
            <div class="mcq-card-body">
              <div class="mcq-question">{{ props.activeStudyCard.front_text }}</div>
              <div class="mcq-options">
                <button
                  v-for="o in activeMcq.options"
                  :key="o.key"
                  class="mcq-option"
                  :class="{
                    selected: selectedOption === o.key,
                    correct: selectedOption && o.key === activeMcq.correct,
                    wrong: selectedOption === o.key && activeMcq.correct && o.key !== activeMcq.correct,
                  }"
                  :disabled="Boolean(selectedOption) || isBusyGrading"
                  @click="chooseOption(o.key)"
                >
                  <span class="opt-key">{{ o.key }}</span>
                  <span class="opt-text">{{ o.text }}</span>
                </button>
              </div>
            </div>
            <div class="mcq-answer-panel" :class="{ visible: showExplanation }">
              <div class="mcq-answer-divider"></div>
              <div class="mcq-answer-content">
                {{ activeMcq.info || 'Detailed answer not available for this card.' }}
              </div>
            </div>
          </div>

          <!-- Short answer / Essay: 3D flip -->
          <div v-else class="flip-container">
            <div class="flip-card flipped">
              <div class="flip-face flip-front">
                <div class="face-body">
                  <span class="face-side-label front-label">Question</span>
                  <div class="face-question">{{ props.activeStudyCard.front_text }}</div>
                </div>
                <div class="flip-hint">
                  <span v-if="countdownRunning">Think time: {{ countdownSeconds }}s</span>
                  <span v-else>Answer revealed</span>
                  <button class="mini-btn ghost" style="margin-left: 10px;" v-if="countdownRunning" @click.stop="revealNow">Reveal now</button>
                </div>
              </div>
              <div class="flip-face flip-back" :class="{ essay: String(props.activeStudyCard?.card_type || '').toLowerCase().includes('essay') }">
                <div class="face-body">
                  <span class="face-side-label back-label">{{ backBadgeLabel }}</span>
                  <div class="face-answer" v-if="props.revealAnswer">{{ props.activeStudyCard.back_text }}</div>
                  <div v-else class="face-answer" style="opacity: 0.35;">Answer hidden…</div>
                </div>
                <div class="flip-hint" v-if="props.revealAnswer">Were you correct?</div>
                <div class="flip-hint" v-else>Answer will reveal automatically</div>
              </div>
            </div>
          </div>

          <!-- Success/failure overlay (brief) -->
          <div class="study-outcome" v-if="toastType">
            <div class="study-outcome-card" :class="toastType">
              <div class="study-outcome-title" v-if="toastType === 'correct'">
                Congrats — that card has moved up to Box {{ toastTargetBox }}.
              </div>
              <div class="study-outcome-title" v-else>
                Unlucky — you’ll need to try that again tomorrow… moving back to Box 1.
              </div>
              <div class="study-outcome-sub">
                {{ props.activeStudyCard?.topic_code || 'General' }} · Box {{ props.activeStudyCard?.box_number || 1 }}
              </div>
            </div>
          </div>

          <!-- Self-grade modal for non-MCQ -->
          <div class="study-grade-modal" v-if="showSelfGrade && !isMcqCard">
            <div class="study-grade-card">
              <h4>How did you do?</h4>
              <p class="muted">Choose one — we’ll move to the next card automatically.</p>
              <div class="grade-buttons">
                <button class="grade-btn incorrect" @click="selfGrade(false)">✕ Incorrect<span class="grade-label">Back to Box 1</span></button>
                <button class="grade-btn got-it" @click="selfGrade(true)">✓ Got it<span class="grade-label">Move forward</span></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- If session hasn't started, this panel branch shouldn't show; safeguard only. -->
      <div v-else class="notice neon">Click “Start Review” to begin.</div>
    </template>
    <div v-else class="notice neon">
      No cards are due right now. Come back later or create more cards.
      <div class="toolbar" style="margin-top:8px;">
        <a class="mini-btn active" :href="props.links.appStore" target="_blank" rel="noopener" @click="emit('store-click', 'app_store')">Try full FL4SH</a>
        <a class="mini-btn active" :href="props.links.playStore" target="_blank" rel="noopener" @click="emit('store-click', 'play_store')">Open in mobile app</a>
      </div>
    </div>
  </section>
</template>
