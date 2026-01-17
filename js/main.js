import {
  state, initState,
  addTask, updateTask, deleteTask, toggleDone,
  setTheme, setLayout, setSort, setUI, setView, shiftCalendarMonth,
  setHolidays, getCalendarYear
} from "./state.js";

import {
  applyTheme, applyLayout,
  renderStats, renderHolidays, renderMeta, renderTags, renderList, renderView, renderCalendar,
  openModal, closeModal, toast, animateRemove
} from "./ui.js";

const el = (id) => document.getElementById(id);

initState();
applyTheme();
applyLayout();

/* ---------- render helpers ---------- */
const refresh = () => { renderStats(); renderHolidays(); renderMeta(); renderTags(); renderList(); renderCalendar(); };
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

const holidaysBtn = el("holidaysBtn");

const searchInput = el("searchInput");
const statusSelect = el("statusSelect");
const tagFilterSelect = el("tagFilterSelect");
const sortSelect = el("sortSelect");

const taskList = el("taskList");
const calendarGrid = el("calendarGrid");

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

/* ---------- Public holidays (Nager.Date) ---------- */
async function fetchPublicHolidays(year){
  const cc = (state.holidays?.country || "PL").toUpperCase();
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`;

  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`Holiday request failed (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected holiday response");

  const items = data
    .filter(h => h && typeof h.date === "string")
    .map(h => ({
      date: h.date,
      name: h.name,
      localName: h.localName || h.name,
    }));

  setHolidays(year, cc, items);
}

async function ensureHolidaysForYear(year){
  if (state.holidays?.year === year && Array.isArray(state.holidays.items) && state.holidays.items.length) return;
  if (holidaysBtn) holidaysBtn.disabled = true;
  try{
    await fetchPublicHolidays(year);
    toast("Public holidays loaded");
  } catch {
    toast("Could not load holidays (check internet)", true);
  } finally {
    if (holidaysBtn) holidaysBtn.disabled = false;
    renderHolidays();
    renderCalendar();
  }
}

/* ---------- initial UI sync ---------- */
sortSelect.value = state.ui.sort;
statusSelect.value = state.ui.status;
searchInput.value = state.ui.search;
setViewBtnLabel();
refresh();
refreshView();

// Load cached holidays if available; fetch only if needed.
ensureHolidaysForYear(getCalendarYear());

/* ---------- top buttons ---------- */
addBtn.addEventListener("click", () => openModal("add"));
calendarAddBtn.addEventListener("click", () => openModal("add"));

if (holidaysBtn){
  holidaysBtn.addEventListener("click", () => ensureHolidaysForYear(getCalendarYear()));
}

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

  // Read duration from CSS variable so JS stays in sync.
  const dur = parseMs(getComputedStyle(document.documentElement).getPropertyValue("--flipDur"));

  // No wrapper? fall back to instant.
  if (!viewInner){
    setView(nextView);
    setViewBtnLabel();
    refreshView();
    viewBtn.disabled = false;
    isFlipping = false;
    return;
  }

  // With two-sided faces (front=list, back=calendar), we can rotate a full 180deg.
  // Toggle the view immediately; CSS transition will animate the rotation.
  viewInner.classList.add("isTransitioning");

  setView(nextView);
  setViewBtnLabel();
  refreshView();

  // Clean up after transition finishes.
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

/* ---------- calendar nav (month shift + holiday auto-load) ---------- */
function shiftMonthAnimated(dir){
  const before = getCalendarYear();
  if (calendarGrid) calendarGrid.dataset.slide = dir > 0 ? "next" : "prev";
  shiftCalendarMonth(dir);
  const after = getCalendarYear();
  renderCalendar();
  if (after !== before) ensureHolidaysForYear(after);
}

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

/* ---------- calendar actions (delegation) ---------- */
calendarGrid.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-cal-id]");
  if (chip) return openModal("edit", findTask(chip.dataset.calId));

  const cell = e.target.closest(".dayCell");
  const dateStr = cell?.dataset?.date;
  if (!dateStr) return;

  openModal("add");
  setTimeout(() => { el("dateInput").value = dateStr; }, 0);
});

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

/* ------------------------------------------------------------------ */
/* Drag & Drop: move tasks between calendar days (NEW, appended only)  */
/* ------------------------------------------------------------------ */


