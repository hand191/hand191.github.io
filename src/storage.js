const DRAFT_KEY = "personal-entry-draft";
const LAST_SAVED_KEY = "personal-entry-last-saved";

export function saveDraft(html) {
  localStorage.setItem(DRAFT_KEY, html);
  localStorage.setItem(LAST_SAVED_KEY, new Date().toISOString());
}

export function loadDraft() {
  return localStorage.getItem(DRAFT_KEY) || "";
}

export function loadLastSavedAt() {
  return localStorage.getItem(LAST_SAVED_KEY);
}
