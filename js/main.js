import {
  state, initState,
  addTask, updateTask, deleteTask, toggleDone,
  setTheme, setLayout, setSort, setUI, setView, shiftCalendarMonth,
  getFilteredSortedItems
} from "./state.js";

import {
  applyTheme, applyLayout, renderAll, renderList, renderMeta, renderStats, renderView, renderCalendar,
  openModal, closeModal, toast, animateRemoveTaskCard
} from "./ui.js";

initState();
applyTheme();
applyLayout();

// Sync initial sort control
document.querySelector("#qSort").value = state.ui.sort;

// Initial render
renderAll();

/* -------------------- DOM references -------------------- */
const listEl = document.querySelector("#list");
const btnAdd = document.querySelector("#btnAdd");
const btnView = document.querySelector("#btnView");
const btnTheme = document.querySelector("#btnTheme");
const btnLayout = document.querySelector("#btnLayout");
const btnToday = document.querySelector("#btnToday");
const btnClearToday = document.querySelector("#btnClearToday");

const calSection = document.querySelector("#calendarSection");
const calGrid = document.querySelector("#calGrid");
const calPrev = document.querySelector("#calPrev");
const calNext = document.querySelector("#calNext");
const calAdd = document.querySelector("#calAdd");

const qSearch = document.querySelector("#qSearch");
const qStatus = document.querySelector("#qStatus");
const qTag = document.querySelector("#qTag");
const qSort = document.querySelector("#qSort");

const modalClose = document.querySelector("#btnCloseModal");
const btnCancel = document.querySelector("#btnCancel");
const form = document.querySelector("#taskForm");
const delInModal = document.querySelector("#btnDeleteInModal");

/* -------------------- Helpers -------------------- */
function findTaskById(id) {
  return state.items.find(t => t.id === id) || null;
}

/* -------------------- Toolbar actions -------------------- */
btnAdd.addEventListener("click", () => {
  openModal({ mode: "add", task: null });
});

btnView.addEventListener("click", () => {
  const next = state.ui.view === "calendar" ? "list" : "calendar";
  setView(next);
  renderView();
  // update button label
  btnView.innerHTML = next === "calendar"
    ? "📃 <span class=\"hide-sm\">List</span>"
    : "🗓 <span class=\"hide-sm\">Calendar</span>";
  // ensure calendar is fresh when opened
  if (next === "calendar") renderCalendar();
});

btnTheme.addEventListener("click", () => {
  const next = state.settings.theme === "light" ? "dark" : "light";
  setTheme(next);
  applyTheme();
  toast(next === "dark" ? "Dark theme enabled" : "Light theme enabled");
});

btnLayout.addEventListener("click", () => {
  const next = state.settings.layout === "grid" ? "list" : "grid";
  setLayout(next);
  applyLayout();
  toast(next === "grid" ? "Grid layout" : "List layout");
});

btnToday.addEventListener("click", () => {
  setUI({ todayOnly: true });
  renderMeta();
  renderList();
  toast("Showing tasks due today");
  btnClearToday.disabled = false;
});

btnClearToday.addEventListener("click", () => {
  setUI({ todayOnly: false });
  renderMeta();
  renderList();
  renderCalendar();
  toast("Today filter cleared");
  btnClearToday.disabled = true;
});

/* -------------------- Calendar controls -------------------- */
calPrev.addEventListener("click", () => {
  shiftCalendarMonth(-1);
  renderCalendar();
});

calNext.addEventListener("click", () => {
  shiftCalendarMonth(1);
  renderCalendar();
});

calAdd.addEventListener("click", () => {
  openModal({ mode: "add", task: null });
});

/* -------------------- Filters -------------------- */
qSearch.addEventListener("input", () => {
  setUI({ search: qSearch.value });
  renderMeta(); renderList(); renderCalendar();
});

qStatus.addEventListener("change", () => {
  setUI({ status: qStatus.value });
  renderMeta(); renderList(); renderCalendar();
});

qTag.addEventListener("input", () => {
  setUI({ tag: qTag.value });
  renderMeta(); renderList(); renderCalendar();
});

