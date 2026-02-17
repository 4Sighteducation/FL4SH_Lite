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
const isBusyGrading = ref(false)
const showSelfGrade = ref(false)
const toastType = ref('') // correct | incorrect | ''
const toastReason = ref('') // timeout | ''
const toastTargetBox = ref(0)
const showExplanation = ref(false)

const pressureEnabled = ref(false)
const pressureSeconds = ref(20)
const pressureRunning = ref(false)
let pressureTimer = null

const PRESSURE_TOTAL_SECONDS = 20
const GRADE_TOAST_MS = 1600
const TIMEOUT_TOAST_MS = 900

const isMcqCard = computed(() => activeMcq.value.options.length > 0)
const backBadgeLabel = computed(() => {
  if (isMcqCard.value) return 'Explanation'
  const raw = String(props.activeStudyCard?.card_type || '').toLowerCase()
  if (raw.includes('essay')) return 'Model answer'
  return 'Answer'
})
const boxJourney = computed(() => {
  return (props.boxStats || []).map((box, index) => ({
    ...box,
    boxClass: `box-${box.box}`,
  }))
})

function boxIcon(boxNum) {
  const b = Number(boxNum || 1)
  if (b === 1) return '◆'
  if (b === 2) return '✦'
  if (b === 3) return '⚡'
  if (b === 4) return '✶'
  return '★'
}

try {
  pressureEnabled.value = window.localStorage.getItem('fl4sh_lite_pressure_timer') === '1'
} catch {
  pressureEnabled.value = false
}

watch(
  pressureEnabled,
  (enabled) => {
    try {
      window.localStorage.setItem('fl4sh_lite_pressure_timer', enabled ? '1' : '0')
    } catch {
      // ignore
    }
    if (!enabled) stopPressureTimer()
    if (enabled && props.sessionStarted && props.activeStudyCard?.id) startPressureTimer()
  },
  { flush: 'post' }
)

function stopPressureTimer() {
  pressureRunning.value = false
  if (pressureTimer) {
    window.clearInterval(pressureTimer)
    pressureTimer = null
  }
}

function startPressureTimer() {
  stopPressureTimer()
  pressureSeconds.value = PRESSURE_TOTAL_SECONDS
  pressureRunning.value = true
  pressureTimer = window.setInterval(() => {
    if (!pressureRunning.value) return
    pressureSeconds.value = Math.max(0, Number(pressureSeconds.value || 0) - 1)
    if (pressureSeconds.value <= 0) {
      stopPressureTimer()
      timeoutFail()
    }
  }, 1000)
}

