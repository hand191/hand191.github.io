export function isBlankHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const hasImage = Boolean(template.content.querySelector("img"));
  const text = template.content.textContent.trim();

  return !hasImage && !text;
}

export function hasLocalEmbeddedImage(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  return [...template.content.querySelectorAll("img")].some((image) => {
    return image.src.startsWith("data:");
  });
}

export function cleanRecordHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  for (const button of template.content.querySelectorAll(".image-remove")) {
    button.remove();
  }

  return template.innerHTML;
}

export function createRecord(contentHtml, id, parentId = null) {
  return {
    id,
    parentId,
    contentHtml: cleanRecordHtml(contentHtml),
    createdAt: new Date().toISOString(),
    comments: [],
    authorId: null,
    authorColor: null,
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
