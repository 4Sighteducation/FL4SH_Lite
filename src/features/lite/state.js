import { LITE_LIMITS } from '../../lib/api'

export function createInitialState() {
  return {
    loading: true,
    busy: false,
    error: '',
    user: null,
    limits: { ...LITE_LIMITS },
    availableSubjects: [],
    selectedSubjects: [],
    selectedSubjectKey: '',
    cards: [],
    showUpsell: false,
    upsellTitle: '',
    upsellMessage: '',
    studyIndex: 0,
    sessionReviewed: 0,
    sessionTotalDue: 0,
    revealAnswer: false,
    sessionDone: false,
    catalogWarning: '',
    showSubjectModal: false,
    topicTreeLoading: false,
    topicTreeError: '',
  }
}

export function createInitialCardModal() {
  return {
    open: false,
    flipped: false,
    showDetails: false,
    card: null,
    mcqOptions: [],
    selectedOption: '',
    correctOption: '',
    selectedCorrect: null,
  }
}