watch(
  () => props.activeStudyCard?.id,
  () => {
    stopPressureTimer()
    selectedOption.value = ''
    selectedCorrect.value = null
    showSelfGrade.value = false
    showExplanation.value = false
    toastType.value = ''
    toastReason.value = ''
    toastTargetBox.value = 0
    isBusyGrading.value = false
    emit('set-reveal-answer', false)

    if (props.activeStudyCard?.id && props.sessionStarted && pressureEnabled.value) {
      startPressureTimer()
    } else {
      pressureRunning.value = false
      pressureSeconds.value = PRESSURE_TOTAL_SECONDS
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
  stopPressureTimer()
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

function selfGrade(correct) {
  if (isBusyGrading.value) return
  stopPressureTimer()
  toastType.value = correct ? 'correct' : 'incorrect'
  toastTargetBox.value = computeTargetBox(Boolean(correct))
  isBusyGrading.value = true
  showSelfGrade.value = false
  window.setTimeout(() => {
    emit('apply-study-grade', Boolean(correct))
    isBusyGrading.value = false
    toastType.value = ''
    toastTargetBox.value = 0
    emit('set-reveal-answer', false)
  }, GRADE_TOAST_MS)
}

function revealNow() {
  if (isMcqCard.value) return
  emit('set-reveal-answer', true)
  showSelfGrade.value = true
}

function timeoutFail() {
  if (isBusyGrading.value || !props.activeStudyCard?.id || !props.sessionStarted) return
  // if already answered, do nothing
  if (isMcqCard.value && selectedOption.value) return
  if (!isMcqCard.value && props.revealAnswer && !showSelfGrade.value) return

  toastType.value = 'incorrect'
  toastReason.value = 'timeout'
  toastTargetBox.value = 1
  isBusyGrading.value = true
  showSelfGrade.value = false
  window.setTimeout(() => {
    emit('apply-study-grade', false)
    isBusyGrading.value = false
    toastType.value = ''
    toastReason.value = ''
    toastTargetBox.value = 0
    selectedOption.value = ''
    selectedCorrect.value = null
    showExplanation.value = false
    emit('set-reveal-answer', false)
  }, TIMEOUT_TOAST_MS)
}
</script>

<template>
  <section class="panel main-panel study-sprint-panel" v-if="props.visible">
    <div class="panel-head">
      <h2>Study Mode · {{ props.selectedSubject?.subject_name }}</h2>
      <button class="btn ghost" @click="emit('back-to-subject')">Back to cards</button>
    </div>
    <template v-if="!props.sessionStarted && !props.sessionDone">
      <article class="study-hub-hero">
        <div class="study-hub-icon">🔥</div>
        <h3>Study Sprint</h3>
        <p class="study-hub-due">{{ props.dueCardsLength }} cards due today</p>
        <div class="study-hub-controls">
          <button class="mini-btn timer-toggle" :class="{ active: pressureEnabled }" @click="pressureEnabled = !pressureEnabled">
            20s pressure timer: <strong>{{ pressureEnabled ? 'On' : 'Off' }}</strong>
          </button>
          <small class="muted">When time runs out, the card auto-fails and drops to Box 1.</small>
        </div>
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
          :class="[{ pulse: props.pulseBox === b.box }, b.boxClass]"
        >
          <div class="journey-title">
            <strong><span class="box-icon">{{ boxIcon(b.box) }}</span>{{ b.title }}</strong>
            <span>{{ b.interval }}</span>
          </div>
          <div class="journey-count">{{ b.count }}</div>
          <small>card{{ b.count === 1 ? '' : 's' }}</small>
        </article>
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

      <div class="journey-grid" style="grid-template-columns: repeat(5, minmax(120px, 1fr));">
        <article v-for="b in boxJourney" :key="`done-${b.box}`" class="journey-card" :class="b.boxClass">
          <div class="journey-title">
            <strong><span class="box-icon">{{ boxIcon(b.box) }}</span>Box {{ b.box }}</strong>
            <span>{{ b.interval }}</span>
          </div>
          <div class="journey-count">{{ b.count }}</div>
          <small>card{{ b.count === 1 ? '' : 's' }}</small>
        </article>
      </div>
    </template>
    <template v-else-if="props.activeStudyCard">
      <!-- Keep Study page structure; run the review experience in a modal overlay -->
      <div class="modal" v-if="props.sessionStarted">
        <div class="modal-card neon study-modal-card study-sprint">
          <div class="panel-head">
            <div>
              <h3>{{ props.selectedSubject?.subject_name }}</h3>
              <div class="study-modal-subline">
                <small class="muted">Daily Review · {{ props.sessionReviewed }}/{{ props.sessionTotalDue || props.sessionReviewed }}</small>
                <small v-if="pressureEnabled" class="study-timer-pill" :class="{ danger: pressureSeconds <= 5 }">
                  ⏱ {{ pressureSeconds }}s
                </small>
              </div>
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
              <div v-if="pressureEnabled && pressureRunning" class="mcq-timer">
                Time left: <strong>{{ pressureSeconds }}s</strong>
              </div>
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
            <div class="flip-card" :class="{ flipped: props.revealAnswer }">
              <div class="flip-face flip-front">
                <div class="face-body">
                  <span class="face-side-label front-label">Question</span>
                  <div class="face-question">{{ props.activeStudyCard.front_text }}</div>
                </div>
                <div class="flip-hint">
                  <span v-if="pressureEnabled && pressureRunning">Time left: {{ pressureSeconds }}s</span>
                  <span v-else-if="props.revealAnswer">Answer revealed</span>
                  <span v-else>Reveal when you’re ready</span>
                  <button class="mini-btn ghost" style="margin-left: 10px;" v-if="!props.revealAnswer" @click.stop="revealNow">Reveal answer</button>
                </div>
              </div>
              <div class="flip-face flip-back" :class="{ essay: String(props.activeStudyCard?.card_type || '').toLowerCase().includes('essay') }">
                <div class="face-body">
                  <span class="face-side-label back-label">{{ backBadgeLabel }}</span>
                  <div class="face-answer" v-if="props.revealAnswer">{{ props.activeStudyCard.back_text }}</div>
                  <div v-else class="face-answer" style="opacity: 0.35;">Answer hidden…</div>
                </div>
                <div class="flip-hint" v-if="props.revealAnswer">Were you correct?</div>
                <div class="flip-hint" v-else>Use “Reveal answer” when you’re ready</div>
              </div>
            </div>
          </div>

          <!-- Success/failure overlay (brief) -->
          <div class="study-outcome" v-if="toastType">
            <div class="study-outcome-card" :class="toastType">
              <div class="study-outcome-icon" v-if="toastType === 'correct'">✓</div>
              <div class="study-outcome-icon" v-else>!</div>
              <div class="study-outcome-title" v-if="toastType === 'correct'">
                Congrats — that card has moved up to Box {{ toastTargetBox }}.
              </div>
              <div class="study-outcome-title" v-else>
                <template v-if="toastReason === 'timeout'">Time’s up — moving back to Box 1.</template>
                <template v-else>Unlucky — you’ll need to try that again tomorrow… moving back to Box 1.</template>
              </div>
              <div class="study-outcome-sub">Box {{ props.activeStudyCard?.box_number || 1 }} → Box {{ toastTargetBox }}</div>
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
