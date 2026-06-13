const DRAFT_KEY = "personal-entry-draft";
const LAST_SAVED_KEY = "personal-entry-last-saved";
const RECORDS_KEY = "personal-entry-records";

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

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(LAST_SAVED_KEY);
}

export function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function loadRecords() {
  const value = localStorage.getItem(RECORDS_KEY);

  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}
