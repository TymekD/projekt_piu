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
const undatedListTop = el("undatedList"); // NEW: used for click-to-edit on undated chips

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
  if (calendarGrid){
    calendarGrid.dataset.slide = dir > 0 ? "next" : "prev";
    // Directional slide animation (CSS classes)
    calendarGrid.classList.remove("calSlideNext", "calSlidePrev");
    // force reflow so animation restarts reliably
    void calendarGrid.offsetWidth;
    calendarGrid.classList.add(dir > 0 ? "calSlideNext" : "calSlidePrev");
    calendarGrid.addEventListener("animationend", () => {
      calendarGrid.classList.remove("calSlideNext", "calSlidePrev");
    }, { once:true });
  }
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

/* ---------- NEW: undated chip click -> edit ---------- */
if (undatedListTop){
  undatedListTop.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cal-id]");
    if (!chip) return;
    openModal("edit", findTask(chip.dataset.calId));
  });
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

/* ------------------------------------------------------------------ */
/* Drag & Drop: undated <-> calendar (bidirectional)                   */
/* + Edge highlight + Month shift by dragging near left/right edge     */
/* ------------------------------------------------------------------ */

(() => {
  // Prevent double-init if module is re-evaluated.
  if (window.__plannerDnDReady) return;
  window.__plannerDnDReady = true;

  const DND_MIME = "text/x-planner-task-id";

  const grid = document.getElementById("calendarGrid");
  const undatedBox = document.getElementById("undatedBox");
  const undatedList = document.getElementById("undatedList");

  if (!grid) return;

  let lastOverCell = null;

  // Edge-driven month shift (drag near left/right edge)
  const EDGE_PX = 26;
  const SHIFT_COOLDOWN = 520; // ms
  let lastShiftAt = 0;
  let activeDragId = "";

  function setEdgeIndicator(side){
    // side: "left" | "right" | ""
    grid.classList.toggle("edgeLeftActive", side === "left");
    grid.classList.toggle("edgeRightActive", side === "right");
  }

  function clearOver(){
    document.querySelectorAll(".dayCell.dragOver").forEach(n => n.classList.remove("dragOver"));
    undatedBox?.classList.remove("dragOver");
    lastOverCell = null;
  }

  function markChipsDraggable(root = document){
    const chips = root.querySelectorAll('button.taskChip[data-cal-id]');
    chips.forEach(chip => {
      if (chip.dataset.dndReady === "1") return;
      chip.dataset.dndReady = "1";
      chip.setAttribute("draggable", "true");
    });
  }

  // Initial pass + keep newly rendered chips draggable.
  markChipsDraggable(document);
  const obs = new MutationObserver((muts) => {
    for (const m of muts){
      m.addedNodes.forEach(node => {
        if (node && node.nodeType === 1) markChipsDraggable(node);
      });
    }
  });
  obs.observe(grid, { childList: true, subtree: true });
  if (undatedList) obs.observe(undatedList, { childList: true, subtree: true });

  function setDragPayload(ev, id){
    try{
      ev.dataTransfer.setData(DND_MIME, id);
      ev.dataTransfer.setData("text/plain", id);
      ev.dataTransfer.effectAllowed = "move";
    } catch {
      // ignore
    }
  }

  function getDragId(ev){
    try{
      return (
        String(ev.dataTransfer?.getData(DND_MIME) || "") ||
        String(ev.dataTransfer?.getData("text/plain") || "")
      ).trim();
    } catch {
      return "";
    }
  }

  function onDragStart(e){
    const chip = e.target.closest('button.taskChip[data-cal-id]');
    if (!chip) return;
    const id = (chip.dataset.calId || "").trim();
    if (!id) return;

    activeDragId = id;
    chip.classList.add("isDragging");
    setDragPayload(e, id);
  }

  function onDragEnd(){
    activeDragId = "";
    setEdgeIndicator("");
    document.querySelectorAll('button.taskChip.isDragging').forEach(n => n.classList.remove("isDragging"));
    clearOver();
  }

  // Sources: both dated chips (calendar grid) and undated chips (undated list)
  grid.addEventListener("dragstart", onDragStart);
  grid.addEventListener("dragend", onDragEnd);
  if (undatedList){
    undatedList.addEventListener("dragstart", onDragStart);
    undatedList.addEventListener("dragend", onDragEnd);
  }
  document.addEventListener("dragend", onDragEnd);

  function maybeShiftMonthByEdge(e){
    if (!activeDragId) {
      setEdgeIndicator("");
      return;
    }

    const rect = grid.getBoundingClientRect();
    const x = e.clientX;
    const nearLeft = x <= rect.left + EDGE_PX;
    const nearRight = x >= rect.right - EDGE_PX;

    if (nearLeft && !nearRight) setEdgeIndicator("left");
    else if (nearRight && !nearLeft) setEdgeIndicator("right");
    else setEdgeIndicator("");

    if (!nearLeft && !nearRight) return;

    const now = Date.now();
    if (now - lastShiftAt < SHIFT_COOLDOWN) return;
    lastShiftAt = now;

    const dir = nearRight ? 1 : -1;
    shiftMonthAnimated(dir);

    // Clear hover state after rerender so it doesn't stick.
    clearOver();
  }

  // Target: day cell -> set dueDate
  grid.addEventListener("dragover", (e) => {
    maybeShiftMonthByEdge(e);

    const cell = e.target.closest(".dayCell");
    if (!cell) return;
    e.preventDefault();

    if (lastOverCell && lastOverCell !== cell) lastOverCell.classList.remove("dragOver");
    cell.classList.add("dragOver");
    lastOverCell = cell;
  });

  grid.addEventListener("dragleave", (e) => {
    const cell = e.target.closest(".dayCell");
    if (!cell) return;

    const to = e.relatedTarget;
    if (to && cell.contains(to)) return;

    cell.classList.remove("dragOver");
    if (lastOverCell === cell) lastOverCell = null;
  });

  grid.addEventListener("drop", (e) => {
    setEdgeIndicator("");
    const cell = e.target.closest(".dayCell");
    const dateStr = cell?.dataset?.date;
    if (!cell || !dateStr) return;

    e.preventDefault();
    const id = getDragId(e);
    if (!id){
      clearOver();
      return;
    }

    updateTask(id, { dueDate: dateStr });
    toast(`Moved to ${dateStr}`);
    clearOver();
    refresh();
  });

  // Target: Undated box -> clear dueDate
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
      clearOver();
      refresh();
    });
  }
})();