(() => {
  // Prevent double-init if module is re-evaluated.
  if (window.__plannerDnDReady) return;
  window.__plannerDnDReady = true;

  const grid = document.getElementById("calendarGrid");
  const undatedBox = document.getElementById("undatedBox");
  const undatedList = document.getElementById("undatedList");

  if (!grid) return;

  let lastOver = null;

  function clearOver(){
    document.querySelectorAll(".dayCell.dragOver").forEach(n => n.classList.remove("dragOver"));
    if (undatedBox) undatedBox.classList.remove("dragOver");
    lastOver = null;
  }

  function markChipsDraggable(root = document){
    const chips = root.querySelectorAll('button.taskChip[data-cal-id]');
    chips.forEach(chip => {
      if (chip.dataset.dndReady === "1") return;
      chip.dataset.dndReady = "1";
      chip.setAttribute("draggable", "true");
    });
  }

  // Initial pass (in case calendar already rendered)
  markChipsDraggable(document);

  // Keep newly rendered chips draggable.
  const obs = new MutationObserver((muts) => {
    for (const m of muts){
      m.addedNodes.forEach(node => {
        if (node && node.nodeType === 1) markChipsDraggable(node);
      });
    }
  });
  obs.observe(grid, { childList: true, subtree: true });
  if (undatedList) obs.observe(undatedList, { childList: true, subtree: true });

  // Drag start / end
  grid.addEventListener("dragstart", (e) => {
    const chip = e.target.closest('button.taskChip[data-cal-id]');
    if (!chip) return;
    const id = (chip.dataset.calId || "").trim();
    if (!id) return;

    chip.classList.add("isDragging");

    try{
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
    } catch {
      // ignore
    }
  });

  document.addEventListener("dragend", (e) => {
    const chip = e.target?.closest?.('button.taskChip[data-cal-id]');
    if (chip) chip.classList.remove("isDragging");
    clearOver();
  });

  function getDragId(ev){
    try{
      return String(ev.dataTransfer.getData("text/plain") || "").trim();
    } catch {
      return "";
    }
  }

  // Drop on a day cell -> set dueDate to that date
  grid.addEventListener("dragover", (e) => {
    const cell = e.target.closest(".dayCell");
    if (!cell) return;
    e.preventDefault();

    if (lastOver && lastOver !== cell) lastOver.classList.remove("dragOver");
    cell.classList.add("dragOver");
    lastOver = cell;
  });

  grid.addEventListener("dragleave", (e) => {
    const cell = e.target.closest(".dayCell");
    if (!cell) return;

    const to = e.relatedTarget;
    if (to && cell.contains(to)) return;

    cell.classList.remove("dragOver");
    if (lastOver === cell) lastOver = null;
  });

  grid.addEventListener("drop", (e) => {
    const cell = e.target.closest(".dayCell");
    if (!cell) return;

    e.preventDefault();
    const id = getDragId(e);
    const dateStr = cell.dataset.date;

    if (!id || !dateStr){
      clearOver();
      return;
    }

    updateTask(id, { dueDate: dateStr });
    toast(`Moved to ${dateStr}`);

    clearOver();
    renderStats();
    renderHolidays();
    renderMeta();
    renderTags();
    renderList();
    renderCalendar();
  });

  // Drop on Undated -> clear dueDate
  if (undatedBox){
    undatedBox.addEventListener("dragover", (e) => {
      e.preventDefault();
      undatedBox.classList.add("dragOver");
    });

    undatedBox.addEventListener("dragleave", (e) => {
      const to = e.relatedTarget;
      if (to && undatedBox.contains(to)) return;
      undatedBox.classList.remove("dragOver");
    });

    undatedBox.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = getDragId(e);
      if (!id){
        undatedBox.classList.remove("dragOver");
        return;
      }

      updateTask(id, { dueDate: "" });
      toast("Moved to undated");

      undatedBox.classList.remove("dragOver");
      renderStats();
      renderHolidays();
      renderMeta();
      renderTags();
      renderList();
      renderCalendar();
    });
  }
  
})();

/* ------------------------------------------------------------------ */
/* Drag & Drop extension: allow dragging FROM Undated list to calendar */
/* (APPEND-ONLY)                                                      */
/* ------------------------------------------------------------------ */

/*
(() => {
  if (window.__plannerDnDUndatedDragStartReady) return;
  window.__plannerDnDUndatedDragStartReady = true;

  const undatedList = document.getElementById("undatedList");
  if (!undatedList) return;

  undatedList.addEventListener("dragstart", (e) => {
    const chip = e.target.closest('button.taskChip[data-cal-id]');
    if (!chip) return;

    const id = (chip.dataset.calId || "").trim();
    if (!id) return;

    chip.classList.add("isDragging");

    try {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
    } catch {}
  });
})();

*/

/* ===================================================== */
/* Drag & Drop: days <-> undated + trash + auto month     */
/* ===================================================== */

/*
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

//Start dragging from any chip (dated or undated) 
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

// ---------- Auto month switching while dragging ---------
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

// Drag over calendar: allow drop + highlight + edge auto month
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

// Undated drop zone: make undated
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

// Trash drop zone: delete 
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

// Bind DnD listeners 
calendarGrid.addEventListener("dragstart", onDragStart);
calendarGrid.addEventListener("dragend", onDragEnd);
calendarGrid.addEventListener("dragover", onDragOverCalendar);
calendarGrid.addEventListener("drop", onDropCalendar);

// Undated zone 
if (undatedBox){
  undatedBox.addEventListener("dragover", onDragOverUndated);
  undatedBox.addEventListener("drop", onDropUndated);
  undatedBox.addEventListener("dragleave", () => undatedBox.classList.remove("dragOver"));
}

// Undated list is also draggable source 
if (undatedList){
  undatedList.addEventListener("dragstart", onDragStart);
  undatedList.addEventListener("dragend", onDragEnd);
}

// Trash zone 
if (trashDrop){
  trashDrop.addEventListener("dragover", onDragOverTrash);
  trashDrop.addEventListener("drop", onDropTrash);
  trashDrop.addEventListener("dragleave", () => trashDrop.classList.remove("dragOver"));
}

*/