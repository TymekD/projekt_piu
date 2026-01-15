import {
  state, initState,
  addTask, updateTask, deleteTask, toggleDone,
  setTheme, setLayout, setSort, setUI,
  getFilteredSortedItems
} from "./state.js";

import {
  applyTheme, applyLayout, renderAll, renderList, renderMeta, renderStats,
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
const btnTheme = document.querySelector("#btnTheme");
const btnLayout = document.querySelector("#btnLayout");
const btnToday = document.querySelector("#btnToday");
const btnClearToday = document.querySelector("#btnClearToday");

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
  toast("Today filter cleared");
  btnClearToday.disabled = true;
});

/* -------------------- Filters -------------------- */
qSearch.addEventListener("input", () => {
  setUI({ search: qSearch.value });
  renderMeta(); renderList();
});

qStatus.addEventListener("change", () => {
  setUI({ status: qStatus.value });
  renderMeta(); renderList();
});

qTag.addEventListener("input", () => {
  setUI({ tag: qTag.value });
  renderMeta(); renderList();
});

qSort.addEventListener("change", () => {
  setSort(qSort.value);
  renderMeta(); renderList();
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
      toast("Task deleted", "danger");
    });
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
      renderStats(); renderMeta(); renderList();
      toast("Task deleted", "danger");
    });
  } else {
    deleteTask(id);
    renderStats(); renderMeta(); renderList();
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
    renderStats(); renderMeta(); renderList();
    toast("Task added");
  } else {
    updateTask(id, { title, dueDate, priority, tag });
    closeModal();
    renderStats(); renderMeta(); renderList();
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
})();
