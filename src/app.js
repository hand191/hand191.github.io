import { debounce } from "./autosave.js?v=20260620-1";
import {
  AUTHORS,
  getAuthor,
  getRecordAuthorColor,
} from "./authors.js?v=20260620-1";
import {
  createImageAttachment,
  imageBlobToDataUrl,
  preparePastedImageBlob,
} from "./images.js?v=20260620-1";
import {
  deleteCloudRecord,
  deleteCloudLink,
  loadCloudRecords,
  saveCloudComment,
  saveCloudLink,
  saveCloudRecord,
  uploadCloudImage,
} from "./cloudStorage.js?v=20260620-1";
import { FAMILY_ACCESS_CODE } from "./supabaseConfig.js?v=20260620-1";
import {
  addRecord,
  cleanRecordHtml,
  createRecord,
  hasLocalEmbeddedImage,
  isBlankHtml,
  mergeRecords,
} from "./notes.js?v=20260620-1";
import {
  clearDraft,
  clearRecords,
  isStorageQuotaError,
  loadDraft,
  loadLastSavedAt,
  loadOrCreateDraftId,
  loadRecords,
  loadSelectedAuthor,
  saveDraft,
  saveRecords,
  saveSelectedAuthor,
} from "./storage.js?v=20260620-1";

const noteInput = document.querySelector("#noteInput");
const accessGate = document.querySelector("#accessGate");
const accessForm = document.querySelector("#accessForm");
const accessCodeInput = document.querySelector("#accessCodeInput");
const accessError = document.querySelector("#accessError");
const familyApp = document.querySelector("#familyApp");
const saveStatus = document.querySelector("#saveStatus");
const reloadButton = document.querySelector("#reloadButton");
const roleButtons = document.querySelectorAll(".role-button");
const lastSaved = document.querySelector("#lastSaved");
const archiveButton = document.querySelector("#archiveButton");
const recordCount = document.querySelector("#recordCount");
const hiddenOnlyButton = document.querySelector("#hiddenOnlyButton");
const recordsList = document.querySelector("#recordsList");
const replyBanner = document.querySelector("#replyBanner");
const replyTargetText = document.querySelector("#replyTargetText");
const cancelReplyButton = document.querySelector("#cancelReplyButton");
let records = [];
let isProcessingPaste = false;
let isArchiving = false;
let replyParentId = null;
let editingRecordId = null;
let openReplyChainId = null;
let openCommentFormId = null;
let openLinksPanelId = null;
let openMoreActionsId = null;
let linkingSourceId = null;
let selectedAuthorId = loadSelectedAuthor();
let isAppStarted = false;
const ACCESS_GRANTED_KEY = "family-entry-access-granted";
const ADVANCED_GRANTED_KEY = "family-advanced-enabled";
const ADVANCED_COMMAND_PREFIX = "/admin";
let isAdvancedMode = localStorage.getItem(ADVANCED_GRANTED_KEY) === "true";
let showHiddenOnly = false;

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

