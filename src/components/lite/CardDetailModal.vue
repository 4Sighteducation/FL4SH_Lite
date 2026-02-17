<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  cardModal: { type: Object, required: true },
  busy: { type: Boolean, required: true },
  isCardDue: { type: Function, required: true },
  cardDueBadge: { type: Function, required: true },
  selectedSubjectMeta: { type: Function, required: true },
  cardModalBackSummary: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
  canPrevCard: { type: Boolean, required: true },
  canNextCard: { type: Boolean, required: true },
  sequenceLabel: { type: String, required: true },
})

const emit = defineEmits([
  'close',
  'toggle-flip',
  'toggle-details',
  'choose-option',
  'review',
  'delete-card',
  'prev-card',
  'next-card',
])
</script>

<template>
  <div class="modal" v-if="props.visible">
    <div class="modal-card neon">
      <div class="panel-head">
        <h3>Card</h3>
        <button class="mini-btn" @click="emit('close')">Close</button>
      </div>
      <div class="modal-meta-row">
        <span class="mini-chip">Box {{ props.cardModal.card?.box_number || 1 }}</span>
        <span class="mini-chip" :class="{ due: props.isCardDue(props.cardModal.card), frozen: !props.isCardDue(props.cardModal.card) }">
          {{ props.cardDueBadge(props.cardModal.card) }}
        </span>
        <span class="mini-chip">Topic: {{ props.cardModal.card?.topic_code || 'General' }}</span>
        <span class="mini-chip">{{ props.selectedSubjectMeta() }}</span>
        <span class="mini-chip" v-if="props.sequenceLabel">{{ props.sequenceLabel }}</span>
      </div>
      <div class="flip-shell" :class="{ flipped: props.cardModal.flipped }">
        <article class="flip-face front">
          <h4>{{ props.cardModal.card?.front_text }}</h4>
          <small class="muted">Tap flip to reveal</small>
        </article>
        <article class="flip-face back">
          <h4>Answer</h4>
          <p>{{ props.cardModalBackSummary() }}</p>
        </article>
      </div>
      <div v-if="props.cardModal.mcqOptions.length && props.cardModal.flipped" class="mcq-options">
        <h4>Multiple choice</h4>
        <div class="mcq-grid">
          <button
            v-for="o in props.cardModal.mcqOptions"
            :key="o.key"
            class="mcq-option"
            :class="{
              active: props.cardModal.selectedOption === o.key,
              correct: props.cardModal.selectedOption && o.key === props.cardModal.correctOption,
              wrong: props.cardModal.selectedOption === o.key && props.cardModal.correctOption && o.key !== props.cardModal.correctOption
            }"
            @click="emit('choose-option', o.key)"
          >{{ o.key }}) {{ o.text }}</button>
        </div>
        <small v-if="props.cardModal.selectedOption" class="muted">
          You chose {{ props.cardModal.selectedOption }}
          <span v-if="props.cardModal.correctOption"> · Correct answer: {{ props.cardModal.correctOption }}</span>
          <span v-if="props.cardModal.selectedCorrect === true"> · Nice one.</span>
          <span v-if="props.cardModal.selectedCorrect === false"> · Not this time.</span>
        </small>
      </div>
      <div class="toolbar">
        <button class="mini-btn" :disabled="!props.canPrevCard" @click="emit('prev-card')">Prev</button>
        <button class="mini-btn" :disabled="!props.canNextCard" @click="emit('next-card')">Next</button>
        <button class="btn ghost" @click="emit('toggle-flip')">{{ props.cardModal.flipped ? 'Show question' : 'Flip card' }}</button>
        <button class="btn ghost" @click="emit('toggle-details')">{{ props.cardModal.showDetails ? 'Hide details' : 'View details' }}</button>
        <button class="btn ghost danger-btn" :disabled="props.busy" @click="emit('delete-card')">Delete</button>
        <button class="btn ghost" :disabled="props.busy || !props.isCardDue(props.cardModal.card)" @click="emit('review', false)">Not quite</button>
        <button class="btn neon-btn" :disabled="props.busy || !props.isCardDue(props.cardModal.card)" @click="emit('review', true)">Got it</button>
      </div>
      <div v-if="props.cardModal.showDetails" class="card-detail-grid">
        <div><strong>Card type</strong><span>{{ props.cardModal.card?.card_type || 'short_answer' }}</span></div>
        <div><strong>Streak</strong><span>{{ props.cardModal.card?.streak || 0 }}</span></div>
        <div><strong>Next review</strong><span>{{ props.formatDateTime(props.cardModal.card?.next_review_at) }}</span></div>
        <div><strong>Last reviewed</strong><span>{{ props.formatDateTime(props.cardModal.card?.last_reviewed_at) }}</span></div>
        <div><strong>Created</strong><span>{{ props.formatDateTime(props.cardModal.card?.created_at) }}</span></div>
      </div>
      <div v-if="!props.isCardDue(props.cardModal.card)" class="notice neon">
        This card is not due yet. In Study Mode, only due cards are shown.
      </div>
    </div>
  </div>
</template>
