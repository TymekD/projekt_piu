import {
  state, initState,
  addTask, updateTask, deleteTask, toggleDone,
  setTheme, setLayout, setSort, setUI, setView, shiftCalendarMonth
} from "./state.js";

import {
  applyTheme, applyLayout,
  renderStats, renderMeta, renderTags, renderList, renderView, renderCalendar,
  openModal, closeModal, toast, animateRemove
} from "./ui.js";

const el = (id) => document.getElementById(id);

initState();
applyTheme();
applyLayout();

/* ---------- render helpers ---------- */
const refresh = () => { renderStats(); renderMeta(); renderTags(); renderList(); renderCalendar(); };
const refreshView = () => { renderView(); if (state.ui.view === "calendar") renderCalendar(); };

/* ---------- cache DOM ---------- */
const viewBtn = el("viewBtn");
const viewInner = el("viewInner");
const themeBtn = el("themeBtn");
const layoutBtn = el("layoutBtn");
const addBtn = el("addBtn");

const prevMonthBtn = el("prevMonthBtn");
const nextMonthBtn = el("nextMonthBtn");
const calendarAddBtn = el("calendarAddBtn");
const trashDrop = el("trashDrop");

const searchInput = el("searchInput");
const statusSelect = el("statusSelect");
const tagFilterSelect = el("tagFilterSelect");
const sortSelect = el("sortSelect");

const taskList = el("taskList");
const calendarGrid = el("calendarGrid");
const undatedBox = el("undatedBox");
const undatedList = el("undatedList");

const closeModalBtn = el("closeModalBtn");
const cancelBtn = el("cancelBtn");
const deleteBtn = el("deleteBtn");
const form = el("taskForm");

const findTask = (id) => state.items.find(t => t.id === id) || null;

const setViewBtnLabel = () => {
  const showCalendar = state.ui.view !== "calendar";
  viewBtn.innerHTML = showCalendar
    ? '🗓 <span class="hideOnSmall">Calendar</span>'
    : '📃 <span class="hideOnSmall">List</span>';
};

/* ---------- initial UI sync ---------- */
sortSelect.value = state.ui.sort;
statusSelect.value = state.ui.status;
searchInput.value = state.ui.search;
setViewBtnLabel();
refresh();
refreshView();

/* ---------- top buttons ---------- */
addBtn.addEventListener("click", () => openModal("add"));
calendarAddBtn.addEventListener("click", () => openModal("add"));

let isFlipping = false;

function parseMs(input){
  const s = String(input || "").trim();
  if (!s) return 520;
  if (s.endsWith("ms")) return Number(s.slice(0, -2)) || 520;
  if (s.endsWith("s")) return (Number(s.slice(0, -1)) || 0.52) * 1000;
  const n = Number(s);
  return Number.isFinite(n) ? n : 520;
}

function flipView(nextView){
  if (isFlipping) return;
  isFlipping = true;
  viewBtn.disabled = true;

  const dur = parseMs(getComputedStyle(document.documentElement).getPropertyValue("--flipDur"));

  if (!viewInner){
    setView(nextView);
    setViewBtnLabel();
    refreshView();
    viewBtn.disabled = false;
    isFlipping = false;
    return;
  }

  viewInner.classList.add("isTransitioning");

  setView(nextView);
  setViewBtnLabel();
  refreshView();

  window.setTimeout(() => {
    viewInner.classList.remove("isTransitioning");
    viewBtn.disabled = false;
    isFlipping = false;
  }, dur + 30);
}

viewBtn.addEventListener("click", () => {
  const next = state.ui.view === "calendar" ? "list" : "calendar";
  flipView(next);
});

themeBtn.addEventListener("click", () => {
  const next = state.settings.theme === "light" ? "dark" : "light";
  setTheme(next);
  applyTheme();
  toast(next === "dark" ? "Dark theme enabled" : "Light theme enabled");
});

layoutBtn.addEventListener("click", () => {
  const next = state.settings.layout === "grid" ? "list" : "grid";
  setLayout(next);
  applyLayout();
  toast(next === "grid" ? "Grid layout" : "List layout");
});

/* ===================================================== */
/* Month change with slide animation                     */
/* ===================================================== */
function shiftMonthAnimated(dir){
  if (calendarGrid) calendarGrid.dataset.slide = dir > 0 ? "next" : "prev";
  shiftCalendarMonth(dir);
  renderCalendar();
}

