import { debounce } from "./autosave.js";
import { createImageElement, preparePastedImage } from "./images.js";
import { loadDraft, loadLastSavedAt, saveDraft } from "./storage.js";

const noteInput = document.querySelector("#noteInput");
const saveStatus = document.querySelector("#saveStatus");
const lastSaved = document.querySelector("#lastSaved");

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

function saveCurrentDraft() {
  saveDraft(noteInput.innerHTML);
  saveStatus.textContent = "已自动保存";
  renderLastSavedTime();
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

const autosaveDraft = debounce(() => {
  saveCurrentDraft();
}, 600);

noteInput.innerHTML = loadDraft();
renderLastSavedTime();

noteInput.addEventListener("input", () => {
  saveStatus.textContent = "正在输入...";
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
      insertNodeAtCursor(createImageElement(imageDataUrl));
      insertNodeAtCursor(document.createElement("br"));
    }

    saveCurrentDraft();
  } catch (error) {
    saveStatus.textContent = "截图保存失败";
    console.error(error);
  }
});
