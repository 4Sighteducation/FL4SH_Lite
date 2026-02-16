<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  selectedSubjects: { type: Array, required: true },
  getSubjectColor: { type: Function, required: true },
})

const emit = defineEmits(['open-subject'])
</script>

<template>
  <section class="panel main-panel" v-if="props.visible">
    <h2>Your FL4SH Lite subjects</h2>
    <p class="muted">Each subject appears as a card with board and level metadata. Open one to view its topic tree and create cards in topic shells.</p>
    <div class="subject-grid-main">
      <button
        v-for="s in props.selectedSubjects"
        :key="`main-${s.subject_key}`"
        class="subject-main-card"
        @click="emit('open-subject', s.subject_key)"
        :style="{ borderColor: props.getSubjectColor(s.subject_key), boxShadow: `0 0 14px ${props.getSubjectColor(s.subject_key)}33` }"
      >
        <h3>{{ s.subject_name }}</h3>
        <p class="subject-meta">{{ s.exam_board }} · {{ s.qualification_type }}</p>
        <small class="subject-count">{{ s.card_count || 0 }} saved cards</small>
      </button>
    </div>
  </section>
</template>