/* ---------- calendar nav ---------- */
prevMonthBtn.addEventListener("click", () => shiftMonthAnimated(-1));
nextMonthBtn.addEventListener("click", () => shiftMonthAnimated(1));

/* ---------- filters ---------- */
searchInput.addEventListener("input", () => { setUI({ search: searchInput.value }); refresh(); });
statusSelect.addEventListener("change", () => { setUI({ status: statusSelect.value }); refresh(); });
if (tagFilterSelect) tagFilterSelect.addEventListener("change", () => { setUI({ tag: tagFilterSelect.value }); refresh(); });
sortSelect.addEventListener("change", () => {
  setSort(sortSelect.value);
  refresh();
  toast(`Sorted by ${sortSelect.options[sortSelect.selectedIndex].text.toLowerCase()}`);
});

/* ---------- list actions (delegation) ---------- */
taskList.addEventListener("click", (e) => {
  const card = e.target.closest(".taskCard");
  const btn = e.target.closest("[data-action]");
  if (!card || !btn) return;

  const id = card.dataset.id;
  const action = btn.dataset.action;

  if (action === "toggle") { toggleDone(id); refresh(); return; }
  if (action === "edit") { openModal("edit", findTask(id)); return; }

  if (action === "delete") {
    animateRemove(card, () => {
      deleteTask(id);
      refresh();
      toast("Task deleted", true);
    });
  }
});

/* ---------- calendar click: edit / add ---------- */
calendarGrid.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-cal-id]");
  if (chip) return openModal("edit", findTask(chip.dataset.calId));

  const cell = e.target.closest(".dayCell");
  const dateStr = cell?.dataset?.date;
  if (!dateStr) return;

  openModal("add");
  setTimeout(() => { el("dateInput").value = dateStr; }, 0);
});

/* ---------- undated click: edit ---------- */
if (undatedList){
  undatedList.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cal-id]");
    if (!chip) return;
    openModal("edit", findTask(chip.dataset.calId));
  });
}

/* ===================================================== */
/* Drag & Drop: days <-> undated + trash + auto month     */
/* ===================================================== */

const DND_MIME = "text/x-planner-task-id";
let draggingId = null;

function getDragIdFromEvent(e){
  const dt = e.dataTransfer;
  if (!dt) return null;
  return dt.getData(DND_MIME) || dt.getData("text/plain") || null;
}

function clearDragOver(){
  document.querySelectorAll(".dayCell.dragOver").forEach(n => n.classList.remove("dragOver"));
  undatedBox?.classList.remove("dragOver");
  trashDrop?.classList.remove("dragOver");
}

function setTaskDate(id, dateStr){
  const t = findTask(id);
  if (!t) return;

  const next = dateStr || "";
  if ((t.dueDate || "") === next) return;

  updateTask(id, { dueDate: next });
  refresh();
  toast(next ? `Moved to ${next}` : "Moved to undated");
}

function deleteTaskByDrop(id){
  const t = findTask(id);
  if (!t) return;
  deleteTask(id);
  refresh();
  toast("Task deleted", true);
}

/* Start dragging from any chip (dated or undated) */
function onDragStart(e){
  const chip = e.target.closest("[data-drag-id]");
  if (!chip) return;

  draggingId = chip.dataset.dragId || "";
  if (!draggingId) return;

  e.dataTransfer.setData(DND_MIME, draggingId);
  e.dataTransfer.setData("text/plain", draggingId);
  e.dataTransfer.effectAllowed = "move";

  chip.classList.add("isDragging");
}

function onDragEnd(){
  draggingId = null;
  document.querySelectorAll(".taskChip.isDragging").forEach(n => n.classList.remove("isDragging"));
  clearDragOver();
  stopAutoMonth();
}

/* ---------- Auto month switching while dragging ---------- */
let autoMonthTimer = null;
let lastAutoMonthAt = 0;
let pendingDir = 0;

function stopAutoMonth(){
  if (autoMonthTimer){
    clearTimeout(autoMonthTimer);
    autoMonthTimer = null;
  }
  pendingDir = 0;
}

