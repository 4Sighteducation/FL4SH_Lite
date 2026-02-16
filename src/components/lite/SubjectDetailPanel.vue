<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  selectedSubject: { type: Object, default: null },
  cards: { type: Array, required: true },
  topicTreeLoading: { type: Boolean, required: true },
  topicTreeError: { type: String, required: true },
  activeTopicFilter: { type: String, required: true },
  topicRows: { type: Array, required: true },
  expandedTopics: { type: Object, required: true },
  selectedSubjectKey: { type: String, required: true },
  selectedSubjectMeta: { type: Function, required: true },
  getSubjectColor: { type: Function, required: true },
  dueCount: { type: Number, required: true },
  masteredCount: { type: Number, required: true },
  topicCount: { type: Number, required: true },
  hasActiveFilters: { type: Boolean, required: true },
})

const emit = defineEmits([
  'start-study',
  'back-home',
  'set-active-topic-filter',
  'toggle-topic-row',
  'open-create-flow',
])
</script>

<template>
  <section class="panel main-panel" v-if="props.visible">
    <div class="panel-head">
      <h2>{{ props.selectedSubject?.subject_name || 'Subject' }}</h2>
      <div class="toolbar">
        <button class="btn" @click="emit('start-study')" :disabled="props.dueCount === 0">Start Study ({{ props.dueCount }} due)</button>
        <button class="btn ghost" @click="emit('back-home')">Back</button>
      </div>
    </div>
    <div class="muted">{{ props.selectedSubjectMeta() }}</div>
    <div class="stat-chip-row">
      <span class="stat-chip">Cards: {{ props.cards.length }}</span>
      <span class="stat-chip">Topics: {{ props.topicCount }}</span>
      <span class="stat-chip">Due now: {{ props.dueCount }}</span>
      <span class="stat-chip">Mastered: {{ props.masteredCount }}</span>
    </div>
    <div class="toolbar" style="margin-top: 8px;">
      <button class="btn neon-btn" @click="emit('open-create-flow')">Create Card</button>
    </div>
    <div class="section-shell">
      <div class="panel-head">
        <h3>Topic hierarchy</h3>
        <button
          class="mini-btn"
          v-if="props.hasActiveFilters"
          @click="
            emit('set-active-box-filter', 0);
            emit('set-active-topic-filter', '')
          "
        >
          Reset filters
        </button>
      </div>
      <small class="muted">Select a topic to open its cards in the modal viewer.</small>
      <div v-if="props.topicTreeLoading" class="muted">Loading topic tree...</div>
      <div v-else-if="props.topicTreeError" class="muted">{{ props.topicTreeError }}</div>
      <div class="topic-tree-list">
        <button class="topic-row all" :class="{ active: !props.activeTopicFilter }" @click="emit('set-active-topic-filter', '')">
          <span>All topics</span>
          <strong>{{ props.cards.length }}</strong>
        </button>
        <button
          v-for="row in props.topicRows"
          :key="row.id"
          class="topic-row"
          :class="{ active: props.activeTopicFilter === row.topic_code }"
          :style="{ marginLeft: `${row.depth * 12}px`, borderLeftColor: props.getSubjectColor(props.selectedSubjectKey) }"
          @click="emit('toggle-topic-row', row)"
        >
          <span class="topic-label">
            <span v-if="row.hasChildren">{{ props.expandedTopics[row.id] ? '▾' : '▸' }}</span>
            {{ row.label }}
          </span>
          <strong>{{ row.count || 0 }}</strong>
        </button>
      </div>
    </div>
  </section>
</template>
