<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  links: { type: Object, required: true },
})

const emit = defineEmits(['close'])
</script>

<template>
  <div class="modal" v-if="props.visible">
    <div class="modal-card neon">
      <h3>{{ props.title }}</h3>
      <p>{{ props.message }}</p>
      <div class="badge-row">
        <a :href="props.links.appStore" target="_blank" rel="noopener" class="store-badge">
          <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" />
        </a>
        <a :href="props.links.playStore" target="_blank" rel="noopener" class="store-badge">
          <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" />
        </a>
      </div>
      <button class="btn neon-btn" @click="emit('close')">Continue in Lite</button>
    </div>
  </div>
</template>
