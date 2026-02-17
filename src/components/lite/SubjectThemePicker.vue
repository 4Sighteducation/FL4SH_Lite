<script setup>
import { computed, ref } from 'vue'
import { SUBJECT_THEME_COLORS, SUBJECT_THEME_GRADIENTS } from '../../features/lite/constants'

const props = defineProps({
  visible: { type: Boolean, required: true },
  subjectName: { type: String, default: '' },
  currentTheme: { type: Object, required: true }, // { accent, gradient }
})

const emit = defineEmits(['close', 'select'])

const tab = ref('colors') // colors | gradients
const activeAccent = computed(() => String(props.currentTheme?.accent || '').trim())
const activeGradient = computed(() => String(props.currentTheme?.gradient || '').trim())

function pickColor(hex) {
  emit('select', { accent: hex, gradient: '' })
}
function pickGradient(row) {
  emit('select', { accent: row.accent, gradient: row.gradient })
}
</script>

<template>
  <div class="modal" v-if="props.visible" @click.self="emit('close')">
    <div class="modal-card neon theme-picker-card">
      <div class="panel-head">
        <div>
          <h3>Subject theme</h3>
          <small class="muted">{{ props.subjectName || 'Choose a look' }}</small>
        </div>
        <button class="mini-btn" @click="emit('close')">Close</button>
      </div>

      <div class="toolbar" style="justify-content:flex-start; gap: 8px;">
        <button class="mini-btn" :class="{ active: tab === 'colors' }" @click="tab = 'colors'">Colours</button>
        <button class="mini-btn" :class="{ active: tab === 'gradients' }" @click="tab = 'gradients'">Gradients</button>
      </div>

      <div class="theme-preview">
        <div class="theme-preview-swatch" :style="{ background: activeGradient || activeAccent }"></div>
        <div>
          <div class="muted" style="font-weight:800;">Current</div>
          <div class="muted" style="font-family:'Space Mono', monospace;">{{ activeGradient ? 'Gradient' : 'Colour' }} · {{ activeAccent }}</div>
        </div>
      </div>

      <div v-if="tab === 'colors'" class="theme-grid">
        <button
          v-for="hex in SUBJECT_THEME_COLORS"
          :key="`c-${hex}`"
          class="theme-tile"
          :class="{ active: hex.toLowerCase() === activeAccent.toLowerCase() && !activeGradient }"
          :style="{ background: hex }"
          @click="pickColor(hex)"
          :title="hex"
        />
      </div>

      <div v-else class="theme-grid gradients">
        <button
          v-for="g in SUBJECT_THEME_GRADIENTS"
          :key="`g-${g.id}`"
          class="theme-tile gradient"
          :class="{ active: activeGradient === g.gradient }"
          :style="{ backgroundImage: g.gradient }"
          @click="pickGradient(g)"
          :title="g.label"
        >
          <span class="theme-tile-label">{{ g.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

