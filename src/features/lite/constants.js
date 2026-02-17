export const examLevelChoices = [
  { label: 'All levels', values: [] },
  { label: 'GCSE', values: ['GCSE'] },
  { label: 'A Level', values: ['A_LEVEL', 'A-LEVEL', 'A Level'] },
  { label: 'International GCSE', values: ['INTERNATIONAL_GCSE', 'IGCSE', 'I_GCSE'] },
  { label: 'International A Level', values: ['INTERNATIONAL_A_LEVEL', 'IALEVEL', 'I_ALEVEL', 'I A_LEVEL'] },
  { label: 'Vocational Level 2', values: ['VOCATIONAL_L2', 'CAMBRIDGE_NATIONALS_L2'] },
  { label: 'Vocational Level 3', values: ['VOCATIONAL_L3', 'BTEC_NATIONALS_L3', 'CAMBRIDGE_TECHNICALS_L3'] },
  { label: 'National 5', values: ['NATIONAL_5'] },
  { label: 'Higher / Advanced Higher', values: ['HIGHER', 'ADVANCED_HIGHER', 'SQA_HIGHER'] },
]

// Used by the subject selection wizard (Manage modal)
export const courseTypeChoices = [
  { id: 'all', label: 'All course types', levels: ['All levels'] },
  { id: 'academic', label: 'Academic', levels: ['GCSE', 'A Level'] },
  { id: 'international', label: 'International', levels: ['International GCSE', 'International A Level'] },
  { id: 'vocational', label: 'Vocational', levels: ['Vocational Level 2', 'Vocational Level 3'] },
  { id: 'scotland', label: 'Scotland (SQA)', levels: ['National 5', 'Higher / Advanced Higher'] },
]

export const boxConfig = [
  { box: 1, title: 'New', interval: '1d' },
  { box: 2, title: 'Warm', interval: '2d' },
  { box: 3, title: 'Solid', interval: '4d' },
  { box: 4, title: 'Strong', interval: '7d' },
  { box: 5, title: 'Mastered', interval: '21d' },
]

export const SUBJECT_COLOR_FALLBACK = '#7c4dff'

// Curated theme choices (better UX than a raw color picker).
export const SUBJECT_THEME_COLORS = [
  '#7c4dff', '#3b82f6', '#22c55e', '#06b6d4', '#a78bfa', '#f97316',
  '#ef4444', '#f43f5e', '#e11d48', '#14b8a6', '#10b981', '#84cc16',
  '#eab308', '#f59e0b', '#fb7185', '#8b5cf6', '#0ea5e9', '#38bdf8',
  '#2dd4bf', '#34d399', '#4ade80', '#93c5fd', '#fca5a5', '#fda4af',
]

export const SUBJECT_THEME_GRADIENTS = [
  { id: 'aurora', label: 'Aurora', accent: '#00f5ff', gradient: 'linear-gradient(135deg, #00f5ff 0%, #7c4dff 55%, #ff006e 110%)' },
  { id: 'mint', label: 'Mint', accent: '#00ff88', gradient: 'linear-gradient(135deg, #00ff88 0%, #00f5ff 60%, #1e40af 130%)' },
  { id: 'sunset', label: 'Sunset', accent: '#ff6f75', gradient: 'linear-gradient(135deg, #ff6f75 0%, #fb7185 45%, #7c4dff 120%)' },
  { id: 'citrus', label: 'Citrus', accent: '#ffa944', gradient: 'linear-gradient(135deg, #ffa944 0%, #eab308 55%, #00f5ff 135%)' },
  { id: 'berry', label: 'Berry', accent: '#ff55b8', gradient: 'linear-gradient(135deg, #ff55b8 0%, #7c4dff 55%, #00f5ff 140%)' },
  { id: 'ocean', label: 'Ocean', accent: '#38bdf8', gradient: 'linear-gradient(135deg, #38bdf8 0%, #00f5ff 55%, #10b981 135%)' },
  { id: 'ember', label: 'Ember', accent: '#f97316', gradient: 'linear-gradient(135deg, #f97316 0%, #ef4444 52%, #7c4dff 132%)' },
  { id: 'violet', label: 'Violet', accent: '#a78bfa', gradient: 'linear-gradient(135deg, #a78bfa 0%, #7c4dff 60%, #00f5ff 140%)' },
]
