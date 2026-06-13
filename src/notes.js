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

export function createRecord(contentHtml, id) {
  return {
    id,
    contentHtml,
    createdAt: new Date().toISOString(),
  };
}

export function addRecord(records, record) {
  const recordsById = new Map(records.map((currentRecord) => [
    currentRecord.id,
    currentRecord,
  ]));

  recordsById.set(record.id, record);

  return [record, ...recordsById.values()]
    .filter((currentRecord, index, allRecords) => {
      return allRecords.findIndex((item) => item.id === currentRecord.id) === index;
    })
    .sort(
      (recordA, recordB) =>
        new Date(recordB.createdAt) - new Date(recordA.createdAt)
    );
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
