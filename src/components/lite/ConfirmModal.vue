<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: 'Confirm' },
  cancelText: { type: String, default: 'Cancel' },
  tone: { type: String, default: 'danger' }, // danger | neutral
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['cancel', 'confirm'])
</script>

<template>
  <div class="modal" v-if="props.visible" @click.self="emit('cancel')">
    <div class="modal-card neon confirm-card" :class="props.tone">
      <div class="panel-head">
        <h3>{{ props.title }}</h3>
        <button class="mini-btn ghost" :disabled="props.busy" @click="emit('cancel')">Close</button>
      </div>

      <p class="confirm-message" style="white-space: pre-wrap;">{{ props.message }}</p>

      <div class="toolbar" style="justify-content:flex-end; margin-top: 10px;">
        <button class="mini-btn ghost" :disabled="props.busy" @click="emit('cancel')">{{ props.cancelText }}</button>
        <button
          class="mini-btn"
          :class="props.tone === 'danger' ? 'danger' : 'active'"
          :disabled="props.busy"
          @click="emit('confirm')"
        >
          <span v-if="props.busy" class="mini-spinner" style="margin-right: 8px;"></span>
          {{ props.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

