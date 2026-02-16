<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
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
  'update:modalLevel',
  'update:modalSearch',
  'toggle-subject',
  'save-subjects',
])

function onLevelChange(event) {
  emit('update:modalLevel', event?.target?.value || '')
}

function onSearchInput(event) {
  emit('update:modalSearch', event?.target?.value || '')
}

function isSubjectLocked(subjectKey) {
  if (props.subjectDraft.includes(subjectKey)) return false
  return props.subjectDraft.length >= props.maxSubjects
}
</script>

<template>
  <div class="modal" v-if="props.visible">
    <div class="modal-card neon subject-modal-card">
      <div class="panel-head">
        <h3>Select your subjects</h3>
        <button class="mini-btn" @click="emit('close')">Close</button>
      </div>
      <p class="muted">Step 1: Choose exam level. Step 2: choose up to {{ props.maxSubjects }} subjects.</p>
      <select :value="props.modalLevel" @change="onLevelChange">
        <option v-for="q in props.examLevelChoices" :key="q.label" :value="q.label">{{ q.label }}</option>
      </select>
      <input :value="props.modalSearch" @input="onSearchInput" placeholder="Search subjects..." />
      <small class="muted">Showing {{ props.resultCount }} subject{{ props.resultCount === 1 ? '' : 's' }} · Level: {{ props.modalLevel }}</small>
      <div class="subject-pick">
        <button
          v-for="subject in props.filteredModalSubjects"
          :key="`modal-${subject.subject_key}`"
          class="subject-item picker"
          :class="{ active: props.subjectDraft.includes(subject.subject_key), locked: isSubjectLocked(subject.subject_key) }"
          :disabled="isSubjectLocked(subject.subject_key)"
          @click="emit('toggle-subject', subject.subject_key)"
        >
          <div>
            <div class="subject-name">{{ subject.subject_name }}</div>
            <small class="subject-meta">{{ subject.exam_board }} · {{ subject.qualification_type }}</small>
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
</template>
