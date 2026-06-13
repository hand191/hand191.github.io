import { debounce } from "./autosave.js";
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

const autosaveDraft = debounce(() => {
  saveDraft(noteInput.value);
  saveStatus.textContent = "已自动保存";
  renderLastSavedTime();
}, 600);

noteInput.value = loadDraft();
renderLastSavedTime();

noteInput.addEventListener("input", () => {
  saveStatus.textContent = "正在输入...";
  autosaveDraft();
});