function createClientId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeLinkPair(sourceEntryId, targetEntryId) {
  return [sourceEntryId, targetEntryId].sort();
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function getRecordById(recordId) {
  return records.find((record) => record.id === recordId);
}

function getLinkedRecordId(link, recordId) {
  return link.sourceEntryId === recordId ? link.targetEntryId : link.sourceEntryId;
}

function hasLinkBetween(sourceEntryId, targetEntryId) {
  return records.some((record) => {
    return (record.links || []).some((link) => {
      return (
        (link.sourceEntryId === sourceEntryId && link.targetEntryId === targetEntryId) ||
        (link.sourceEntryId === targetEntryId && link.targetEntryId === sourceEntryId)
      );
    });
  });
}

function getSelectedAuthor() {
  return getAuthor(selectedAuthorId);
}

function renderRoleSwitch() {
  const selectedAuthor = getSelectedAuthor();

  roleButtons.forEach((button) => {
    const isActive = button.dataset.authorId === selectedAuthor.id;
    button.classList.toggle("role-button-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function selectAuthor(authorId) {
  selectedAuthorId = AUTHORS[authorId] ? authorId : "yingjun";
  saveSelectedAuthor(selectedAuthorId);
  renderRoleSwitch();
  setStatus(`当前用户：${getSelectedAuthor().label}`, "success");
}

function getVisibleRecords() {
  if (isAdvancedMode && showHiddenOnly) {
    return records.filter((record) => record.isHidden);
  }

  if (isAdvancedMode) {
    return records;
  }

  return records.filter((record) => !record.isHidden);
}

function renderAdvancedControls() {
  hiddenOnlyButton.hidden = !isAdvancedMode;
  hiddenOnlyButton.classList.toggle("hidden-only-button-active", showHiddenOnly);
  hiddenOnlyButton.setAttribute("aria-pressed", String(showHiddenOnly));
  hiddenOnlyButton.textContent = showHiddenOnly ? "显示全部" : "只看隐藏";
}

function setAdvancedMode(isEnabled) {
  isAdvancedMode = isEnabled;
  showHiddenOnly = false;

  if (isAdvancedMode) {
    localStorage.setItem(ADVANCED_GRANTED_KEY, "true");
  } else {
    localStorage.removeItem(ADVANCED_GRANTED_KEY);
  }

  renderAdvancedControls();
  renderRecords();
  setStatus(isAdvancedMode ? "高级模式已打开" : "高级模式已关闭", "success");
}

function getPlainInputText() {
  return noteInput.textContent.replace(/\s+/g, " ").trim();
}

function clearCommandInput() {
  noteInput.innerHTML = "";
  clearDraft();
  renderLastSavedTime();
  updateArchiveButton();
}

function handleAdvancedCommand() {
  const text = getPlainInputText();

  if (!text.startsWith(ADVANCED_COMMAND_PREFIX)) {
    return false;
  }

  if (text === ADVANCED_COMMAND_PREFIX) {
    clearCommandInput();
    setAdvancedMode(true);
    return true;
  }

  if (text === `${ADVANCED_COMMAND_PREFIX} off`) {
    clearCommandInput();
    setAdvancedMode(false);
    return true;
  }

  setStatus("高级指令不正确", "error");
  return true;
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
    const commentColor = getRecordAuthorColor({
      authorId: comment.authorId,
      authorColor: comment.authorColor,
    });

    if (commentColor) {
      item.classList.add("comment-item-with-author");
      item.style.setProperty("--comment-author-color", commentColor);
    }

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

function createCommentForm(record) {
  const form = document.createElement("form");
  form.className = "comment-form";
  form.dataset.recordId = record.id;

  const textarea = document.createElement("textarea");
  textarea.className = "comment-input";
  textarea.name = "comment";
  textarea.rows = 3;
  textarea.placeholder = "写一条评论...";

  const actions = document.createElement("div");
  actions.className = "comment-form-actions";

  const cancelButton = document.createElement("button");
  cancelButton.className = "comment-cancel-button";
  cancelButton.type = "button";
  cancelButton.textContent = "取消";

  const submitButton = document.createElement("button");
  submitButton.className = "comment-submit-button";
  submitButton.type = "submit";
  submitButton.textContent = "保存评论";

  actions.append(cancelButton, submitButton);
  form.append(textarea, actions);

  return form;
}

function createLinksPanel(record) {
  const panel = document.createElement("div");
  panel.className = "links-panel";
  const links = record.links || [];

  if (!links.length) {
    panel.textContent = "还没有关联记录。";
    return panel;
  }

  const title = document.createElement("div");
  title.className = "links-panel-title";
  title.textContent = "关联记录";
  panel.append(title);

  for (const link of links) {
    const linkedRecordId = getLinkedRecordId(link, record.id);
    const linkedRecord = getRecordById(linkedRecordId);
    const item = document.createElement("div");
    item.className = "link-item";

    const summary = document.createElement("span");
    summary.className = "link-summary";
    summary.textContent = linkedRecord
      ? `${getRecordSummary(linkedRecord)} · ${formatCompactRecordTime(linkedRecord.createdAt)}`
      : "关联记录已删除";

    const removeButton = document.createElement("button");
    removeButton.className = "link-remove-button";
    removeButton.type = "button";
    removeButton.dataset.linkId = link.id;
    removeButton.textContent = "移除";

    item.append(summary, removeButton);
    panel.append(item);
  }

  return panel;
}

function createMoreActionsPanel(record) {
  const panel = document.createElement("form");
  panel.className = "more-actions-panel";
  panel.dataset.recordId = record.id;

  const input = document.createElement("input");
  input.className = "marker-input";
  input.name = "marker";
  input.placeholder = "1️⃣ 2️⃣ 3️⃣ 🚩";
  input.value = record.entryMarker || "";

  const saveButton = document.createElement("button");
  saveButton.className = "marker-save-button";
  saveButton.type = "submit";
  saveButton.textContent = "保存图标";

  const clearButton = document.createElement("button");
  clearButton.className = "marker-clear-button";
  clearButton.type = "button";
  clearButton.textContent = "清除图标";

  const deleteButton = document.createElement("button");
  deleteButton.className = "marker-delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "删除";

  const linkButton = document.createElement("button");
  linkButton.className = "marker-link-button";
  linkButton.type = "button";
  linkButton.textContent = "关联";

  panel.append(input, saveButton, clearButton, linkButton, deleteButton);

  if (isAdvancedMode) {
    const hiddenButton = document.createElement("button");
    hiddenButton.className = "marker-hide-button";
    hiddenButton.type = "button";
    hiddenButton.textContent = record.isHidden ? "取消隐藏" : "隐藏";
    panel.append(hiddenButton);
  }

  return panel;
}

function renderRecords() {
  const visibleRecords = getVisibleRecords();
  recordCount.textContent = `${visibleRecords.length} 条`;
  recordsList.innerHTML = "";
  renderAdvancedControls();

  if (!visibleRecords.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-records";
    emptyState.textContent = showHiddenOnly ? "还没有隐藏记录" : "还没有归档记录";
    recordsList.append(emptyState);
    return;
  }

  for (const record of visibleRecords) {
    const card = document.createElement("article");
    card.className = "record-card";
    card.dataset.recordId = record.id;

    if (record.isHidden) {
      card.classList.add("record-card-hidden");
    }

    if (linkingSourceId === record.id) {
      card.classList.add("record-card-linking");
    }

    const authorBorderColor = getRecordAuthorColor(record);

    if (authorBorderColor) {
      card.classList.add("record-card-with-author");
      card.style.setProperty("--author-color", authorBorderColor);

      const selectedAuthor = getSelectedAuthor();
      const isSelectedAuthorRecord = record.authorId
        ? getAuthor(record.authorId).id === selectedAuthor.id
        : record.authorColor === selectedAuthor.color;

      if (isSelectedAuthorRecord) {
        card.classList.add("record-card-own");
      } else {
        card.classList.add("record-card-other");
      }
    }

    const time = document.createElement("time");
    time.className = "record-time";
    time.dateTime = record.createdAt;
    time.textContent = formatCompactRecordTime(record.createdAt);

    const toolbar = document.createElement("div");
    toolbar.className = "record-toolbar";

    const leadingTools = document.createElement("div");
    leadingTools.className = "record-leading-tools";

    const moreActions = document.createElement("div");
    moreActions.className = "record-more-actions";

    const moreButton = document.createElement("button");
    moreButton.className = "record-tool-button more-button";
    moreButton.type = "button";
    moreButton.textContent = "⋯";

    const chainButton = document.createElement("button");
    chainButton.className = "record-tool-button reply-chain-button";
    chainButton.type = "button";
    chainButton.textContent = isMobileViewport() ? "查看回复" : "查看回复链";

    const noteButton = document.createElement("button");
    noteButton.className = "record-tool-button note-button";
    noteButton.type = "button";
    noteButton.textContent = "评论";

    const todoButton = document.createElement("button");
    todoButton.className = "record-tool-button todo-button";
    todoButton.type = "button";
    todoButton.textContent = record.isTodo ? "待办中" : "待办";

    moreActions.append(moreButton, chainButton, noteButton, todoButton);

    const actions = document.createElement("div");
    actions.className = "record-actions";

    const replyButton = document.createElement("button");
    replyButton.className = "reply-button";
    replyButton.type = "button";
    replyButton.textContent = "回复";

    actions.append(replyButton);
    toolbar.append(moreActions, actions);

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

    if (record.isTodo) {
      card.classList.add("record-card-todo");

      if (record.todoDone) {
        card.classList.add("record-card-todo-done");
      }

      const todoToggle = document.createElement("button");
      todoToggle.className = "todo-toggle";
      todoToggle.type = "button";
      todoToggle.setAttribute("aria-pressed", String(Boolean(record.todoDone)));
      todoToggle.textContent = record.todoDone ? "✓" : "";
      leadingTools.append(todoToggle);
    }

    if (record.entryMarker) {
      card.classList.add("record-card-marked");

      const marker = document.createElement("span");
      marker.className = "entry-marker";
      marker.textContent = record.entryMarker;
      leadingTools.append(marker);
    }

    if ((record.links || []).length) {
      const linksButton = document.createElement("button");
      linksButton.className = "record-links-button";
      linksButton.type = "button";
      linksButton.textContent = `关联 ${record.links.length}`;
      leadingTools.append(linksButton);
    }

    card.prepend(toolbar);

    if (leadingTools.childElementCount) {
      card.append(leadingTools);
    }

    card.append(content);

    if (linkingSourceId && linkingSourceId !== record.id) {
      const linkTargetButton = document.createElement("button");
      linkTargetButton.className = "link-target-button";
      linkTargetButton.type = "button";
      linkTargetButton.textContent = "选为关联";
      card.append(linkTargetButton);
    }

    if ((record.comments || []).length) {
      card.append(createCommentsPanel(record));
    }

    if (openCommentFormId === record.id) {
      card.append(createCommentForm(record));
    }

    if (openReplyChainId === record.id) {
      card.append(createReplyChainPanel(record.id));
    }

    if (openLinksPanelId === record.id) {
      card.append(createLinksPanel(record));
    }

    if (openMoreActionsId === record.id) {
      card.append(createMoreActionsPanel(record));
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
  const textarea = recordsList.querySelector(".comment-input");
  const text = textarea?.value;
  const record = records.find((currentRecord) => currentRecord.id === recordId);

  if (!record) {
    return;
  }

  if (!text?.trim()) {
    setStatus("评论不能为空", "error");
    return;
  }

  const selectedAuthor = getSelectedAuthor();
  const nextComment = {
    id: createClientId(),
    entryId: record.id,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    authorId: selectedAuthor.id,
    authorColor: selectedAuthor.color,
  };
  const nextRecord = {
    ...record,
    comments: [
      ...(record.comments || []),
      nextComment,
    ],
  };
  const nextRecords = addRecord(records, nextRecord);

  try {
    await saveCloudComment(nextComment);
    records = nextRecords;
    openCommentFormId = null;
    saveRecords(records);
    renderRecords();
    setStatus("评论已保存", "success");
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
  }
}

async function updateRecordTodo(recordId, nextTodoState) {
  const record = records.find((currentRecord) => currentRecord.id === recordId);

  if (!record) {
    return;
  }

  const nextRecord = {
    ...record,
    ...nextTodoState,
  };
  const nextRecords = addRecord(records, nextRecord);

  try {
    await saveCloudRecord(nextRecord, {
      updateExisting: true,
      requireTodo: true,
    });
    records = nextRecords;
    saveRecords(records);
    renderRecords();
    setStatus(
      !nextRecord.isTodo
        ? "待办已取消"
        : nextRecord.todoDone
          ? "待办已完成"
          : "待办已更新",
      "success"
    );
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
  }
}

async function updateRecordMarker(recordId, entryMarker) {
  const record = records.find((currentRecord) => currentRecord.id === recordId);

  if (!record) {
    return;
  }

  const nextRecord = {
    ...record,
    entryMarker,
  };
  const nextRecords = addRecord(records, nextRecord);

  try {
    await saveCloudRecord(nextRecord, {
      updateExisting: true,
      requireMarker: true,
    });
    records = nextRecords;
    openMoreActionsId = null;
    saveRecords(records);
    renderRecords();
    setStatus(entryMarker ? "图标已保存" : "图标已清除", "success");
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
  }
}

async function updateRecordHidden(recordId, isHidden) {
  const record = records.find((currentRecord) => currentRecord.id === recordId);

  if (!record) {
    return;
  }

  const nextRecord = {
    ...record,
    isHidden,
  };
  const nextRecords = addRecord(records, nextRecord);

  try {
    await saveCloudRecord(nextRecord, {
      updateExisting: true,
      requireHidden: true,
    });
    records = nextRecords;
    openMoreActionsId = null;
    saveRecords(records);
    renderRecords();
    setStatus(isHidden ? "已隐藏" : "已取消隐藏", "success");
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
  }
}

async function removeRecord(recordId) {
  const record = records.find((currentRecord) => currentRecord.id === recordId);

  if (!record) {
    return;
  }

  const confirmed = window.confirm(`确定删除：${getRecordSummary(record)}？`);

  if (!confirmed) {
    return;
  }

  try {
    await deleteCloudRecord(recordId);
    records = records
      .filter((currentRecord) => currentRecord.id !== recordId)
      .map((currentRecord) => ({
        ...currentRecord,
        links: (currentRecord.links || []).filter((link) => {
          return link.sourceEntryId !== recordId && link.targetEntryId !== recordId;
        }),
      }));
    openMoreActionsId = null;
    saveRecords(records);
    renderRecords();
    setStatus("已删除", "success");
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
  }
}

function startLinking(recordId) {
  linkingSourceId = recordId;
  openMoreActionsId = null;
  renderRecords();
  setStatus("请选择要关联的另一条记录", "working");
}

async function createRecordLink(targetRecordId) {
  if (!linkingSourceId) {
    return false;
  }

  if (linkingSourceId === targetRecordId) {
    linkingSourceId = null;
    setStatus("不能关联自己", "error");
    renderRecords();
    return true;
  }

  if (hasLinkBetween(linkingSourceId, targetRecordId)) {
    linkingSourceId = null;
    setStatus("这两条已经关联过", "success");
    renderRecords();
    return true;
  }

  const [sourceEntryId, targetEntryId] = normalizeLinkPair(
    linkingSourceId,
    targetRecordId
  );
  const link = {
    id: createClientId(),
    sourceEntryId,
    targetEntryId,
    createdAt: new Date().toISOString(),
  };
  const nextRecords = records.map((record) => {
    if (record.id !== sourceEntryId && record.id !== targetEntryId) {
      return record;
    }

    return {
      ...record,
      links: [...(record.links || []), link],
    };
  });

  records = nextRecords;
  linkingSourceId = null;
  openLinksPanelId = sourceEntryId;
  saveRecords(records);
  renderRecords();
  setStatus("关联已保存，正在同步...", "working");

  try {
    await saveCloudLink(link);
    setStatus("关联已保存并同步", "success");
  } catch (error) {
    setStatus(`关联已保存到本机，云同步失败：${getSaveErrorMessage(error)}`, "error");
    console.error(error);
  }

  return true;
}

async function removeRecordLink(linkId) {
  try {
    await deleteCloudLink(linkId);
    records = records.map((record) => ({
      ...record,
      links: (record.links || []).filter((link) => link.id !== linkId),
    }));
    saveRecords(records);
    renderRecords();
    setStatus("关联已移除", "success");
  } catch (error) {
    setStatus(getSaveErrorMessage(error), "error");
    console.error(error);
  }
}

function toggleRecordTodo(recordId) {
  const record = records.find((currentRecord) => currentRecord.id === recordId);

  if (!record) {
    return;
  }

  updateRecordTodo(recordId, {
    isTodo: !record.isTodo,
    todoDone: false,
  });
}

function toggleTodoDone(recordId) {
  const record = records.find((currentRecord) => currentRecord.id === recordId);

  if (!record) {
    return;
  }

  updateRecordTodo(recordId, {
    isTodo: true,
    todoDone: !record.todoDone,
  });
}

function toggleCommentForm(recordId) {
  openCommentFormId = openCommentFormId === recordId ? null : recordId;
  renderRecords();
  setStatus(openCommentFormId ? "正在添加评论" : "已取消评论", "success");

  if (openCommentFormId) {
    recordsList.querySelector(".comment-input")?.focus();
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

  if (
    error?.message?.includes("row-level security") ||
    error?.message?.includes("violates row-level security")
  ) {
    return "保存失败：数据库 RLS 没允许这个操作";
  }

  if (
    error?.code === "42P01" ||
    error?.message?.includes("relation") ||
    error?.message?.includes("Could not find the table")
  ) {
    return "保存失败：数据库缺少对应表";
  }

  if (
    error?.message?.includes("schema cache") ||
    error?.message?.includes("Could not find")
  ) {
    return "保存失败：数据库字段或缓存未刷新";
  }

  if (error?.message?.includes("entry_comments")) {
    return "保存失败：数据库缺少 entry_comments 表";
  }

  if (error?.message?.includes("entry_links")) {
    return `保存失败：${error.message}`;
  }

  if (error?.message?.includes("todo")) {
    return "保存失败：数据库缺少待办字段";
  }

  if (error?.message?.includes("entry_marker")) {
    return "保存失败：数据库缺少图标字段";
  }

  if (error?.message?.includes("is_hidden")) {
    return "保存失败：数据库缺少隐藏字段";
  }

  if (error?.message?.includes("update policy")) {
    return "保存失败：数据库没有允许更新";
  }

  if (error?.message?.includes("delete policy")) {
    return "删除失败：数据库没有允许删除";
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
    openLinksPanelId = null;
    openCommentFormId = null;
    openMoreActionsId = null;
    linkingSourceId = null;
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

  if (handleAdvancedCommand()) {
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

  if (!wasEditing) {
    const selectedAuthor = getSelectedAuthor();
    nextRecord.authorId = selectedAuthor.id;
    nextRecord.authorColor = selectedAuthor.color;
  }

  const nextRecords = addRecord(records, nextRecord);

  try {
    if (!hasLocalEmbeddedImage(contentHtml)) {
      await saveCloudRecord(nextRecord, {
        updateExisting: wasEditing,
        requireAuthor: Boolean(nextRecord.authorId || nextRecord.authorColor),
      });
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

function isAccessGranted() {
  return localStorage.getItem(ACCESS_GRANTED_KEY) === "true";
}

function showFamilyApp() {
  accessGate.hidden = true;
  familyApp.hidden = false;
}

function startApp() {
  if (isAppStarted) {
    return;
  }

  isAppStarted = true;
  records = loadRecords();
  noteInput.innerHTML = loadDraft();
  renderRoleSwitch();
  renderLastSavedTime();
  renderRecords();
  updateArchiveButton();
  refreshCloudRecords();
}

function unlockFamilyApp() {
  localStorage.setItem(ACCESS_GRANTED_KEY, "true");
  showFamilyApp();
  startApp();
}

function handleAccessSubmit(event) {
  event.preventDefault();

  if (accessCodeInput.value.trim() !== FAMILY_ACCESS_CODE) {
    accessError.hidden = false;
    accessCodeInput.select();
    return;
  }

  accessError.hidden = true;
  unlockFamilyApp();
}

if (isAccessGranted()) {
  unlockFamilyApp();
} else {
  familyApp.hidden = true;
  accessGate.hidden = false;
  accessCodeInput.focus();
}

noteInput.addEventListener("input", () => {
  if (handleAdvancedCommand()) {
    return;
  }

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
  const linkTargetButton = event.target.closest(".link-target-button");

  if (linkTargetButton) {
    const card = linkTargetButton.closest(".record-card");
    createRecordLink(card.dataset.recordId);
    return;
  }

  const linkRemoveButton = event.target.closest(".link-remove-button");

  if (linkRemoveButton) {
    removeRecordLink(linkRemoveButton.dataset.linkId);
    return;
  }

  const linksButton = event.target.closest(".record-links-button");

  if (linksButton) {
    const card = linksButton.closest(".record-card");
    openLinksPanelId = openLinksPanelId === card.dataset.recordId
      ? null
      : card.dataset.recordId;
    renderRecords();
    setStatus(openLinksPanelId ? "已展开关联" : "已收起关联", "success");
    return;
  }

  const commentCancelButton = event.target.closest(".comment-cancel-button");

  if (commentCancelButton) {
    openCommentFormId = null;
    renderRecords();
    setStatus("已取消评论", "success");
    return;
  }

  const cardForLinking = event.target.closest(".record-card");

  if (
    linkingSourceId &&
    cardForLinking &&
    !event.target.closest("button") &&
    !event.target.closest("a")
  ) {
    createRecordLink(cardForLinking.dataset.recordId);
    return;
  }

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
    const card = moreButton.closest(".record-card");
    openMoreActionsId = openMoreActionsId === card.dataset.recordId
      ? null
      : card.dataset.recordId;
    renderRecords();
    setStatus(openMoreActionsId ? "更多操作已展开" : "更多操作已收起", "success");
    return;
  }

  const noteButton = event.target.closest(".note-button");

  if (noteButton) {
    const card = noteButton.closest(".record-card");
    toggleCommentForm(card.dataset.recordId);
    return;
  }

  const todoButton = event.target.closest(".todo-button");

  if (todoButton) {
    const card = todoButton.closest(".record-card");
    toggleRecordTodo(card.dataset.recordId);
    return;
  }

  const todoToggle = event.target.closest(".todo-toggle");

  if (todoToggle) {
    const card = todoToggle.closest(".record-card");
    toggleTodoDone(card.dataset.recordId);
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

recordsList.addEventListener("submit", (event) => {
  const markerForm = event.target.closest(".more-actions-panel");

  if (markerForm) {
    event.preventDefault();
    const marker = new FormData(markerForm).get("marker").trim();
    updateRecordMarker(markerForm.dataset.recordId, marker || null);
    return;
  }

  const form = event.target.closest(".comment-form");

  if (!form) {
    return;
  }

  event.preventDefault();
  addComment(form.dataset.recordId);
});

recordsList.addEventListener("click", (event) => {
  const clearButton = event.target.closest(".marker-clear-button");

  if (clearButton) {
    const panel = clearButton.closest(".more-actions-panel");
    updateRecordMarker(panel.dataset.recordId, null);
    return;
  }

  const deleteButton = event.target.closest(".marker-delete-button");

  if (deleteButton) {
    const panel = deleteButton.closest(".more-actions-panel");
    removeRecord(panel.dataset.recordId);
    return;
  }

  const linkButton = event.target.closest(".marker-link-button");

  if (linkButton) {
    const panel = linkButton.closest(".more-actions-panel");
    startLinking(panel.dataset.recordId);
    return;
  }

  const hiddenButton = event.target.closest(".marker-hide-button");

  if (!hiddenButton) {
    return;
  }

  const panel = hiddenButton.closest(".more-actions-panel");
  const record = records.find((currentRecord) => {
    return currentRecord.id === panel.dataset.recordId;
  });

  if (record) {
    updateRecordHidden(record.id, !record.isHidden);
  }
});

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectAuthor(button.dataset.authorId);
  });
});

accessForm.addEventListener("submit", handleAccessSubmit);

cancelReplyButton.addEventListener("click", cancelReply);

reloadButton.addEventListener("click", reloadFromCloud);

hiddenOnlyButton.addEventListener("click", () => {
  showHiddenOnly = !showHiddenOnly;
  renderRecords();
  setStatus(showHiddenOnly ? "只看隐藏记录" : "显示全部记录", "success");
});

archiveButton.addEventListener("click", archiveCurrentContent);
