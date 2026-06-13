import { debounce } from "./autosave.js?v=20260613-15";
import {
  createImageAttachment,
  imageBlobToDataUrl,
  preparePastedImageBlob,
} from "./images.js?v=20260613-15";
import {
  loadCloudRecords,
  saveCloudRecord,
  uploadCloudImage,
} from "./cloudStorage.js?v=20260613-15";
import {
  addRecord,
  cleanRecordHtml,
  createRecord,
  hasLocalEmbeddedImage,
  isBlankHtml,
  mergeRecords,
} from "./notes.js?v=20260613-15";
import {
  clearDraft,
  clearRecords,
  isStorageQuotaError,
  loadDraft,
  loadLastSavedAt,
  loadOrCreateDraftId,
  loadRecords,
  saveDraft,
  saveRecords,
} from "./storage.js?v=20260613-15";

const noteInput = document.querySelector("#noteInput");
const saveStatus = document.querySelector("#saveStatus");
const reloadButton = document.querySelector("#reloadButton");
const lastSaved = document.querySelector("#lastSaved");
const archiveButton = document.querySelector("#archiveButton");
const recordCount = document.querySelector("#recordCount");
const recordsList = document.querySelector("#recordsList");
const replyBanner = document.querySelector("#replyBanner");
const replyTargetText = document.querySelector("#replyTargetText");
const cancelReplyButton = document.querySelector("#cancelReplyButton");
let records = loadRecords();
let isProcessingPaste = false;
let isArchiving = false;
let replyParentId = null;
let editingRecordId = null;
let openReplyChainId = null;

function setStatus(message, tone = "neutral") {
  saveStatus.textContent = message;
  saveStatus.dataset.tone = tone;
}

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

function formatCompactRecordTime(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function getRecordSummary(record) {
  const container = document.createElement("div");
  container.innerHTML = record.contentHtml;

  container.querySelectorAll(".image-remove").forEach((button) => {
    button.remove();
  });

  const text = container.textContent.replace(/\s+/g, " ").trim();

  if (!text) {
    return "图片";
  }

  if (text.length <= 34) {
    return text;
  }

  return `${text.slice(0, 34)}...`;
}

function buildReplyChain(recordId) {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const chain = [];
  const visitedIds = new Set();
  let currentRecord = recordsById.get(recordId);

  while (currentRecord && !visitedIds.has(currentRecord.id)) {
    chain.unshift(currentRecord);
    visitedIds.add(currentRecord.id);
    currentRecord = recordsById.get(currentRecord.parentId);
  }

  return chain;
}

function createReplyChainPanel(recordId) {
  const chain = buildReplyChain(recordId);
  const panel = document.createElement("div");
  panel.className = "reply-chain-panel";

  if (chain.length <= 1) {
    panel.textContent = "这条记录前面没有回复链。";
    return panel;
  }

  for (const chainRecord of chain) {
    const item = document.createElement("div");
    item.className = "reply-chain-item";

    const time = document.createElement("span");
    time.className = "reply-chain-time";
    time.textContent = formatCompactRecordTime(chainRecord.createdAt);

    const summary = document.createElement("span");
    summary.className = "reply-chain-summary";
    summary.textContent = getRecordSummary(chainRecord);

    item.append(time, summary);
    panel.append(item);
  }

  return panel;
}

function createCommentsPanel(record) {
  const panel = document.createElement("div");
  panel.className = "comments-panel";

  const comments = record.comments || [];

  if (!comments.length) {
    const empty = document.createElement("div");
    empty.className = "empty-comments";
    empty.textContent = "还没有评论";
    panel.append(empty);
    return panel;
  }

  for (const comment of comments) {
    const item = document.createElement("div");
    item.className = "comment-item";

    const text = document.createElement("div");
    text.className = "comment-text";
    text.textContent = comment.text;

    const time = document.createElement("time");
    time.className = "comment-time";
    time.dateTime = comment.createdAt;
    time.textContent = formatCompactRecordTime(comment.createdAt);

    item.append(text, time);
    panel.append(item);
  }

  return panel;
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
    card.dataset.recordId = record.id;

    const time = document.createElement("time");
    time.className = "record-time";
    time.dateTime = record.createdAt;
    time.textContent = formatCompactRecordTime(record.createdAt);

    const toolbar = document.createElement("div");
    toolbar.className = "record-toolbar";

    const editButton = document.createElement("button");
    editButton.className = "record-tool-button edit-record-button";
    editButton.type = "button";
    editButton.textContent = "编辑";

    const moreActions = document.createElement("div");
    moreActions.className = "record-more-actions";

    const moreButton = document.createElement("button");
    moreButton.className = "record-tool-button more-button";
    moreButton.type = "button";
    moreButton.textContent = "⋯";

    const chainButton = document.createElement("button");
    chainButton.className = "record-tool-button reply-chain-button";
    chainButton.type = "button";
    chainButton.textContent = "查看回复链";

    const noteButton = document.createElement("button");
    noteButton.className = "record-tool-button note-button";
    noteButton.type = "button";
    noteButton.textContent = "评论";

    moreActions.append(moreButton, chainButton, noteButton);

    const actions = document.createElement("div");
    actions.className = "record-actions";

    const replyButton = document.createElement("button");
    replyButton.className = "reply-button";
    replyButton.type = "button";
    replyButton.textContent = "回复";

    actions.append(replyButton);
    toolbar.append(editButton, moreActions, actions);

    const parent = records.find((currentRecord) => {
      return currentRecord.id === record.parentId;
    });

    if (parent) {
      const replyMeta = document.createElement("div");
      replyMeta.className = "reply-meta";
      replyMeta.textContent = `回复：${getRecordSummary(parent)} · ${formatRecordTime(parent.createdAt)}`;
      card.append(replyMeta);
    }

    const content = document.createElement("div");
    content.className = "record-content";
    content.innerHTML = record.contentHtml;

    card.prepend(toolbar);
    card.append(content);

    if ((record.comments || []).length) {
      card.append(createCommentsPanel(record));
    }

    if (openReplyChainId === record.id) {
      card.append(createReplyChainPanel(record.id));
    }

    card.append(time);
    recordsList.append(card);
  }
}

