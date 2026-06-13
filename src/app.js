import { debounce } from "./autosave.js";
import { createImageAttachment, preparePastedImage } from "./images.js";
import { addRecord, createRecord, isBlankHtml } from "./notes.js";
import {
  clearDraft,
  loadDraft,
  loadLastSavedAt,
  loadRecords,
  saveDraft,
  saveRecords,
} from "./storage.js";

const noteInput = document.querySelector("#noteInput");
const saveStatus = document.querySelector("#saveStatus");
const lastSaved = document.querySelector("#lastSaved");
const archiveButton = document.querySelector("#archiveButton");
const recordCount = document.querySelector("#recordCount");
const recordsList = document.querySelector("#recordsList");
let records = loadRecords();

function formatSavedTime(value) {
  if (!value) {
    return "尚未保存";
  }

  const date = new Date(value);

  return `上次保存：${date.toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function renderLastSavedTime() {
  lastSaved.textContent = formatSavedTime(loadLastSavedAt());
}

function formatRecordTime(value) {
  return new Date(value).toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderRecords() {
  recordCount.textContent = `${records.length} 条`;
  recordsList.innerHTML = "";

  if (!records.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-records";
    emptyState.textContent = "还没有归档记录";
    recordsList.append(emptyState);
    return;
  }

  for (const record of records) {
    const card = document.createElement("article");
    card.className = "record-card";

    const time = document.createElement("time");
    time.dateTime = record.createdAt;
    time.textContent = formatRecordTime(record.createdAt);

    const content = document.createElement("div");
    content.className = "record-content";
    content.innerHTML = record.contentHtml;

    card.append(time, content);
    recordsList.append(card);
  }
}

function updateArchiveButton() {
  archiveButton.disabled = isBlankHtml(noteInput.innerHTML);
}

function saveCurrentDraft() {
  saveDraft(noteInput.innerHTML);
  saveStatus.textContent = "已自动保存";
  renderLastSavedTime();
  updateArchiveButton();
}

function moveCursorAfter(node) {
  const range = document.createRange();
  const selection = window.getSelection();

  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertNodeAtCursor(node) {
  const selection = window.getSelection();

  if (!selection.rangeCount) {
    noteInput.append(node);
    moveCursorAfter(node);
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  moveCursorAfter(node);
}

function getPastedImageFiles(event) {
  return [...event.clipboardData.items]
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

function toggleImageAttachment(button) {
  const attachment = button.closest(".image-attachment");
  const image = attachment.querySelector(".image-preview");
  image.hidden = !image.hidden;
}

const autosaveDraft = debounce(() => {
  saveCurrentDraft();
}, 600);

noteInput.innerHTML = loadDraft();
renderLastSavedTime();
renderRecords();
updateArchiveButton();

noteInput.addEventListener("input", () => {
  saveStatus.textContent = "正在输入...";
  updateArchiveButton();
  autosaveDraft();
});

noteInput.addEventListener("paste", async (event) => {
  const images = getPastedImageFiles(event);

  if (!images.length) {
    saveStatus.textContent = "正在输入...";
    autosaveDraft();
    return;
  }

  event.preventDefault();
  saveStatus.textContent = "正在处理截图...";

  try {
    for (const imageFile of images) {
      const imageDataUrl = await preparePastedImage(imageFile);
      insertNodeAtCursor(createImageAttachment(imageDataUrl));
      insertNodeAtCursor(document.createElement("br"));
    }

    saveCurrentDraft();
  } catch (error) {
    saveStatus.textContent = "截图保存失败";
    console.error(error);
  }
});

noteInput.addEventListener("click", (event) => {
  const toggleButton = event.target.closest(".image-toggle");

  if (!toggleButton) {
    return;
  }

  toggleImageAttachment(toggleButton);
});

recordsList.addEventListener("click", (event) => {
  const toggleButton = event.target.closest(".image-toggle");

  if (!toggleButton) {
    return;
  }

  toggleImageAttachment(toggleButton);
});

archiveButton.addEventListener("click", () => {
  const contentHtml = noteInput.innerHTML;

  if (isBlankHtml(contentHtml)) {
    return;
  }

  records = addRecord(records, createRecord(contentHtml));
  saveRecords(records);
  clearDraft();

  noteInput.innerHTML = "";
  saveStatus.textContent = "已归档";
  renderLastSavedTime();
  renderRecords();
  updateArchiveButton();
});
