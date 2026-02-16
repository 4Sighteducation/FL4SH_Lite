<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  selectedSubjects: { type: Array, required: true },
  allSelectedSubjectsLength: { type: Number, required: true },
  subjectSearch: { type: String, required: true },
  limits: { type: Object, required: true },
  getSubjectColor: { type: Function, required: true },
})

const emit = defineEmits(['open-subject', 'update:subject-search', 'manage-subjects'])

function onSearchInput(event) {
  emit('update:subject-search', event?.target?.value || '')
}

function cardsRemaining(subject) {
  const remaining = Number(subject?.cards_remaining)
  if (Number.isFinite(remaining)) return Math.max(0, remaining)
  return Number(props.limits.max_cards_per_subject || 20)
}
</script>

<template>
  <section class="panel main-panel" v-if="props.visible">
    <div class="panel-head">
      <h2>Your FL4SH Lite subjects</h2>
      <button class="mini-btn active" @click="emit('manage-subjects')">Manage subjects</button>
    </div>
    <p class="muted">Each subject appears as a card with board and level metadata. Open one to view its topic tree and create cards in topic shells.</p>
    <input
      class="subject-search-input"
      :value="props.subjectSearch"
      @input="onSearchInput"
      placeholder="Search selected subjects..."
    />
    <div class="subject-grid-main">
      <button
        v-for="s in props.selectedSubjects"
        :key="`main-${s.subject_key}`"
        class="subject-main-card"
        @click="emit('open-subject', s.subject_key)"
        :style="{ borderColor: props.getSubjectColor(s.subject_key), boxShadow: `0 0 14px ${props.getSubjectColor(s.subject_key)}33` }"
      >
        <span class="subject-notice-badge">{{ s.card_count || 0 }}</span>
        <h3>{{ s.subject_name }}</h3>
        <p class="subject-meta">{{ s.exam_board }} · {{ s.qualification_type }}</p>
        <small class="subject-count">{{ s.card_count || 0 }} saved cards</small>
        <small class="subject-meta">{{ cardsRemaining(s) }} AI slots left in Lite</small>
      </button>
    </div>
    <div v-if="props.allSelectedSubjectsLength > 0 && !props.selectedSubjects.length" class="muted">
      No selected subjects match this search.
    </div>
    <div v-if="props.allSelectedSubjectsLength === 0" class="notice neon">
      Pick your first subjects to unlock cards and study mode.
    </div>
  </section>
</template>
