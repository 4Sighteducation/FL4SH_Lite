export async function getLiteContext(callFn) {
  return callFn('fl4sh-lite-context')
}

export async function listLiteCards(callFn, subjectKey) {
  return callFn('fl4sh-lite-list-cards', { subject_key: subjectKey })
}

export async function getLiteTopicTree(callFn, subjectKey) {
  return callFn('fl4sh-lite-topic-tree', { subject_key: subjectKey })
}

export async function saveLiteSubjects(callFn, subjects) {
  return callFn('fl4sh-lite-select-subjects', { subjects })
}

export async function submitLiteReview(callFn, cardId, correct) {
  return callFn('fl4sh-lite-submit-review', { card_id: cardId, correct })
}

export async function createLiteCard(callFn, payload) {
  return callFn('fl4sh-lite-create-card', payload)
}

export async function generateLiteCards(callFn, payload) {
  return callFn('fl4sh-lite-generate-cards', payload)
}

export async function deleteLiteCard(callFn, cardId) {
  return callFn('fl4sh-lite-delete-card', { card_id: cardId })
}

export async function trackLiteUpsellEvent(callFn, eventType, placement, payload = {}) {
  return callFn('fl4sh-lite-upsell-event', {
    event_type: eventType,
    placement,
    payload,
  })
}
