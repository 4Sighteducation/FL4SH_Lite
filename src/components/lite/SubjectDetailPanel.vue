<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  selectedSubject: { type: Object, default: null },
  cards: { type: Array, required: true },
  boxStats: { type: Array, required: true },
  activeBoxFilter: { type: Number, required: true },
  pulseBox: { type: Number, required: true },
  movingCardText: { type: String, required: true },
  topicTreeLoading: { type: Boolean, required: true },
  topicTreeError: { type: String, required: true },
  activeTopicFilter: { type: String, required: true },
  topicRows: { type: Array, required: true },
  expandedTopics: { type: Object, required: true },
  selectedSubjectKey: { type: String, required: true },
  selectedSubjectMeta: { type: Function, required: true },
  getSubjectColor: { type: Function, required: true },
  shortLine: { type: Function, required: true },
  isCardDue: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  manualTopic: { type: String, required: true },
  manualFront: { type: String, required: true },
  manualBack: { type: String, required: true },
  aiTopic: { type: String, required: true },
  aiType: { type: String, required: true },
  aiCount: { type: Number, required: true },
  busy: { type: Boolean, required: true },
  filteredCards: { type: Array, required: true },
  dueCount: { type: Number, required: true },
  masteredCount: { type: Number, required: true },
  hasActiveFilters: { type: Boolean, required: true },
})

const emit = defineEmits([
  'start-study',
  'back-home',
  'set-active-box-filter',
  'set-active-topic-filter',
  'toggle-topic-row',
  'update:manualTopic',
  'update:manualFront',
  'update:manualBack',
  'update:aiTopic',
  'update:aiType',
  'update:aiCount',
  'add-manual-card',
  'generate-cards',
  'open-card-modal',
  'delete-card',
])

function onManualTopicInput(event) {
  emit('update:manualTopic', event?.target?.value || '')
}
function onManualFrontInput(event) {
  emit('update:manualFront', event?.target?.value || '')
}
function onManualBackInput(event) {
  emit('update:manualBack', event?.target?.value || '')
}
function onAiTopicInput(event) {
  emit('update:aiTopic', event?.target?.value || '')
}
function onAiTypeChange(event) {
  emit('update:aiType', event?.target?.value || 'short_answer')
}
function onAiCountInput(event) {
  emit('update:aiCount', Number(event?.target?.value || 3))
}
</script>

