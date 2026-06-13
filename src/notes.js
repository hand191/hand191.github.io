export function isBlankHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const hasImage = Boolean(template.content.querySelector("img"));
  const text = template.content.textContent.trim();

  return !hasImage && !text;
}

export function hasEmbeddedImage(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  return Boolean(template.content.querySelector("img"));
}

export function createRecord(contentHtml) {
  return {
    id: createId(),
    contentHtml,
    createdAt: new Date().toISOString(),
  };
}

export function addRecord(records, record) {
  return [record, ...records];
}

export function mergeRecords(localRecords, cloudRecords) {
  const recordsById = new Map();

  for (const record of [...localRecords, ...cloudRecords]) {
    recordsById.set(record.id, record);
  }

  return [...recordsById.values()].sort(
    (recordA, recordB) => new Date(recordB.createdAt) - new Date(recordA.createdAt)
  );
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
