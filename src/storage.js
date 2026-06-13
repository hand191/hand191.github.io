const DRAFT_KEY = "personal-entry-draft";
const DRAFT_ID_KEY = "personal-entry-draft-id";
const LAST_SAVED_KEY = "personal-entry-last-saved";
const RECORDS_KEY = "personal-entry-records";

export function isStorageQuotaError(error) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function saveDraft(html) {
  localStorage.setItem(DRAFT_KEY, html);
  localStorage.setItem(LAST_SAVED_KEY, new Date().toISOString());
}

export function loadDraft() {
  return localStorage.getItem(DRAFT_KEY) || "";
}

export function loadOrCreateDraftId() {
  const draftId = localStorage.getItem(DRAFT_ID_KEY);

  if (draftId) {
    return draftId;
  }

  const nextDraftId = createId();
  localStorage.setItem(DRAFT_ID_KEY, nextDraftId);
  return nextDraftId;
}

export function loadLastSavedAt() {
  return localStorage.getItem(LAST_SAVED_KEY);
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(DRAFT_ID_KEY);
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

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
