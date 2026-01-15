import { loadItems, saveItems, loadSettings, saveSettings } from "./storage.js";

function safeId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

const defaultSettings = {
  theme: "light",   // "light" | "dark"
  layout: "grid",   // "grid" | "list"
  sort: "date",     // "date" | "priority" | "created"
};

export const state = {
  items: [],
  settings: { ...defaultSettings },
  ui: {
    search: "",
    status: "all",    // all | active | done
    tag: "",
    sort: "date",
    todayOnly: false,
  },
};

export function initState() {
  state.items = loadItems();
  const s = loadSettings();
  state.settings = { ...defaultSettings, ...(s ?? {}) };
  state.ui.sort = state.settings.sort || "date";
}

/* ---------- Items ---------- */
export function addTask({ title, dueDate, priority, tag }) {
  const item = {
    id: safeId(),
    title: title.trim(),
    dueDate: dueDate || "",
    priority: priority || "mid",
    tag: (tag || "").trim(),
    done: false,
    createdAt: Date.now(),
  };
  state.items.unshift(item);
  persistItems();
  return item;
}

export function updateTask(id, patch) {
  const idx = state.items.findIndex(t => t.id === id);
  if (idx === -1) return null;
  state.items[idx] = { ...state.items[idx], ...patch };
  persistItems();
  return state.items[idx];
}

export function deleteTask(id) {
  const idx = state.items.findIndex(t => t.id === id);
  if (idx === -1) return false;
  state.items.splice(idx, 1);
  persistItems();
  return true;
}

export function toggleDone(id) {
  const t = state.items.find(x => x.id === id);
  if (!t) return null;
  t.done = !t.done;
  persistItems();
  return t;
}

/* ---------- Settings ---------- */
export function setTheme(theme) {
  state.settings.theme = theme;
  persistSettings();
}
export function setLayout(layout) {
  state.settings.layout = layout;
  persistSettings();
}
export function setSort(sort) {
  state.settings.sort = sort;
  state.ui.sort = sort;
  persistSettings();
}

/* ---------- UI filters ---------- */
export function setUI(patch) {
  state.ui = { ...state.ui, ...patch };
}

/* ---------- Persistence helpers ---------- */
function persistItems() { saveItems(state.items); }
function persistSettings() { saveSettings(state.settings); }

/* ---------- Derived data ---------- */
export function getFilteredSortedItems() {
  const q = state.ui.search.trim().toLowerCase();
  const tagQ = state.ui.tag.trim().toLowerCase();
  const status = state.ui.status;
  const todayOnly = state.ui.todayOnly;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  let items = state.items.slice();

  // Filters
  if (q) {
    items = items.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.tag || "").toLowerCase().includes(q)
    );
  }

  if (tagQ) {
    items = items.filter(t => (t.tag || "").toLowerCase().includes(tagQ));
  }

  if (status === "active") items = items.filter(t => !t.done);
  if (status === "done") items = items.filter(t => t.done);

  if (todayOnly) {
    items = items.filter(t => t.dueDate === todayStr);
  }

  // Sorting
  const sort = state.ui.sort;
  const prioRank = { high: 3, mid: 2, low: 1 };

  items.sort((a, b) => {
    if (sort === "created") return b.createdAt - a.createdAt;

    if (sort === "priority") {
      const pa = prioRank[a.priority] ?? 0;
      const pb = prioRank[b.priority] ?? 0;
      if (pb !== pa) return pb - pa;
      return (b.createdAt - a.createdAt);
    }

    // sort === "date" (default): earliest due first, undated last
    const da = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
    const db = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return b.createdAt - a.createdAt;
  });

  return { items, todayStr };
}

export function getStats() {
  const total = state.items.length;
  const done = state.items.filter(t => t.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
}
