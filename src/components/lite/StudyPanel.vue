<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  selectedSubject: { type: Object, default: null },
  boxStats: { type: Array, required: true },
  pulseBox: { type: Number, required: true },
  movingCardText: { type: String, required: true },
  shortLine: { type: Function, required: true },
  sessionDone: { type: Boolean, required: true },
  dueCardsLength: { type: Number, required: true },
  sessionReviewed: { type: Number, required: true },
  activeStudyCard: { type: Object, default: null },
  revealAnswer: { type: Boolean, required: true },
})

const emit = defineEmits(['back-to-subject', 'set-reveal-answer', 'apply-study-grade'])
</script>

<template>
  <section class="panel main-panel" v-if="props.visible">
    <div class="panel-head">
      <h2>Study Mode · {{ props.selectedSubject?.subject_name }}</h2>
      <button class="btn ghost" @click="emit('back-to-subject')">Back to cards</button>
    </div>
    <div class="leitner-wrap compact">
      <div class="leitner-head">
        <h3>Leitner Boxes (live)</h3>
      </div>
      <div class="leitner-grid">
        <article
          v-for="b in props.boxStats"
          :key="`study-${b.box}`"
          class="leitner-box"
          :class="{ pulse: props.pulseBox === b.box }"
        >
          <div class="box-label">
            <strong>Box {{ b.box }}</strong>
            <span>{{ b.interval }}</span>
          </div>
          <div class="box-count">{{ b.count }} card{{ b.count === 1 ? '' : 's' }}</div>
          <div class="box-preview">
            <small v-for="p in b.preview" :key="p.id">{{ props.shortLine(p.front_text, 30) }}</small>
            <small v-if="!b.preview.length" class="muted">No cards</small>
          </div>
          <div v-if="props.pulseBox === b.box && props.movingCardText" class="box-fly-chip">+ {{ props.movingCardText }}</div>
        </article>
      </div>
    </div>
    <p class="muted" v-if="!props.sessionDone">Due cards left: {{ props.dueCardsLength }} · Reviewed this session: {{ props.sessionReviewed }}</p>
    <div v-if="props.sessionDone" class="notice neon">
      Session complete. You reviewed {{ props.sessionReviewed }} cards.
    </div>
    <template v-else-if="props.activeStudyCard">
      <article class="study-card">
        <h3>{{ props.activeStudyCard.front_text }}</h3>
        <p v-if="props.revealAnswer">{{ props.activeStudyCard.back_text }}</p>
        <button class="btn" v-if="!props.revealAnswer" @click="emit('set-reveal-answer', true)">Reveal answer</button>
        <div class="row" v-else>
          <button class="btn ghost" @click="emit('apply-study-grade', false)">Not quite</button>
          <button class="btn neon-btn" @click="emit('apply-study-grade', true)">Got it</button>
        </div>
      </article>
    </template>
    <div v-else class="muted">No cards are due right now. Come back later or create more cards.</div>
  </section>
</template>
