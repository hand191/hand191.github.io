import {
  imageBlobToDataUrl,
  preparePastedImageBlob,
} from "./images.js?v=20260619-5";
import {
  countTodayDropEntries,
  deleteDropEntry,
  loadDropEntries,
  saveDropEntry,
  uploadDropImage,
} from "./dropStorage.js?v=20260619-5";

const MAX_DAILY_ENTRIES = 10;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const dropTextInput = document.querySelector("#dropTextInput");
const dropImageInput = document.querySelector("#dropImageInput");
const dropPreview = document.querySelector("#dropPreview");
const dropSubmitButton = document.querySelector("#dropSubmitButton");
const dropReloadButton = document.querySelector("#dropReloadButton");
const dropStatus = document.querySelector("#dropStatus");
const dropList = document.querySelector("#dropList");
const dropCount = document.querySelector("#dropCount");

let dropEntries = [];
let selectedImageBlob = null;
let selectedImageName = null;
let isSubmitting = false;

function setStatus(message, tone = "neutral") {
  dropStatus.textContent = message;
  dropStatus.dataset.tone = tone;
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDropTime(value) {
  const date = new Date(value);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${month}.${day} ${hours}:${minutes}`;
}

function updateSubmitState() {
  dropSubmitButton.disabled =
    isSubmitting || (!dropTextInput.value.trim() && !selectedImageBlob);
}

function clearSelectedImage() {
  selectedImageBlob = null;
  selectedImageName = null;
  dropImageInput.value = "";
  dropPreview.hidden = true;
  dropPreview.innerHTML = "";
  updateSubmitState();
}

async function setSelectedImage(file) {
  if (!file) {
    clearSelectedImage();
    return;
  }

  setStatus("正在处理图片...", "working");
  const imageBlob = await preparePastedImageBlob(file);

  if (imageBlob.size > MAX_IMAGE_BYTES) {
    clearSelectedImage();
    setStatus("图片太大，请控制在 2MB 内", "error");
    return;
  }

  selectedImageBlob = imageBlob;
  selectedImageName = file.name || "粘贴图片";

  const previewUrl = await imageBlobToDataUrl(imageBlob);
  dropPreview.innerHTML = "";

  const image = document.createElement("img");
  image.className = "drop-preview-image";
  image.src = previewUrl;
  image.alt = "待投递图片";

  const removeButton = document.createElement("button");
  removeButton.className = "drop-remove-image";
  removeButton.type = "button";
  removeButton.textContent = "移除图片";

  dropPreview.append(image, removeButton);
  dropPreview.hidden = false;
  setStatus("图片已准备", "success");
  updateSubmitState();
}

function getEntryCopyText(entry) {
  return [entry.contentText, entry.imageUrl].filter(Boolean).join("\n");
}

function renderDropEntries() {
  dropCount.textContent = `${dropEntries.length} 条`;
  dropList.innerHTML = "";

  if (!dropEntries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-records";
    empty.textContent = "还没有临时内容";
    dropList.append(empty);
    return;
  }

  for (const entry of dropEntries) {
    const card = document.createElement("article");
    card.className = "record-card drop-card";
    card.dataset.entryId = entry.id;

    const actions = document.createElement("div");
    actions.className = "drop-entry-actions";

    const copyButton = document.createElement("button");
    copyButton.className = "record-tool-button drop-copy-button";
    copyButton.type = "button";
    copyButton.textContent = "复制";

    const deleteButton = document.createElement("button");
    deleteButton.className = "record-tool-button drop-delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "删除";

    actions.append(copyButton, deleteButton);

    const content = document.createElement("div");
    content.className = "record-content drop-content";

    if (entry.contentText) {
      const text = document.createElement("p");
      text.textContent = entry.contentText;
      content.append(text);
    }

    if (entry.imageUrl) {
      const imageLink = document.createElement("a");
      imageLink.className = "drop-image-link";
      imageLink.href = entry.imageUrl;
      imageLink.target = "_blank";
      imageLink.rel = "noreferrer";
      imageLink.textContent = entry.imageName || "查看图片";
      content.append(imageLink);
    }

    const time = document.createElement("time");
    time.className = "record-time";
    time.dateTime = entry.createdAt;
    time.textContent = formatDropTime(entry.createdAt);

    card.append(actions, content, time);
    dropList.append(card);
  }
}

async function reloadDropEntries() {
  setStatus("正在重拉...", "working");
  dropReloadButton.disabled = true;

  try {
    dropEntries = await loadDropEntries();
    renderDropEntries();
    setStatus("已同步", "success");
  } catch (error) {
    setStatus(`同步失败：${error.message}`, "error");
    console.error(error);
  } finally {
    dropReloadButton.disabled = false;
  }
}

async function submitDropEntry() {
  if (isSubmitting) {
    return;
  }

  const contentText = dropTextInput.value.trim();

  if (!contentText && !selectedImageBlob) {
    return;
  }

  isSubmitting = true;
  updateSubmitState();
  setStatus("正在投递...", "working");

  try {
    const todayCount = await countTodayDropEntries();

    if (todayCount >= MAX_DAILY_ENTRIES) {
      setStatus("今天已经达到 10 条", "error");
      return;
    }

    const entryId = createId();
    let imageUrl = null;

    if (selectedImageBlob) {
      imageUrl = await uploadDropImage(selectedImageBlob, entryId);
    }

    const entry = {
      id: entryId,
      contentText,
      imageUrl,
      imageName: selectedImageName,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    await saveDropEntry(entry);
    dropEntries = [entry, ...dropEntries].slice(0, 10);
    dropTextInput.value = "";
    clearSelectedImage();
    renderDropEntries();
    setStatus("已投递", "success");
  } catch (error) {
    setStatus(`投递失败：${error.message}`, "error");
    console.error(error);
  } finally {
    isSubmitting = false;
    updateSubmitState();
  }
}

async function copyDropEntry(entryId) {
  const entry = dropEntries.find((currentEntry) => currentEntry.id === entryId);

  if (!entry) {
    return;
  }

  try {
    await navigator.clipboard.writeText(getEntryCopyText(entry));
    setStatus("已复制", "success");
  } catch (error) {
    setStatus("复制失败", "error");
    console.error(error);
  }
}

async function removeDropEntry(entryId) {
  setStatus("正在删除...", "working");

  try {
    await deleteDropEntry(entryId);
    dropEntries = dropEntries.filter((entry) => entry.id !== entryId);
    renderDropEntries();
    setStatus("已删除", "success");
  } catch (error) {
    setStatus(`删除失败：${error.message}`, "error");
    console.error(error);
  }
}

dropTextInput.addEventListener("input", updateSubmitState);

dropTextInput.addEventListener("paste", async (event) => {
  const images = [...event.clipboardData.items]
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);

  if (!images.length) {
    return;
  }

  event.preventDefault();

  try {
    await setSelectedImage(images[0]);
  } catch (error) {
    setStatus("图片处理失败", "error");
    console.error(error);
  }
});

dropImageInput.addEventListener("change", async () => {
  try {
    await setSelectedImage(dropImageInput.files[0]);
  } catch (error) {
    setStatus("图片处理失败", "error");
    console.error(error);
  }
});

dropPreview.addEventListener("click", (event) => {
  if (!event.target.closest(".drop-remove-image")) {
    return;
  }

  clearSelectedImage();
  setStatus("图片已移除", "success");
});

dropList.addEventListener("click", (event) => {
  const card = event.target.closest(".drop-card");

  if (!card) {
    return;
  }

  if (event.target.closest(".drop-copy-button")) {
    copyDropEntry(card.dataset.entryId);
    return;
  }

  if (event.target.closest(".drop-delete-button")) {
    removeDropEntry(card.dataset.entryId);
  }
});

dropSubmitButton.addEventListener("click", submitDropEntry);
dropReloadButton.addEventListener("click", reloadDropEntries);

updateSubmitState();
reloadDropEntries();