function updateArchiveButton() {
  archiveButton.disabled = isArchiving || isBlankHtml(noteInput.innerHTML);
  archiveButton.textContent = editingRecordId ? "更新当前记录" : "归档当前内容";
}

function saveCurrentDraft() {
  saveDraft(noteInput.innerHTML);
  setStatus("已自动保存", "success");
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

async function prepareImageSource(imageFile) {
  const imageBlob = await preparePastedImageBlob(imageFile);

  try {
    const publicUrl = await uploadCloudImage(imageBlob, loadOrCreateDraftId());

    if (publicUrl) {
      setStatus("图片已上传", "success");
      return publicUrl;
    }
  } catch (error) {
    setStatus("图片云同步失败，已本机保存", "error");
    console.error(error);
  }

  return imageBlobToDataUrl(imageBlob);
}

function toggleImageAttachment(button) {
  const attachment = button.closest(".image-attachment");
  const image = attachment.querySelector(".image-preview");
  image.hidden = !image.hidden;
}

function removeImageAttachment(button) {
  const attachment = button.closest(".image-attachment");
  const nextNode = attachment.nextSibling;

  attachment.remove();

  if (nextNode?.nodeName === "BR") {
    nextNode.remove();
  }

  saveCurrentDraft();
}

function renderReplyState() {
  if (!replyParentId) {
    replyBanner.hidden = true;
    replyTargetText.textContent = "";
    return;
  }

  const parent = records.find((record) => record.id === replyParentId);
  const label = parent ? formatRecordTime(parent.createdAt) : "记录";

  replyTargetText.textContent = `正在回复 ${label}`;
  replyBanner.hidden = false;
}

function startReply(recordId) {
  replyParentId = recordId;
  renderReplyState();
  noteInput.focus();
  setStatus("正在回复一条记录", "working");
}

function cancelReply() {
  replyParentId = null;
  renderReplyState();
  setStatus("已取消回复", "success");
}

function startEdit(recordId) {
  const record = records.find((currentRecord) => currentRecord.id === recordId);

  if (!record) {
    return;
  }

  editingRecordId = record.id;
  replyParentId = record.parentId;
  noteInput.innerHTML = record.contentHtml;
  saveDraft(record.contentHtml);
  renderReplyState();
  updateArchiveButton();
  noteInput.focus();
  setStatus("正在编辑一条记录", "working");
}

async function addComment(recordId) {
  const record = records.find((currentRecord) => currentRecord.id === recordId);

  if (!record) {
    return;
  }

  const text = window.prompt("给这条记录添加评论");

  if (!text?.trim()) {
    return;
  }

  const nextRecord = {
    ...record,
    comments: [
      ...(record.comments || []),
      {
        id: crypto.randomUUID(),
        text: text.trim(),
        createdAt: new Date().toISOString(),
      },
    ],
  };
  const nextRecords = addRecord(records, nextRecord);

  try {
    await saveCloudRecord(nextRecord, {
      updateExisting: true,
      requireComments: true,
    });
    records = nextRecords;
    saveRecords(records);
    renderRecords();
    setStatus("评论已保存", "success");
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
  }
}

function toggleReplyChain(recordId) {
  openReplyChainId = openReplyChainId === recordId ? null : recordId;
  renderRecords();
  setStatus(openReplyChainId ? "已展开回复链" : "已收起回复链", "success");
}

const autosaveDraft = debounce(() => {
  try {
    saveCurrentDraft();
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
  }
}, 600);

function getSaveErrorMessage(error) {
  if (isStorageQuotaError(error)) {
    return "保存失败：内容太大";
  }

  if (error?.message) {
    return `保存失败：${error.message}`;
  }

  return "保存失败";
}

async function refreshCloudRecords() {
  try {
    const cloudRecords = await loadCloudRecords();

    if (!cloudRecords) {
      return;
    }

    records = mergeRecords(records, cloudRecords);
    saveRecords(records);
    renderRecords();
    setStatus("已同步", "success");
  } catch (error) {
    setStatus("同步失败，使用本机记录", "error");
    console.error(error);
  }
}

async function reloadFromCloud() {
  setStatus("正在重拉...", "working");
  reloadButton.disabled = true;

  try {
    const cloudRecords = await loadCloudRecords();

    if (!cloudRecords) {
      setStatus("未配置数据库", "error");
      return;
    }

    records = cloudRecords;
    replyParentId = null;
    editingRecordId = null;
    openReplyChainId = null;
    noteInput.innerHTML = "";
    clearDraft();
    clearRecords();
    saveRecords(records);
    renderLastSavedTime();
    renderReplyState();
    renderRecords();
    updateArchiveButton();
    setStatus("已从数据库重拉", "success");
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
  } finally {
    reloadButton.disabled = false;
  }
}

async function archiveCurrentContent() {
  if (isArchiving) {
    setStatus("正在归档，请稍等", "working");
    return;
  }

  const contentHtml = noteInput.innerHTML;

  if (isBlankHtml(contentHtml)) {
    return;
  }

  isArchiving = true;
  setStatus(editingRecordId ? "正在更新..." : "正在归档...", "working");
  updateArchiveButton();

  const wasEditing = Boolean(editingRecordId);
  const editedRecord = records.find((record) => record.id === editingRecordId);
  const recordId = editingRecordId || loadOrCreateDraftId();
  const nextRecord = wasEditing && editedRecord
    ? {
        ...editedRecord,
        contentHtml: cleanRecordHtml(contentHtml),
        parentId: replyParentId,
      }
    : createRecord(contentHtml, recordId, replyParentId);
  const nextRecords = addRecord(records, nextRecord);

  try {
    if (!hasLocalEmbeddedImage(contentHtml)) {
      await saveCloudRecord(nextRecord, { updateExisting: wasEditing });
    }

    saveRecords(nextRecords);
    clearDraft();
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
    isArchiving = false;
    updateArchiveButton();
    return;
  }

  records = nextRecords;
  replyParentId = null;
  editingRecordId = null;
  noteInput.innerHTML = "";
  setStatus(wasEditing ? "已更新并同步" : "已归档并同步", "success");
  renderLastSavedTime();
  renderRecords();
  renderReplyState();
  isArchiving = false;
  updateArchiveButton();
}

noteInput.innerHTML = loadDraft();
renderLastSavedTime();
renderRecords();
updateArchiveButton();
refreshCloudRecords();

noteInput.addEventListener("input", () => {
  setStatus("正在输入...", "working");
  updateArchiveButton();
  autosaveDraft();
});

noteInput.addEventListener("paste", async (event) => {
  const images = getPastedImageFiles(event);

  if (!images.length) {
    setStatus("正在输入...", "working");
    autosaveDraft();
    return;
  }

  event.preventDefault();

  if (isProcessingPaste) {
    setStatus("截图处理中，请稍等", "working");
    return;
  }

  isProcessingPaste = true;
  setStatus("正在上传截图...", "working");

  try {
    for (const imageFile of images) {
      const imageSource = await prepareImageSource(imageFile);
      insertNodeAtCursor(createImageAttachment(imageSource));
      insertNodeAtCursor(document.createElement("br"));
    }

    saveCurrentDraft();
  } catch (error) {
    setStatus("截图保存失败", "error");
    console.error(error);
  } finally {
    isProcessingPaste = false;
  }
});

noteInput.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".image-remove");

  if (removeButton) {
    removeImageAttachment(removeButton);
    return;
  }

  const toggleButton = event.target.closest(".image-toggle");

  if (!toggleButton) {
    return;
  }

  toggleImageAttachment(toggleButton);
});