<template>
  <section class="panel main-panel" v-if="props.visible">
    <div class="panel-head">
      <h2>{{ props.selectedSubject?.subject_name || 'Subject' }}</h2>
      <div class="toolbar">
        <button class="btn" @click="emit('start-study')" :disabled="props.dueCount === 0">Study Mode ({{ props.dueCount }})</button>
        <button class="btn ghost" @click="emit('back-home')">Back</button>
      </div>
    </div>
    <div class="muted">{{ props.selectedSubjectMeta() }}</div>
    <div class="stat-chip-row">
      <span class="stat-chip">Cards: {{ props.cards.length }}</span>
      <span class="stat-chip">Due now: {{ props.dueCount }}</span>
      <span class="stat-chip">Mastered: {{ props.masteredCount }}</span>
    </div>
    <div class="leitner-wrap">
      <div class="leitner-head">
        <h3>Leitner Boxes</h3>
        <div class="toolbar">
          <button class="mini-btn" :class="{ active: !props.activeBoxFilter }" @click="emit('set-active-box-filter', 0)">All cards</button>
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
      </div>
      <div class="leitner-grid">
        <article
          v-for="b in props.boxStats"
          :key="b.box"
          class="leitner-box"
          :class="{ active: props.activeBoxFilter === b.box, pulse: props.pulseBox === b.box }"
          @click="emit('set-active-box-filter', props.activeBoxFilter === b.box ? 0 : b.box)"
        >
          <div class="box-label">
            <strong>Box {{ b.box }}</strong>
            <span>{{ b.title }} · {{ b.interval }}</span>
          </div>
          <div class="box-count">{{ b.count }} card{{ b.count === 1 ? '' : 's' }}</div>
          <div class="box-preview">
            <small v-for="p in b.preview" :key="p.id">{{ props.shortLine(p.front_text) }}</small>
            <small v-if="!b.preview.length" class="muted">No cards yet</small>
          </div>
          <div v-if="props.pulseBox === b.box && props.movingCardText" class="box-fly-chip">+ {{ props.movingCardText }}</div>
        </article>
      </div>
    </div>
    <div class="muted">Saved cards for this subject: {{ props.cards.length }}</div>
    <div v-if="props.topicTreeLoading" class="muted">Loading topic tree...</div>
    <div v-else-if="props.topicTreeError" class="muted">{{ props.topicTreeError }}</div>
    <div class="topic-strip">
      <button class="topic-pill" :class="{ active: !props.activeTopicFilter }" @click="emit('set-active-topic-filter', '')">All topics</button>
      <button
        v-for="row in props.topicRows"
        :key="row.id"
        class="topic-pill"
        :class="{ active: props.activeTopicFilter === row.topic_code, topicNode: true }"
        :style="{ marginLeft: `${row.depth * 12}px`, borderColor: props.getSubjectColor(props.selectedSubjectKey) }"
        @click="emit('toggle-topic-row', row)"
      >
        <span v-if="row.hasChildren">{{ props.expandedTopics[row.id] ? '▾' : '▸' }}</span>
        {{ row.label }}
        <em v-if="row.count">({{ row.count }})</em>
      </button>
    </div>

    <div class="forms">
      <div class="form-card">
        <h3>Create card in topic shell</h3>
        <input :value="props.manualTopic" @input="onManualTopicInput" placeholder="Topic (optional but recommended)" />
        <textarea :value="props.manualFront" @input="onManualFrontInput" placeholder="Question / front of card"></textarea>
        <textarea :value="props.manualBack" @input="onManualBackInput" placeholder="Answer / back of card"></textarea>
        <button class="btn neon-btn" :disabled="props.busy" @click="emit('add-manual-card')">{{ props.busy ? 'Saving...' : 'Add card' }}</button>
      </div>
      <div class="form-card">
        <h3>Generate with AI</h3>
        <input :value="props.aiTopic" @input="onAiTopicInput" placeholder="Topic (required for good results)" />
        <div class="row">
          <select :value="props.aiType" @change="onAiTypeChange">
            <option value="short_answer">Short answer</option>
            <option value="multiple_choice">Multiple choice</option>
            <option value="essay">Essay</option>
            <option value="acronym">Acronym</option>
          </select>
          <input type="number" min="1" max="5" :value="props.aiCount" @input="onAiCountInput" />
        </div>
        <button class="btn hot" :disabled="props.busy || !props.aiTopic" @click="emit('generate-cards')">{{ props.busy ? 'Generating...' : 'Generate cards' }}</button>
        <small class="muted">Lite excludes voice feedback on short/essay questions.</small>
      </div>
    </div>

    <div class="cards">
      <div v-if="!props.cards.length" class="notice neon">
        You do not have any cards in this subject yet. Add one manually or generate with AI to begin.
      </div>
      <article class="card" v-for="c in props.filteredCards" :key="c.id" @click="emit('open-card-modal', c)">
        <h4>{{ c.front_text }}</h4>
        <small class="muted" v-if="c.topic_code">Topic: {{ c.topic_code }}</small>
        <small :class="props.isCardDue(c) ? 'due-tag' : 'scheduled-tag'">
          {{ props.isCardDue(c) ? 'Due now' : `Next due ${props.formatDate(c.next_review_at)}` }}
        </small>
        <p>{{ props.shortLine(c.back_text, 160) }}</p>
        <div class="card-actions">
          <span>Box {{ c.box_number || 1 }}</span>
          <button @click.stop="emit('delete-card', c.id)" :disabled="props.busy">Delete</button>
        </div>
      </article>
      <div v-if="props.cards.length > 0 && props.filteredCards.length === 0" class="notice neon">
        No cards match this topic/box filter. Reset filters to see all cards.
      </div>
    </div>
  </section>
</template>