qSort.addEventListener("change", () => {
  setSort(qSort.value);
  renderMeta(); renderList(); renderCalendar();
  toast(`Sorted by ${qSort.options[qSort.selectedIndex].text.toLowerCase()}`);
});

/* -------------------- List actions (event delegation) -------------------- */
listEl.addEventListener("click", (e) => {
  const card = e.target.closest(".task");
  if (!card) return;
  const id = card.dataset.id;
  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;

  if (action === "toggle") {
    toggleDone(id);
    renderStats();
    renderMeta();
    renderList();
    renderCalendar();
    return;
  }

  if (action === "edit") {
    const task = findTaskById(id);
    openModal({ mode: "edit", task });
    // show delete button in modal
    delInModal.dataset.id = id;
    return;
  }

  if (action === "delete") {
    animateRemoveTaskCard(card, () => {
      deleteTask(id);
      renderStats();
      renderMeta();
      renderList();
      renderCalendar();
      toast("Task deleted", "danger");
    });
  }
});

/* -------------------- Calendar actions (event delegation) -------------------- */
calGrid.addEventListener("click", (e) => {
  // Edit existing task from chip
  const chip = e.target.closest("[data-cal-id]");
  if (chip) {
    const id = chip.dataset.calId;
    const task = findTaskById(id);
    if (task) {
      openModal({ mode: "edit", task });
      delInModal.dataset.id = id;
    }
    return;
  }

  // Quick-add: click empty cell to add with pre-filled due date
  const cell = e.target.closest(".calCell");
  const dateStr = cell?.dataset?.date;
  if (dateStr) {
    openModal({ mode: "add", task: null });
    // Set due date after modal opens
    setTimeout(() => {
      const due = document.querySelector("#dueDate");
      if (due) due.value = dateStr;
    }, 0);
  }
});

/* -------------------- Modal controls -------------------- */
modalClose.addEventListener("click", closeModal);
btnCancel.addEventListener("click", closeModal);

delInModal.addEventListener("click", () => {
  const id = document.querySelector("#taskId").value;
  if (!id) return;
  closeModal();
  // delete with animation if card exists
  const card = document.querySelector(`.task[data-id="${CSS.escape(id)}"]`);
  if (card) {
    animateRemoveTaskCard(card, () => {
      deleteTask(id);
      renderStats(); renderMeta(); renderList(); renderCalendar();
      toast("Task deleted", "danger");
    });
  } else {
    deleteTask(id);
    renderStats(); renderMeta(); renderList(); renderCalendar();
    toast("Task deleted", "danger");
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const id = document.querySelector("#taskId").value.trim();
  const title = document.querySelector("#title").value.trim();
  const dueDate = document.querySelector("#dueDate").value;
  const priority = document.querySelector("#priority").value;
  const tag = document.querySelector("#tag").value.trim();

  if (title.length < 2) {
    toast("Title is too short (min 2 chars)", "danger");
    return;
  }

  if (!id) {
    addTask({ title, dueDate, priority, tag });
    closeModal();
    renderStats(); renderMeta(); renderList(); renderCalendar();
    toast("Task added");
  } else {
    updateTask(id, { title, dueDate, priority, tag });
    closeModal();
    renderStats(); renderMeta(); renderList(); renderCalendar();
    toast("Changes saved");
  }
});

/* -------------------- Initial UI state sync -------------------- */
(() => {
  // Theme + layout persisted already in state.settings
  // Ensure layout dataset is correct
  applyLayout();

  // Controls defaults
  qStatus.value = state.ui.status;
  qSearch.value = state.ui.search;
  qTag.value = state.ui.tag;

  // Today filter button state
  btnClearToday.disabled = !state.ui.todayOnly;

  // View button label + initial section visibility
  btnView.innerHTML = state.ui.view === "calendar"
    ? "📃 <span class=\"hide-sm\">List</span>"
    : "🗓 <span class=\"hide-sm\">Calendar</span>";
  renderView();
  renderCalendar();
})();
