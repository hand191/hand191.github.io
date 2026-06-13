export function isBlankHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const hasImage = Boolean(template.content.querySelector("img"));
  const text = template.content.textContent.trim();

  return !hasImage && !text;
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

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
