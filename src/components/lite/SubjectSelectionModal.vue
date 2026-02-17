<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, required: true },
  courseTypeChoices: { type: Array, required: true },
  modalCourseType: { type: String, required: true },
  examLevelChoices: { type: Array, required: true },
  modalLevel: { type: String, required: true },
  modalSearch: { type: String, required: true },
  filteredModalSubjects: { type: Array, required: true },
  resultCount: { type: Number, required: true },
  subjectDraft: { type: Array, required: true },
  maxSubjects: { type: Number, required: true },
  busy: { type: Boolean, required: true },
})

const emit = defineEmits([
  'close',
  'update:modalCourseType',
  'update:modalLevel',
  'update:modalSearch',
  'toggle-subject',
  'save-subjects',
])

const pickerOpen = ref(false)
watch(
  () => props.visible,
  (v) => {
    if (!v) pickerOpen.value = false
  }
)

function setCourseType(courseTypeId) {
  emit('update:modalCourseType', courseTypeId)
}
function setLevel(levelLabel) {
  emit('update:modalLevel', levelLabel)
}

function onLevelChange(event) {
  emit('update:modalLevel', event?.target?.value || '')
}

function onSearchInput(event) {
  emit('update:modalSearch', event?.target?.value || '')
}
function clearSearch() {
  emit('update:modalSearch', '')
}
function openPicker() {
  pickerOpen.value = true
}
function closePicker() {
  pickerOpen.value = false
}

function isSubjectLocked(subjectKey) {
  if (props.subjectDraft.includes(subjectKey)) return false
  return props.subjectDraft.length >= props.maxSubjects
}

const activeCourseType = computed(() => {
  return props.courseTypeChoices.find((c) => c.id === props.modalCourseType) || props.courseTypeChoices[0] || null
})
const levelChoicesForCourseType = computed(() => {
  const allowed = activeCourseType.value?.levels || []
  if (!allowed.length || allowed.includes('All levels')) return props.examLevelChoices
  return props.examLevelChoices.filter((row) => allowed.includes(row.label))
})
const wizardHint = computed(() => {
  const selected = props.subjectDraft.length
  if (!selected) return `Pick up to ${props.maxSubjects} subjects to unlock the app.`
  if (selected < props.maxSubjects) return `Select ${props.maxSubjects - selected} more or press Save.`
  return `You’ve selected the maximum for Lite. Press Save to continue.`
})
const sortedModalSubjects = computed(() => {
  return [...props.filteredModalSubjects].sort((a, b) => {
    const aSelected = props.subjectDraft.includes(a.subject_key) ? 1 : 0
    const bSelected = props.subjectDraft.includes(b.subject_key) ? 1 : 0
    if (aSelected !== bSelected) return bSelected - aSelected
    const aName = String(a.subject_name || '')
    const bName = String(b.subject_name || '')
    return aName.localeCompare(bName)
  })
})
</script>

<template>
  <div class="modal" v-if="props.visible">
    <div class="modal-card neon subject-modal-card">
      <div class="panel-head">
        <h3>Select your subjects</h3>
        <button class="mini-btn" @click="emit('close')">Close</button>
      </div>
      <p class="muted">Selection wizard · {{ wizardHint }}</p>

      <div class="wizard-block">
        <div class="wizard-title">Step 1: Course type</div>
        <div class="wizard-chip-row">
          <button
            v-for="c in props.courseTypeChoices"
            :key="c.id"
            class="chip-btn"
            :class="{ active: props.modalCourseType === c.id }"
            @click="setCourseType(c.id)"
            type="button"
          >{{ c.label }}</button>
        </div>
      </div>

      <div class="wizard-block">
        <div class="wizard-title">Step 2: Level</div>
        <div class="wizard-chip-row">
          <button
            v-for="q in levelChoicesForCourseType"
            :key="q.label"
            class="chip-btn"
            :class="{ active: props.modalLevel === q.label }"
            @click="setLevel(q.label)"
            type="button"
          >{{ q.label }}</button>
        </div>
      </div>

      <div class="wizard-block">
        <div class="wizard-title">Step 3: Find subjects</div>
        <div class="modal-search-row">
          <input :value="props.modalSearch" @input="onSearchInput" placeholder="Search subjects (optional)..." />
          <button v-if="props.modalSearch" class="mini-btn" @click="clearSearch">Clear</button>
        </div>
        <small class="muted">Showing {{ props.resultCount }} subject{{ props.resultCount === 1 ? '' : 's' }} · {{ props.modalLevel }}</small>
        <div class="wizard-actions">
          <button class="btn neon-btn" type="button" @click="openPicker">Browse subjects</button>
          <small class="muted">Selected: {{ props.subjectDraft.length }} / {{ props.maxSubjects }}</small>
        </div>
      </div>

      <div class="panel-head sticky-modal-footer">
        <small class="muted">Selected: {{ props.subjectDraft.length }} / {{ props.maxSubjects }}</small>
        <button class="btn neon-btn" :disabled="props.busy" @click="emit('save-subjects')">Save subjects</button>
      </div>

      <div class="subject-picker-overlay" v-if="pickerOpen">
        <div class="panel-head">
          <h3>Choose subjects</h3>
          <button class="mini-btn" type="button" @click="closePicker">Back</button>
        </div>
        <p class="muted">Pick up to {{ props.maxSubjects }} subjects. Selected subjects appear first.</p>
        <div class="modal-search-row">
          <input :value="props.modalSearch" @input="onSearchInput" placeholder="Search subjects..." />
          <button v-if="props.modalSearch" class="mini-btn" @click="clearSearch">Clear</button>
        </div>
        <small class="muted">Showing {{ props.resultCount }} subject{{ props.resultCount === 1 ? '' : 's' }} · {{ props.modalLevel }}</small>

        <div class="subject-pick subject-picker-grid">
          <button
            v-for="subject in sortedModalSubjects"
            :key="`picker-${subject.subject_key}`"
            class="subject-item picker"
            :class="{ active: props.subjectDraft.includes(subject.subject_key), locked: isSubjectLocked(subject.subject_key) }"
            :disabled="isSubjectLocked(subject.subject_key)"
            @click="emit('toggle-subject', subject.subject_key)"
          >
            <div>
              <div class="subject-name">{{ subject.subject_name }}</div>
              <small class="subject-meta">{{ subject.exam_board }} · {{ subject.qualification_type }}</small>
              <small class="subject-selected-tag" v-if="props.subjectDraft.includes(subject.subject_key)">Selected</small>
            </div>
          </button>
          <div v-if="!props.filteredModalSubjects.length" class="muted">No subjects match this search and level.</div>
        </div>

        <div class="panel-head sticky-modal-footer">
          <small class="muted">Selected: {{ props.subjectDraft.length }} / {{ props.maxSubjects }}</small>
          <button class="btn neon-btn" :disabled="props.busy" @click="emit('save-subjects')">Save subjects</button>
        </div>
        <small class="muted" v-if="props.subjectDraft.length >= props.maxSubjects">
          Subject cap reached in Lite. Use full FL4SH app for unlimited subjects.
        </small>
      </div>
    </div>
  </div>
</template>
