<script setup>
const props = defineProps({
  user: { type: Object, default: null },
  subjects: { type: Array, default: () => [] },
  limits: { type: Object, required: true },
  links: { type: Object, required: true },
})

const emit = defineEmits(['store-click', 'website-click'])

function subjectLabel(row) {
  const name = String(row?.subject_name || '').trim()
  const board = String(row?.exam_board || '').trim()
  if (!name) return ''
  return board ? `${name} (${board})` : name
}
</script>

<template>
  <header class="topbar neon">
    <div class="brand-wrap">
      <div class="logo-mark"><img :src="props.links.logoPng" alt="FL4SH logo" /></div>
      <div class="brand-text">
        <div class="logo">FL4SH Lite</div>
        <div class="meta">
          {{ props.user?.name || 'Student' }}
          <span v-if="props.user?.school_name"> · {{ props.user?.school_name }}</span>
          <span v-if="props.user?.qualification_level"> · {{ props.user?.qualification_level }}</span>
        </div>
        <div v-if="(props.subjects || []).length" class="subject-chip-row">
          <span v-for="s in (props.subjects || [])" :key="s.subject_key || subjectLabel(s)" class="subject-chip">
            {{ subjectLabel(s) }}
          </span>
        </div>
      </div>
    </div>
  </header>

  <section class="notice neon notice-hero">
    <div class="notice-main">
      <div class="notice-head">Stop revising content that won’t appear in your exam.</div>
      <div class="notice-body">
        <strong>FL4SH</strong> is the full AI-powered flashcard app built for UK qualifications. Pick your subject and exam board and revise cards mapped to the official specification
        (AQA, Pearson Edexcel, OCR, WJEC/Eduqas, CCEA and <strong>SQA</strong> National 5 / Higher / Advanced Higher).
        Create cards with AI, write them manually, or generate from an image — then study with spaced repetition, XP modes, and optional voice answers with AI feedback.
      </div>
      <div class="notice-foot">
        <strong>Lite limits:</strong> {{ props.limits.max_subjects }} subjects · {{ props.limits.max_cards_per_subject }} AI cards per subject (manual unlimited). ·
        <a :href="props.links.website" target="_blank" rel="noopener" @click="emit('website-click', 'header_notice')">Upgrade to full FL4SH → fl4shcards.com</a>
        ·
        <a
          :href="props.links.legacyKnackFlashcards"
          target="_blank"
          rel="noopener"
          @click="emit('website-click', 'legacy_knack_flashcards')"
        >Open your cards in legacy Knack version</a>
      </div>
    </div>

    <div class="notice-badges">
      <a :href="props.links.appStore" target="_blank" rel="noopener" class="store-badge" @click="emit('store-click', 'app_store')">
        <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" />
      </a>
      <a :href="props.links.playStore" target="_blank" rel="noopener" class="store-badge" @click="emit('store-click', 'play_store')">
        <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" />
      </a>
    </div>
  </section>
</template>
