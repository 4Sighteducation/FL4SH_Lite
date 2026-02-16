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
  }
)

function chooseOption(key) {
  if (selectedOption.value) return
  selectedOption.value = key
  const correct = String(activeMcq.value?.correct || '').toUpperCase()
  selectedCorrect.value = correct ? key === correct : null
}

function submitSelectedOption() {
  if (!selectedOption.value) return
  emit('apply-study-grade', selectedCorrect.value === true)
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
      <div class="study-progress-shell">
        <div class="study-progress-head">
          <small>Daily Review</small>
          <small>{{ props.sessionReviewed }}/{{ props.sessionTotalDue || props.sessionReviewed }}</small>
        </div>
        <div class="study-progress-track">
          <div class="study-progress-fill" :style="{ width: `${props.progressPercent}%` }"></div>
        </div>
      </div>
      <article class="review-shell">
        <header class="review-head">
          <span>{{ props.activeStudyCard.topic_code || 'General' }}</span>
          <span>Box {{ props.activeStudyCard.box_number || 1 }}</span>
        </header>
        <div class="review-question">
          {{ props.activeStudyCard.front_text }}
        </div>
        <button class="btn ghost" v-if="!props.revealAnswer" @click="emit('set-reveal-answer', true)">Reveal answer</button>
        <template v-else>
          <div v-if="activeMcq.options.length" class="mcq-grid">
            <button
              v-for="o in activeMcq.options"
              :key="o.key"
              class="mcq-option"
              :class="{
                active: selectedOption === o.key,
                correct: selectedOption && o.key === activeMcq.correct,
                wrong: selectedOption === o.key && activeMcq.correct && o.key !== activeMcq.correct
              }"
              @click="chooseOption(o.key)"
            >
              {{ o.key }}. {{ o.text }}
            </button>
          </div>
          <div v-else class="review-answer">{{ props.activeStudyCard.back_text }}</div>
          <div class="row" v-if="activeMcq.options.length">
            <button class="btn hot" :disabled="!selectedOption" @click="submitSelectedOption">Submit answer</button>
          </div>
          <div class="row" v-else>
            <button class="btn ghost" @click="emit('apply-study-grade', false)">Not quite</button>
            <button class="btn neon-btn" @click="emit('apply-study-grade', true)">Got it</button>
          </div>
        </template>
      </article>
      <div class="review-feedback success" v-if="props.lastOutcome === 'correct'">Nice one — moved forward.</div>
      <div class="review-feedback danger" v-if="props.lastOutcome === 'incorrect'">Not quite — back to review sooner.</div>
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