function scheduleAutoMonth(dir){
  const now = Date.now();
  if (now - lastAutoMonthAt < 650) return;
  if (pendingDir === dir && autoMonthTimer) return;

  stopAutoMonth();
  pendingDir = dir;

  autoMonthTimer = setTimeout(() => {
    lastAutoMonthAt = Date.now();
    shiftMonthAnimated(dir);
    clearDragOver();
    pendingDir = 0;
    autoMonthTimer = null;
  }, 520);
}

/* Drag over calendar: allow drop + highlight + edge auto month */
function onDragOverCalendar(e){
  const cell = e.target.closest(".dayCell");
  if (!cell) return;

  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  document.querySelectorAll(".dayCell.dragOver").forEach(n => {
    if (n !== cell) n.classList.remove("dragOver");
  });
  cell.classList.add("dragOver");

  const rect = calendarGrid.getBoundingClientRect();
  const edge = 26;
  if (e.clientX < rect.left + edge) scheduleAutoMonth(-1);
  else if (e.clientX > rect.right - edge) scheduleAutoMonth(1);
  else stopAutoMonth();
}

function onDropCalendar(e){
  const cell = e.target.closest(".dayCell");
  const dateStr = cell?.dataset?.date;
  if (!dateStr) return;

  e.preventDefault();
  const id = getDragIdFromEvent(e) || draggingId;
  if (!id) return;

  clearDragOver();
  stopAutoMonth();
  setTaskDate(id, dateStr);
}

/* Undated drop zone: make undated */
function onDragOverUndated(e){
  if (!undatedBox) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  undatedBox.classList.add("dragOver");
}

function onDropUndated(e){
  if (!undatedBox) return;
  e.preventDefault();
  const id = getDragIdFromEvent(e) || draggingId;
  if (!id) return;

  clearDragOver();
  stopAutoMonth();
  setTaskDate(id, "");
}

/* Trash drop zone: delete */
function onDragOverTrash(e){
  if (!trashDrop) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  trashDrop.classList.add("dragOver");
}

function onDropTrash(e){
  if (!trashDrop) return;
  e.preventDefault();
  const id = getDragIdFromEvent(e) || draggingId;
  if (!id) return;

  clearDragOver();
  stopAutoMonth();
  deleteTaskByDrop(id);
}

/* Bind DnD listeners */
calendarGrid.addEventListener("dragstart", onDragStart);
calendarGrid.addEventListener("dragend", onDragEnd);
calendarGrid.addEventListener("dragover", onDragOverCalendar);
calendarGrid.addEventListener("drop", onDropCalendar);

/* Undated zone */
if (undatedBox){
  undatedBox.addEventListener("dragover", onDragOverUndated);
  undatedBox.addEventListener("drop", onDropUndated);
  undatedBox.addEventListener("dragleave", () => undatedBox.classList.remove("dragOver"));
}

/* Undated list is also draggable source */
if (undatedList){
  undatedList.addEventListener("dragstart", onDragStart);
  undatedList.addEventListener("dragend", onDragEnd);
}

/* Trash zone */
if (trashDrop){
  trashDrop.addEventListener("dragover", onDragOverTrash);
  trashDrop.addEventListener("drop", onDropTrash);
  trashDrop.addEventListener("dragleave", () => trashDrop.classList.remove("dragOver"));
}

/* ---------- modal ---------- */
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

deleteBtn.addEventListener("click", () => {
  const id = el("taskId").value;
  if (!id) return;
  closeModal();

  const card = document.querySelector(`.taskCard[data-id="${CSS.escape(id)}"]`);
  if (card) {
    animateRemove(card, () => {
      deleteTask(id);
      refresh();
      toast("Task deleted", true);
    });
  } else {
    deleteTask(id);
    refresh();
    toast("Task deleted", true);
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const id = el("taskId").value.trim();
  const title = el("titleInput").value.trim();
  const dueDate = el("dateInput").value;
  const priority = el("prioritySelect").value;
  const tag = el("tagInput").value.trim();

  if (title.length < 2) return toast("Title is too short (min 2 chars)", true);

  if (!id) {
    addTask({ title, dueDate, priority, tag });
    toast("Task added");
  } else {
    updateTask(id, { title, dueDate, priority, tag });
    toast("Changes saved");
  }

  closeModal();
  refresh();
});
