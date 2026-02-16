<script setup>
const props = defineProps({
  user: { type: Object, default: null },
  limits: { type: Object, required: true },
  links: { type: Object, required: true },
})
</script>

<template>
  <header class="topbar neon">
    <div class="brand-wrap">
      <div class="logo-mark"><img src="/flashv2.png" alt="FL4SH logo" /></div>
      <div>
        <div class="logo">FL4SH Lite</div>
        <div class="meta">{{ props.user?.name || 'Student' }} · {{ props.user?.school_name || '' }}</div>
      </div>
    </div>
    <div class="badge-row">
      <a :href="props.links.appStore" target="_blank" rel="noopener" class="store-badge">
        <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" />
      </a>
      <a :href="props.links.playStore" target="_blank" rel="noopener" class="store-badge">
        <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" />
      </a>
    </div>
  </header>

  <section class="notice neon">
    <strong>FL4SH Lite</strong> is limited to {{ props.limits.max_subjects }} subjects and {{ props.limits.max_cards_per_subject }} cards per subject.
    For full mobile-native experience, visit <a :href="props.links.website" target="_blank" rel="noopener">fl4shcards.com</a>.
  </section>
</template>
