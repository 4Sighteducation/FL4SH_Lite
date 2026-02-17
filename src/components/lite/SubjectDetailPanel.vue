<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  visible: { type: Boolean, required: true },
  selectedSubject: { type: Object, default: null },
  cards: { type: Array, required: true },
  topicTreeLoading: { type: Boolean, required: true },
  topicTreeError: { type: String, required: true },
  activeTopicFilter: { type: String, required: true },
  topicPriorities: { type: Object, required: true },
  topicTree: { type: Array, required: true },
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
  'open-card-bank',
  'set-topic-priority',
])

const topicSearch = ref('')
const allTopicRows = computed(() => {
  const out = []
  const walk = (nodes, depth = 0) => {
    ;(Array.isArray(nodes) ? nodes : []).forEach((node) => {
      const id = String(node?.id || node?.topic_code || node?.topic_name || '')
      const children = Array.isArray(node?.children) ? node.children : []
      out.push({
        id,
        depth,
        label: String(node?.topic_name || node?.topic_code || ''),
        topic_code: String(node?.topic_code || node?.topic_name || ''),
        count: Number(node?.card_count || 0),
        hasChildren: children.length > 0,
      })
      if (children.length) walk(children, depth + 1)
    })
  }
  walk(props.topicTree || [])
  return out
})
const filteredTopicRows = computed(() => {
  const query = topicSearch.value.trim().toLowerCase()
  if (!query) return props.topicRows
  return allTopicRows.value.filter((row) => String(row.label || '').toLowerCase().includes(query))
})

function rawPriority(topicCode) {
  const key = String(topicCode || '').trim()
  if (!key) return 0
  return Number(props.topicPriorities?.[key] || 0) || 0
}

const priorityById = computed(() => {
  const walk = (nodes) => {
    const result = new Map()
    const visit = (node) => {
      const id = String(node?.id || node?.topic_code || node?.topic_name || '')
      const code = String(node?.topic_code || node?.topic_name || '')
      const children = Array.isArray(node?.children) ? node.children : []
      if (!children.length) {
        const p = rawPriority(code)
        result.set(id, p)
        return { p, has: Boolean(p) }
      }
      let sum = 0
      let count = 0
      children.forEach((child) => {
        const info = visit(child)
        if (info.has) {
          sum += info.p
          count += 1
        }
      })
      if (count > 0) {
        const avg = Math.round(sum / count)
        result.set(id, avg)
        return { p: avg, has: true }
      }
      const own = rawPriority(code)
      result.set(id, own)
      return { p: own, has: Boolean(own) }
    }
    ;(Array.isArray(nodes) ? nodes : []).forEach(visit)
    return result
  }
  return walk(props.topicTree || [])
})

function effectivePriority(row) {
  const id = String(row?.id || '')
  if (!id) return 0
  return Number(priorityById.value.get(id) || 0) || 0
}

function priorityLabel(p) {
  if (p === 1) return 'P1'
  if (p === 2) return 'P2'
  if (p === 3) return 'P3'
  return '—'
}
function priorityText(p) {
  if (p === 1) return 'High'
  if (p === 2) return 'Medium'
  if (p === 3) return 'Low'
  return 'Set priority'
}
function priorityClass(p) {
  return {
    'prio-pill': true,
    p1: p === 1,
    p2: p === 2,
    p3: p === 3,
    none: !p,
  }
}
function cyclePriority(row) {
  const code = String(row?.topic_code || '').trim()
  if (!code) return
  const current = rawPriority(code)
  const next = current === 1 ? 2 : current === 2 ? 3 : current === 3 ? 0 : 1
  emit('set-topic-priority', { topic_code: code, priority: next })
}

