import { state, getFilteredSortedItems, getStats } from "./state.js";

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function priorityLabel(p) {
  if (p === "high") return "High";
  if (p === "low") return "Low";
  return "Medium";
}

function dueLabel(dueDate, todayStr) {
  if (!dueDate) return "No date";
  if (dueDate === todayStr) return "Due today";
  return `Due ${dueDate}`;
}

export function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
}

export function applyLayout() {
  const list = document.querySelector("#list");
  list.dataset.layout = state.settings.layout;
}

export function renderAll() {
  renderStats();
  renderList();
  renderMeta();
}

export function renderStats() {
  const { total, done, pct } = getStats();

  document.querySelector("#statsTotal").textContent = total;
  document.querySelector("#statsDone").textContent = done;
  document.querySelector("#statsPct").textContent = `${pct}%`;

  const sub = document.querySelector("#statsSub");
  if (total === 0) sub.textContent = "No tasks yet. Add your first one.";
  else sub.textContent = done === total ? "Nice — everything is done." : "Keep going — you’re making progress.";

  document.querySelector("#progressBar").style.width = `${pct}%`;
}

export function renderMeta() {
  const { items } = getFilteredSortedItems();
  const meta = document.querySelector("#resultMeta");
  const filters = [];

  if (state.ui.search.trim()) filters.push(`search: "${state.ui.search.trim()}"`);
  if (state.ui.tag.trim()) filters.push(`tag: "${state.ui.tag.trim()}"`);
  if (state.ui.status !== "all") filters.push(`status: ${state.ui.status}`);
  if (state.ui.todayOnly) filters.push(`today`);

  meta.textContent = filters.length
    ? `${items.length} result(s) · ${filters.join(" · ")}`
    : `${items.length} task(s)`;
}

export function renderList() {
  const listEl = document.querySelector("#list");
  const emptyEl = document.querySelector("#empty");

  const { items, todayStr } = getFilteredSortedItems();

  // Empty state
  emptyEl.hidden = items.length !== 0;

  // Build HTML
  const html = items.map(t => {
    const prioClass = t.priority === "high" ? "badge--high"
                   : t.priority === "low"  ? "badge--low"
                   : "badge--mid";
    const tag = t.tag ? `<span class="badge">#${escapeHtml(t.tag)}</span>` : "";
    const due = `<span class="badge">${escapeHtml(dueLabel(t.dueDate, todayStr))}</span>`;
    const prio = `<span class="badge ${prioClass}">${escapeHtml(priorityLabel(t.priority))}</span>`;

    return `
      <article class="task ${t.done ? "done" : ""}" data-id="${escapeHtml(t.id)}">
        <div class="task__top">
          <button class="check" type="button" aria-checked="${t.done ? "true" : "false"}" data-action="toggle"
                  title="Toggle done"></button>
          <div style="min-width:0">
            <p class="task__title">${escapeHtml(t.title)}</p>
            <div class="task__meta">
              ${due}
              ${prio}
              ${tag}
            </div>
          </div>
        </div>
        <div class="task__actions">
          <button class="btn btn--ghost" type="button" data-action="edit">✏ Edit</button>
          <button class="btn btn--danger" type="button" data-action="delete">🗑 Delete</button>
        </div>
      </article>
    `;
  }).join("");

  listEl.innerHTML = html;

  // Today clear button enable/disable
  const clearBtn = document.querySelector("#btnClearToday");
  clearBtn.disabled = !state.ui.todayOnly;
}

/* -------- Animations helpers -------- */
export function animateRemoveTaskCard(cardEl, onDone) {
  if (!cardEl) return onDone?.();
  const h = cardEl.scrollHeight;
  cardEl.style.maxHeight = `${h}px`; // set current height to animate to 0
  // force reflow
  cardEl.getBoundingClientRect();
  cardEl.classList.add("removing");
  cardEl.style.maxHeight = "0px";
  const handle = () => {
    cardEl.removeEventListener("transitionend", handle);
    onDone?.();
  };
  cardEl.addEventListener("transitionend", handle);
}

/* -------- Modal -------- */
export function openModal({ mode, task }) {
  const overlay = document.querySelector("#modalOverlay");
  const title = document.querySelector("#modalTitle");
  const form = document.querySelector("#taskForm");
  const delBtn = document.querySelector("#btnDeleteInModal");

  // Set titles / buttons
  if (mode === "edit") {
    title.textContent = "Edit task";
    delBtn.hidden = false;
  } else {
    title.textContent = "Add task";
    delBtn.hidden = true;
  }

  // Fill inputs
  document.querySelector("#taskId").value = task?.id ?? "";
  document.querySelector("#title").value = task?.title ?? "";
  document.querySelector("#dueDate").value = task?.dueDate ?? "";
  document.querySelector("#priority").value = task?.priority ?? "mid";
  document.querySelector("#tag").value = task?.tag ?? "";

  overlay.hidden = false;

  // small focus management
  setTimeout(() => document.querySelector("#title").focus(), 0);

  // prevent background scroll
  document.body.style.overflow = "hidden";

  // simple: close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  }, { once: true });

  // Esc closes
  const onKey = (e) => {
    if (e.key === "Escape") closeModal();
  };
  window.addEventListener("keydown", onKey, { once: true });

  // keep form from autocompleting weirdly
  //***********form.reset?.();
}

export function closeModal() {
  const overlay = document.querySelector("#modalOverlay");
  overlay.hidden = true;
  document.body.style.overflow = "";
}

/* -------- Toasts -------- */
export function toast(message, variant = "default") {
  const host = document.querySelector("#toasts");
  const el = document.createElement("div");
  el.className = `toast ${variant === "danger" ? "toast--danger" : ""}`;
  el.textContent = message;
  host.appendChild(el);

  // auto-remove
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    el.style.transition = "opacity .18s ease, transform .18s ease";
    setTimeout(() => el.remove(), 220);
  }, 2200);
}
