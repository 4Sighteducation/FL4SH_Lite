<script setup>
const props = defineProps({
  selectedSubjects: { type: Array, required: true },
  selectedSubjectKey: { type: String, required: true },
  limits: { type: Object, required: true },
  getSubjectColor: { type: Function, required: true },
})

const emit = defineEmits(['manage-subjects', 'open-subject', 'set-subject-color'])

function onColorInput(subjectKey, event) {
  emit('set-subject-color', {
    subjectKey,
    color: event?.target?.value || '#7c4dff',
  })
}
</script>

<template>
  <aside class="panel">
    <div class="panel-head">
      <h3>Your subjects</h3>
      <button class="mini-btn active" @click="emit('manage-subjects')">Manage</button>
    </div>
    <p class="muted">Choose up to {{ props.limits.max_subjects }} subjects in Lite.</p>
    <div class="subject-cards">
      <button
        v-for="s in props.selectedSubjects"
        :key="s.subject_key"
        class="subject-card"
        :class="{ active: props.selectedSubjectKey === s.subject_key }"
        @click="emit('open-subject', s.subject_key)"
        :style="{ borderColor: props.getSubjectColor(s.subject_key) }"
      >
        <span class="subject-name">{{ s.subject_name }}</span>
        <small class="subject-meta">{{ s.exam_board }} · {{ s.qualification_type }}</small>
        <small class="subject-count">{{ s.card_count || 0 }}/{{ props.limits.max_cards_per_subject }} cards</small>
        <label class="subject-color-row">
          <span>Color</span>
          <input
            type="color"
            class="subject-color-input"
            :value="props.getSubjectColor(s.subject_key)"
            @input.stop="onColorInput(s.subject_key, $event)"
          />
        </label>
      </button>
      <div v-if="!props.selectedSubjects.length" class="muted">No subjects selected yet.</div>
    </div>
  </aside>
</template>
