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

export function renderView() {
  const listSection = document.querySelector(".listSection");
  const calSection = document.querySelector("#calendarSection");
  if (!listSection || !calSection) return;

  const isCal = state.ui.view === "calendar";
  calSection.hidden = !isCal;
  listSection.hidden = isCal;
}

export function renderAll() {
  renderStats();
  renderList();
  renderMeta();
  renderView();
  renderCalendar();
}

function pad2(n) { return String(n).padStart(2, "0"); }

function toYMD(d) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function startOfGrid(firstOfMonth) {
  // JS getDay(): Sun=0..Sat=6 ; we want Mon=0..Sun=6
  const dowMon0 = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - dowMon0);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function renderCalendar() {
  const gridEl = document.querySelector("#calGrid");
  const labelEl = document.querySelector("#calMonthLabel");
  const undatedWrap = document.querySelector("#calUndated");
  const undatedList = document.querySelector("#calUndatedList");
  if (!gridEl || !labelEl) return;

  const ym = state.ui.calYM || "";
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m0 = Number(mStr) - 1;
  const first = (Number.isFinite(y) && Number.isFinite(m0)) ? new Date(y, m0, 1) : new Date();

  labelEl.textContent = first.toLocaleString(undefined, { month: "long", year: "numeric" });

  const { items, todayStr } = getFilteredSortedItems();

  // Group tasks by due date
  const byDate = new Map();
  const undated = [];
  for (const t of items) {
    if (!t.dueDate) { undated.push(t); continue; }
    if (!byDate.has(t.dueDate)) byDate.set(t.dueDate, []);
    byDate.get(t.dueDate).push(t);
  }

  // Build 6-week grid (42 cells)
  const start = startOfGrid(first);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ymd = toYMD(d);

    const otherMonth = d.getMonth() !== first.getMonth();
    const tasks = byDate.get(ymd) || [];

    const dateClass = ymd === todayStr ? "calDate calDate--today" : "calDate";
    const cellClass = otherMonth ? "calCell calCell--otherMonth" : "calCell";

    const chips = [];
    const max = 3;
    for (let j = 0; j < Math.min(max, tasks.length); j++) {
      const t = tasks[j];
      const prioClass = t.priority === "high" ? "calChip--high"
        : t.priority === "low" ? "calChip--low"
        : "";
      const doneClass = t.done ? "calChip--done" : "";
      chips.push(
        `<button class="calChip ${prioClass} ${doneClass}" type="button" title="Edit task"
                 data-cal-id="${escapeHtml(t.id)}">${escapeHtml(t.title)}</button>`
      );
    }
    if (tasks.length > max) {
      chips.push(`<div class="calChip calMore" aria-hidden="true">+${tasks.length - max} more</div>`);
    }

    cells.push(`
      <div class="${cellClass}" role="gridcell" data-date="${ymd}">
        <div class="calDateRow">
          <div class="${dateClass}">${escapeHtml(d.getDate())}</div>
        </div>
        <div class="calChips">
          ${chips.join("")}
        </div>
      </div>
    `);
  }

  gridEl.innerHTML = cells.join("");

  // Undated
  if (undatedWrap && undatedList) {
    undatedWrap.hidden = undated.length === 0;
    if (undated.length === 0) {
      undatedList.innerHTML = "";
    } else {
      undatedList.innerHTML = undated.map(t => {
        const prioClass = t.priority === "high" ? "calChip--high"
          : t.priority === "low" ? "calChip--low"
          : "";
        const doneClass = t.done ? "calChip--done" : "";
        return `<button class="calChip ${prioClass} ${doneClass}" type="button" title="Edit task"
                        data-cal-id="${escapeHtml(t.id)}">${escapeHtml(t.title)}</button>`;
      }).join("");
    }
  }
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