const totalCards = computed(() => Number(props.cards?.length || 0))
function progressPercent(count) {
  const total = totalCards.value
  if (!total) return 0
  const c = Number(count || 0)
  return Math.max(0, Math.min(100, Math.round((c / total) * 100)))
}
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

    <div class="sd-action-cards">
      <button class="sd-action-card create" @click="emit('open-create-flow', props.activeTopicFilter || '')">
        <span class="sd-action-badge cards">{{ props.cards.length }} cards</span>
        <span class="sd-action-icon">✦</span>
        <div class="sd-action-title">Create Cards</div>
        <div class="sd-action-desc">AI-generated or write your own flashcards for any topic</div>
      </button>
      <button class="sd-action-card bank" @click="emit('open-card-bank')">
        <span class="sd-action-badge cards">{{ props.cards.length }} total</span>
        <span class="sd-action-icon">📚</span>
        <div class="sd-action-title">Card Bank</div>
        <div class="sd-action-desc">Browse, flip, and review all your cards outside Study Mode</div>
      </button>
      <button class="sd-action-card study" @click="emit('start-study')" :disabled="props.dueCount === 0">
        <span class="sd-action-badge due">{{ props.dueCount }} due</span>
        <span class="sd-action-icon">⚡</span>
        <div class="sd-action-title">Start Studying</div>
        <div class="sd-action-desc">Review your due cards using spaced repetition</div>
      </button>
    </div>

    <div class="sd-stats-strip">
      <div class="sd-stat-cell">
        <span class="sd-stat-number">{{ props.cards.length }}</span>
        <span class="sd-stat-label">Cards</span>
      </div>
      <div class="sd-stat-cell">
        <span class="sd-stat-number hot">{{ props.dueCount }}</span>
        <span class="sd-stat-label">Due now</span>
      </div>
      <div class="sd-stat-cell">
        <span class="sd-stat-number accent">{{ props.topicCount }}</span>
        <span class="sd-stat-label">Topics</span>
      </div>
      <div class="sd-stat-cell">
        <span class="sd-stat-number correct">{{ props.masteredCount }}</span>
        <span class="sd-stat-label">Mastered</span>
      </div>
    </div>

    <div class="section-shell">
      <div class="sd-topic-head">
        <span class="sd-topic-title">Topics</span>
        <div class="sd-topic-search">
          <input v-model="topicSearch" class="sd-topic-search-input" type="search" placeholder="Search topics..." />
          <button v-if="topicSearch" class="mini-btn ghost" @click="topicSearch = ''">Clear</button>
          <button class="mini-btn" v-if="props.hasActiveFilters" @click="emit('set-active-topic-filter', '')">Reset</button>
        </div>
      </div>

      <div v-if="props.topicTreeLoading" class="muted">Loading topic tree...</div>
      <div v-else-if="props.topicTreeError" class="muted">{{ props.topicTreeError }}</div>

      <div class="sd-topic-tree">
        <button
          class="sd-topic-row all-row"
          :class="{ active: !props.activeTopicFilter }"
          data-depth="0"
          @click="emit('set-active-topic-filter', '')"
        >
          <span class="sd-topic-expand leaf">›</span>
          <span class="sd-topic-name">All topics</span>
          <div class="sd-topic-meta">
            <div class="sd-topic-progress-bar">
              <div class="sd-topic-progress-fill" :style="{ width: `${progressPercent(props.cards.length)}%` }"></div>
            </div>
            <span class="sd-topic-count" :class="{ 'has-cards': props.cards.length > 0 }">{{ props.cards.length }}</span>
          </div>
        </button>

        <button
          v-for="row in filteredTopicRows"
          :key="row.id"
          class="sd-topic-row"
          :class="{
            active: props.activeTopicFilter === row.topic_code,
            'leaf-topic': !row.hasChildren,
          }"
          :data-depth="row.depth"
          @click="emit('toggle-topic-row', row)"
        >
          <span
            class="sd-topic-expand"
            :class="{
              open: row.hasChildren && props.expandedTopics[row.id],
              leaf: !row.hasChildren,
            }"
          >
            ›
          </span>
          <span class="sd-topic-name">{{ row.label }}</span>
          <div class="sd-topic-meta">
            <button
              class="prio-pill-btn"
              :title="priorityText(effectivePriority(row))"
              @click.stop="cyclePriority(row)"
            >
              <span :class="priorityClass(effectivePriority(row))">{{ priorityLabel(effectivePriority(row)) }}</span>
            </button>
            <div class="sd-topic-progress-bar">
              <div
                class="sd-topic-progress-fill"
                :class="{ empty: !row.count }"
                :style="{ width: `${progressPercent(row.count)}%` }"
              ></div>
            </div>
            <span class="sd-topic-count" :class="{ 'has-cards': row.count > 0 }">{{ row.count || 0 }}</span>
          </div>
        </button>
      </div>
    </div>
  </section>
</template>
