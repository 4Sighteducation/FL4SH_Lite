<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, required: true },
  selectedSubject: { type: Object, default: null },
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
const outcome = ref('') // correct | incorrect | ''
const showExplanation = ref(false)

const isMcqCard = computed(() => activeMcq.value.options.length > 0)
const cardTypeLabel = computed(() => {
  if (isMcqCard.value) return 'Multiple choice'
  const raw = String(props.activeStudyCard?.card_type || '').toLowerCase()
  if (raw.includes('essay')) return 'Essay'
  return 'Short answer'
})
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

watch(
  () => props.activeStudyCard?.id,
  () => {
    selectedOption.value = ''
    selectedCorrect.value = null
    isFlipped.value = false
    showSelfGrade.value = false
    showExplanation.value = false
    outcome.value = ''
    isBusyGrading.value = false
    emit('set-reveal-answer', false)
  }
)

function chooseOption(key) {
  if (selectedOption.value || isBusyGrading.value) return
  selectedOption.value = key
  const correct = String(activeMcq.value?.correct || '').toUpperCase()
  selectedCorrect.value = correct ? key === correct : null
  showExplanation.value = true

  // MCQ auto-marks and advances.
  const isCorrect = selectedCorrect.value === true
  outcome.value = isCorrect ? 'correct' : 'incorrect'
  isBusyGrading.value = true
  window.setTimeout(() => {
    emit('apply-study-grade', isCorrect)
    // reset UI quickly; next card watcher will run too
    isBusyGrading.value = false
    outcome.value = ''
    selectedOption.value = ''
    selectedCorrect.value = null
    showExplanation.value = false
  }, 700)
}

function toggleFlip() {
  if (isBusyGrading.value || isMcqCard.value) return
  // Flip cards are one-way during a review: front -> back, then self-grade.
  // Students must commit to correct/incorrect (no "flip back" / no "not yet").
  if (isFlipped.value) return
  isFlipped.value = true
  emit('set-reveal-answer', isFlipped.value)
  // When the answer is visible, prompt for self-grade (in-modal, not on page footer).
  showSelfGrade.value = true
}

function closeSelfGrade() {
  showSelfGrade.value = false
}

function selfGrade(correct) {
  if (isBusyGrading.value) return
  outcome.value = correct ? 'correct' : 'incorrect'
  isBusyGrading.value = true
  showSelfGrade.value = false
  window.setTimeout(() => {
    emit('apply-study-grade', Boolean(correct))
    isBusyGrading.value = false
    outcome.value = ''
    isFlipped.value = false
    emit('set-reveal-answer', false)
  }, 700)
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
    </template>
    <template v-else-if="props.sessionDone">
      <div class="notice neon">
        Session complete. You reviewed {{ props.sessionReviewed }} cards.
        <div class="toolbar" style="margin-top:8px;">
          <a class="mini-btn active" :href="props.links.appStore" target="_blank" rel="noopener" @click="emit('store-click', 'app_store')">Get iOS App</a>
          <a class="mini-btn active" :href="props.links.playStore" target="_blank" rel="noopener" @click="emit('store-click', 'play_store')">Get Android App</a>
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
            <span class="card-type-badge">{{ cardTypeLabel }}</span>
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
            <div class="flip-card" :class="{ flipped: isFlipped }" @click="toggleFlip">
              <div class="flip-face flip-front">
                <span class="card-type-badge">{{ cardTypeLabel }}</span>
                <div class="face-body">
                  <span class="face-side-label front-label">Question</span>
                  <div class="face-question">{{ props.activeStudyCard.front_text }}</div>
                </div>
                <div class="flip-hint">Tap anywhere to flip</div>
              </div>
              <div class="flip-face flip-back" :class="{ essay: String(props.activeStudyCard?.card_type || '').toLowerCase().includes('essay') }">
                <span class="card-type-badge" style="color: var(--success)">{{ backBadgeLabel }}</span>
                <div class="face-body">
                  <span class="face-side-label back-label">{{ backBadgeLabel }}</span>
                  <div class="face-answer">{{ props.activeStudyCard.back_text }}</div>
                </div>
                <div class="flip-hint">Tap to flip back</div>
              </div>
            </div>
          </div>

          <!-- Success/failure overlay (brief) -->
          <div class="study-outcome" v-if="outcome">
            <div class="study-outcome-card" :class="outcome">
              <strong v-if="outcome === 'correct'">✓ Correct</strong>
              <strong v-else>✕ Incorrect</strong>
              <small v-if="outcome === 'correct'">Moving forward</small>
              <small v-else>Back to Box 1</small>
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
