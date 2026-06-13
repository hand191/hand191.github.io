export function isBlankHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const hasImage = Boolean(template.content.querySelector("img"));
  const text = template.content.textContent.trim();

  return !hasImage && !text;
}

export function createRecord(contentHtml) {
  return {
    id: crypto.randomUUID(),
    contentHtml,
    createdAt: new Date().toISOString(),
  };
}

export function addRecord(records, record) {
  return [record, ...records];
}
