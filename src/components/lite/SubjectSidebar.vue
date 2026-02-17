<script setup>
import { ref } from 'vue'
import SubjectThemePicker from './SubjectThemePicker.vue'

const props = defineProps({
  selectedSubjects: { type: Array, required: true },
  allSelectedSubjectsLength: { type: Number, required: true },
  selectedSubjectKey: { type: String, required: true },
  limits: { type: Object, required: true },
  subjectSearch: { type: String, required: true },
  getSubjectColor: { type: Function, required: true },
  getSubjectTheme: { type: Function, required: true },
})

const emit = defineEmits(['manage-subjects', 'open-subject', 'set-subject-color', 'update:subject-search'])

function onSearchInput(event) {
  emit('update:subject-search', event?.target?.value || '')
}

const themePickerSubjectKey = ref('')

function openThemePicker(subjectKey) {
  themePickerSubjectKey.value = String(subjectKey || '').trim()
}
function closeThemePicker() {
  themePickerSubjectKey.value = ''
}
function pickTheme(theme) {
  const subjectKey = themePickerSubjectKey.value
  if (!subjectKey) return
  emit('set-subject-color', { subjectKey, color: theme })
  closeThemePicker()
}

function openSubjectSafe(subjectKey) {
  closeThemePicker()
  emit('open-subject', subjectKey)
}
function manageSubjectsSafe() {
  closeThemePicker()
  emit('manage-subjects')
}
</script>

<template>
  <aside class="panel">
    <div class="panel-head">
      <h3>Your subjects</h3>
      <button class="mini-btn active" @click="manageSubjectsSafe">Manage</button>
    </div>
    <p class="muted">Choose up to {{ props.limits.max_subjects }} subjects in Lite.</p>
    <input
      class="subject-search-input"
      :value="props.subjectSearch"
      @input="onSearchInput"
      placeholder="Search selected subjects..."
    />
    <div class="subject-cards">
      <button
        v-for="s in props.selectedSubjects"
        :key="s.subject_key"
        class="subject-card"
        :class="{ active: props.selectedSubjectKey === s.subject_key }"
        @click="openSubjectSafe(s.subject_key)"
        :style="{
          borderColor: props.getSubjectColor(s.subject_key),
          '--subject-accent': props.getSubjectTheme(s.subject_key)?.accent || props.getSubjectColor(s.subject_key),
          '--subject-grad': props.getSubjectTheme(s.subject_key)?.gradient || props.getSubjectColor(s.subject_key),
        }"
      >
        <span class="subject-name">{{ s.subject_name }}</span>
        <small class="subject-meta">{{ s.exam_board }} · {{ s.qualification_type }}</small>
        <small class="subject-count">{{ s.card_count || 0 }} total cards</small>
        <label class="subject-color-row">
          <span>Theme</span>
          <button class="mini-btn ghost" @click.stop="openThemePicker(s.subject_key)">Choose</button>
        </label>
      </button>
      <div v-if="props.allSelectedSubjectsLength > 0 && !props.selectedSubjects.length" class="muted">
        No selected subjects match this search.
      </div>
      <div v-if="props.allSelectedSubjectsLength === 0" class="muted">No subjects selected yet.</div>
    </div>
  </aside>

  <SubjectThemePicker
    :visible="Boolean(themePickerSubjectKey)"
    :subject-name="props.selectedSubjects.find((x) => x.subject_key === themePickerSubjectKey)?.subject_name || ''"
    :current-theme="props.getSubjectTheme(themePickerSubjectKey)"
    @close="closeThemePicker"
    @select="pickTheme"
  />
</template>
