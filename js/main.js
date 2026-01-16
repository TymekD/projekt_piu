import {
  state, initState,
  addTask, updateTask, deleteTask, toggleDone,
  setTheme, setLayout, setSort, setUI, setView, shiftCalendarMonth
} from "./state.js";

import {
  applyTheme, applyLayout,
  renderStats, renderMeta, renderList, renderView, renderCalendar,
  openModal, closeModal, toast, animateRemove
} from "./ui.js";

const el = (id) => document.getElementById(id);

initState();
applyTheme();
applyLayout();

/* ---------- render helpers ---------- */
const refresh = () => { renderStats(); renderMeta(); renderList(); renderCalendar(); };
const refreshView = () => { renderView(); if (state.ui.view === "calendar") renderCalendar(); };

/* ---------- cache DOM ---------- */
const viewBtn = el("viewBtn");
const themeBtn = el("themeBtn");
const layoutBtn = el("layoutBtn");
const addBtn = el("addBtn");

const todayBtn = el("todayBtn");
const clearTodayBtn = el("clearTodayBtn");

const prevMonthBtn = el("prevMonthBtn");
const nextMonthBtn = el("nextMonthBtn");
const calendarAddBtn = el("calendarAddBtn");

const searchInput = el("searchInput");
const statusSelect = el("statusSelect");
const tagFilterInput = el("tagFilterInput");
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

/* ---------- initial UI sync ---------- */
sortSelect.value = state.ui.sort;
statusSelect.value = state.ui.status;
searchInput.value = state.ui.search;
tagFilterInput.value = state.ui.tag;
clearTodayBtn.disabled = !state.ui.todayOnly;
setViewBtnLabel();
refresh();
refreshView();

/* ---------- top buttons ---------- */
addBtn.addEventListener("click", () => openModal("add"));
calendarAddBtn.addEventListener("click", () => openModal("add"));

viewBtn.addEventListener("click", () => {
  setView(state.ui.view === "calendar" ? "list" : "calendar");
  setViewBtnLabel();
  refreshView();
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

todayBtn.addEventListener("click", () => {
  setUI({ todayOnly: true });
  clearTodayBtn.disabled = false;
  refresh();
  toast("Showing tasks due today");
});

clearTodayBtn.addEventListener("click", () => {
  setUI({ todayOnly: false });
  clearTodayBtn.disabled = true;
  refresh();
  toast("Today filter cleared");
});

/* ---------- calendar nav ---------- */
prevMonthBtn.addEventListener("click", () => { shiftCalendarMonth(-1); renderCalendar(); });
nextMonthBtn.addEventListener("click", () => { shiftCalendarMonth(1); renderCalendar(); });

/* ---------- filters ---------- */
searchInput.addEventListener("input", () => { setUI({ search: searchInput.value }); refresh(); });
statusSelect.addEventListener("change", () => { setUI({ status: statusSelect.value }); refresh(); });
tagFilterInput.addEventListener("input", () => { setUI({ tag: tagFilterInput.value }); refresh(); });
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