noteInput.addEventListener("keydown", (event) => {
  if (!(event.metaKey && event.key === "Enter")) {
    return;
  }

  event.preventDefault();
  archiveCurrentContent();
});

recordsList.addEventListener("click", (event) => {
  const editButton = event.target.closest(".edit-record-button");

  if (editButton) {
    const card = editButton.closest(".record-card");
    startEdit(card.dataset.recordId);
    return;
  }

  const chainButton = event.target.closest(".reply-chain-button");

  if (chainButton) {
    const card = chainButton.closest(".record-card");
    toggleReplyChain(card.dataset.recordId);
    return;
  }

  const moreButton = event.target.closest(".more-button");

  if (moreButton) {
    setStatus("更多操作入口已就绪", "working");
    return;
  }

  const noteButton = event.target.closest(".note-button");

  if (noteButton) {
    const card = noteButton.closest(".record-card");
    addComment(card.dataset.recordId);
    return;
  }

  const replyButton = event.target.closest(".reply-button");

  if (replyButton) {
    const card = replyButton.closest(".record-card");
    startReply(card.dataset.recordId);
    return;
  }

  const toggleButton = event.target.closest(".image-toggle");

  if (!toggleButton) {
    return;
  }

  toggleImageAttachment(toggleButton);
});

cancelReplyButton.addEventListener("click", cancelReply);

reloadButton.addEventListener("click", reloadFromCloud);

archiveButton.addEventListener("click", archiveCurrentContent);
