<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  examLevelChoices: { type: Array, required: true },
  modalLevel: { type: String, required: true },
  modalSearch: { type: String, required: true },
  filteredModalSubjects: { type: Array, required: true },
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
</script>

<template>
  <div class="modal" v-if="props.visible">
    <div class="modal-card neon">
      <div class="panel-head">
        <h3>Select your subjects</h3>
        <button class="mini-btn" @click="emit('close')">Close</button>
      </div>
      <p class="muted">Step 1: Choose exam level. Step 2: choose up to {{ props.maxSubjects }} subjects.</p>
      <select :value="props.modalLevel" @change="onLevelChange">
        <option v-for="q in props.examLevelChoices" :key="q.label" :value="q.label">{{ q.label }}</option>
      </select>
      <input :value="props.modalSearch" @input="onSearchInput" placeholder="Search subjects..." />
      <div class="subject-pick">
        <button
          v-for="subject in props.filteredModalSubjects"
          :key="`modal-${subject.subject_key}`"
          class="subject-item picker"
          :class="{ active: props.subjectDraft.includes(subject.subject_key) }"
          @click="emit('toggle-subject', subject.subject_key)"
        >
          <div>
            <div>{{ subject.subject_name }}</div>
            <small>{{ subject.exam_board }} · {{ subject.qualification_type }}</small>
          </div>
        </button>
      </div>
      <div class="panel-head">
        <small class="muted">Selected: {{ props.subjectDraft.length }} / {{ props.maxSubjects }}</small>
        <button class="btn neon-btn" :disabled="props.busy" @click="emit('save-subjects')">Save subjects</button>
      </div>
      <small class="muted" v-if="props.subjectDraft.length >= props.maxSubjects">
        Subject cap reached in Lite. Use full FL4SH app for unlimited subjects.
      </small>
    </div>
  </div>
</template>
