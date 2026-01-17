import { state, getFilteredSortedItems, getStats, getAllTags } from "./state.js";

const el = (id) => document.getElementById(id);

const E = (s="") => String(s)
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;")
  .replaceAll("'","&#039;");

const prioText = (p) => p === "high" ? "High" : p === "low" ? "Low" : "Medium";
const dueText = (d, today) => !d ? "No date" : d === today ? "Due today" : `Due ${d}`;
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

export const applyTheme = () => (document.documentElement.dataset.theme = state.settings.theme);
export const applyLayout = () => (el("taskList").dataset.layout = state.settings.layout);

export function renderView(){
  const isCal = state.ui.view === "calendar";
  const inner = el("viewInner");
  if (inner) inner.classList.toggle("isCalendar", isCal);

  // Accessibility: mark the non-active face as hidden to screen readers.
  el("calendarView").setAttribute("aria-hidden", String(!isCal));
  el("taskSection").setAttribute("aria-hidden", String(isCal));

  // Holidays card should be visible only in calendar view
  const holidaysCard = el("holidaysCard");
  if (holidaysCard) holidaysCard.hidden = !isCal;
}

export function renderAll(){
  renderStats();
  renderMeta();
  renderTags();
  renderList();
  renderView();
  renderCalendar();
}

export function renderStats(){
  const { total, done, pct } = getStats();
  el("totalCount").textContent = total;
  el("doneCount").textContent = done;
  el("donePercent").textContent = `${pct}%`;
  el("statsText").textContent = total === 0
    ? "No tasks yet. Add your first one."
    : done === total ? "Nice — everything is done." : "Keep going — you’re making progress.";
  el("progressFill").style.width = `${pct}%`;
}


export function renderTags(){
  const tags = getAllTags();

  // Filter dropdown
  const sel = el("tagFilterSelect");
  if (sel){
    const current = (state.ui.tag || "").trim().toLowerCase();
    const options = ['<option value="">All</option>']
      .concat(tags.map(t => {
        const v = t.toLowerCase();
        const selected = v === current ? ' selected' : '';
        return `<option value="${E(v)}"${selected}>#${E(t)}</option>`;
      }));
    sel.innerHTML = options.join("");
  }

  // Datalist for modal tag input
  const dl = el("tagOptions");
  if (dl){
    dl.innerHTML = tags.map(t => `<option value="${E(t)}"></option>`).join("");
  }
}


let _tagSuggestReady = false;

function _hideTagSuggest(){
  const box = el("tagSuggest");
  if (box) box.hidden = true;
}

function _renderTagSuggest(){
  const input = el("tagInput");
  const box = el("tagSuggest");
  if (!input || !box) return;

  const tags = getAllTags();
  const q = (input.value || "").trim().toLowerCase();

  const shown = tags
    .filter(t => !q || t.toLowerCase().includes(q))
    .slice(0, 12);

  if (!shown.length){
    box.hidden = true;
    box.innerHTML = "";
    return;
  }

  // Simple highlight of match
  const items = shown.map(t => {
    const low = t.toLowerCase();
    if (!q) return `<button type="button" class="tagSuggestItem" data-tag="${E(t)}">#${E(t)}</button>`;
    const idx = low.indexOf(q);
    if (idx === -1) return `<button type="button" class="tagSuggestItem" data-tag="${E(t)}">#${E(t)}</button>`;
    const a = E(t.slice(0, idx));
    const b = E(t.slice(idx, idx + q.length));
    const c = E(t.slice(idx + q.length));
    return `<button type="button" class="tagSuggestItem" data-tag="${E(t)}">#${a}<strong>${b}</strong>${c}</button>`;
  });

  box.innerHTML = items.join("");
  box.hidden = false;
}

function setupTagSuggest(){
  if (_tagSuggestReady) return;
  const input = el("tagInput");
  const box = el("tagSuggest");
  if (!input || !box) return;

  _tagSuggestReady = true;
  let blurTimer = null;

  const show = () => {
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
    _renderTagSuggest();
  };

  input.addEventListener("focus", show);
  input.addEventListener("input", show);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") _hideTagSuggest();
  });

  input.addEventListener("blur", () => {
    // Delay so click on suggestion still works
    blurTimer = setTimeout(_hideTagSuggest, 120);
  });

  box.addEventListener("mousedown", (e) => {
    // Prevent input losing focus before click handler runs
    e.preventDefault();
  });

  box.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tag]");
    if (!btn) return;
    input.value = btn.dataset.tag || "";
    _hideTagSuggest();
    input.focus();
  });

  // Close on outside click (safer than relying only on blur)
  document.addEventListener("click", (e) => {
    if (!document.body.contains(box)) return;
    if (e.target === input || box.contains(e.target)) return;
    _hideTagSuggest();
  });
}



export function renderMeta(){
  const { items } = getFilteredSortedItems();
  const parts = [];
  const s = state.ui.search.trim();
  const t = state.ui.tag.trim();
  if (s) parts.push(`search: "${s}"`);
  if (t) parts.push(`tag: "${t}"`);
  if (state.ui.status !== "all") parts.push(`status: ${state.ui.status}`);
  if (state.ui.todayOnly) parts.push("today");
  el("resultsInfo").textContent = parts.length
    ? `${items.length} result(s) · ${parts.join(" · ")}`
    : `${items.length} task(s)`;
}

/* ---------------- Public holidays ---------------- */
export function renderHolidays(){
  const list = el("holidaysList");
  const sub = el("holidaysSubtitle");
  if (!list || !sub) return;

  const cc = (state.holidays?.country || "PL").toUpperCase();
  const year = state.holidays?.year || new Date().getFullYear();
  sub.textContent = `Public holidays · ${cc} · ${year}`;

  const items = Array.isArray(state.holidays?.items) ? state.holidays.items : [];
  if (!items.length){
    list.innerHTML = `<div class="muted">No holidays loaded yet. Click “Load holidays”.</div>`;
    return;
  }

  // Show upcoming holidays (keeps the card compact)
  const today = new Date();
  today.setHours(0,0,0,0);
  const upcoming = items
    .filter(h => {
      const t = Date.parse(h.date);
      return Number.isFinite(t) && t >= today.getTime();
    })
    .sort((a,b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(0, 10);

  const shown = upcoming.length ? upcoming : items.slice().sort((a,b) => Date.parse(a.date) - Date.parse(b.date)).slice(0, 10);

  list.innerHTML = shown.map(h => {
    const name = h.localName || h.name || "Holiday";
    return `
      <div class="holidayItem" title="${E(name)}">
        <div class="holidayName">${E(name)}</div>
        <div class="holidayDate muted">${E(h.date)}</div>
      </div>
    `;
  }).join("");
}

export function renderList(){
  const { items, todayStr } = getFilteredSortedItems();
  el("emptyState").hidden = items.length !== 0;

  el("taskList").innerHTML = items.map(t => {
    const prioClass = t.priority === "high" ? "high" : t.priority === "low" ? "low" : "mid";
    const tag = t.tag ? `<span class="badge">#${E(t.tag)}</span>` : "";
    return `
      <article class="taskCard ${t.done ? "done" : ""}" data-id="${E(t.id)}">
        <div class="taskTop">
          <button class="check" type="button" aria-checked="${t.done}" data-action="toggle" title="Toggle done"></button>
          <div class="taskMain">
            <p class="taskTitle">${E(t.title)}</p>
            <div class="taskMeta">
              <span class="badge">${E(dueText(t.dueDate, todayStr))}</span>
              <span class="badge ${prioClass}">${E(prioText(t.priority))}</span>
              ${tag}
            </div>
          </div>
        </div>
        <div class="taskActions">
          <button class="btn ghostBtn" type="button" data-action="edit">✏ Edit</button>
          <button class="btn dangerBtn" type="button" data-action="delete">🗑 Delete</button>
        </div>
      </article>
    `;
  }).join("");

  el("clearTodayBtn").disabled = !state.ui.todayOnly;
}

function gridStart(firstOfMonth){
  const dowMon0 = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - dowMon0);
  start.setHours(0,0,0,0);
  return start;
}

export function renderCalendar(){
  const grid = el("calendarGrid");
  const label = el("monthLabel");
  if (!grid || !label) return;

  const [yStr, mStr] = (state.ui.calYM || "").split("-");
  const y = Number(yStr);
  const m0 = Number(mStr) - 1;
  const first = (Number.isFinite(y) && Number.isFinite(m0)) ? new Date(y, m0, 1) : new Date();
  label.textContent = first.toLocaleString(undefined, { month:"long", year:"numeric" });

  const { items, todayStr } = getFilteredSortedItems();
  const byDate = new Map();
  const undated = [];
  for (const t of items){
    if (!t.dueDate) { undated.push(t); continue; }
    (byDate.get(t.dueDate) || byDate.set(t.dueDate, []).get(t.dueDate)).push(t);
  }

  const start = gridStart(first);
  const cells = [];

  for (let i=0;i<42;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const dateStr = ymd(d);
    const otherMonth = d.getMonth() !== first.getMonth();
    const tasks = byDate.get(dateStr) || [];
    const hol = state.holidays?.byDate?.[dateStr] || null;

    const chips = [];
    const max = 3;
    for (let j=0;j<Math.min(max, tasks.length); j++){
      const t = tasks[j];
      const pr = t.priority === "high" ? "high" : t.priority === "low" ? "low" : "";
      const dn = t.done ? "done" : "";
      chips.push(`<button class="taskChip ${pr} ${dn}" type="button" data-cal-id="${E(t.id)}" title="Edit task">${E(t.title)}</button>`);
    }
    if (tasks.length > max) chips.push(`<div class="taskChip more">+${tasks.length-max} more</div>`);

    const holTitle = hol ? E(hol.localName || hol.name || "Holiday") : "";

    cells.push(`
      <div class="dayCell ${otherMonth ? "otherMonth" : ""} ${hol ? "holidayDay" : ""}" role="gridcell" data-date="${dateStr}">
        <div class="dayTop">
          <div class="dayNumber ${dateStr===todayStr ? "today" : ""}">${d.getDate()}</div>
          ${hol ? `<div class="holidayBadge" title="${holTitle}">🎉</div>` : ""}
        </div>
        <div class="chipList">${chips.join("")}</div>
      </div>
    `);
  }

  grid.innerHTML = cells.join("");

  const box = el("undatedBox");
  const list = el("undatedList");
  if (box && list){
    box.hidden = undated.length === 0;
    list.innerHTML = undated.map(t => {
      const pr = t.priority === "high" ? "high" : t.priority === "low" ? "low" : "";
      const dn = t.done ? "done" : "";
      return `<button class="taskChip ${pr} ${dn}" type="button" data-cal-id="${E(t.id)}" title="Edit task">${E(t.title)}</button>`;
    }).join("");
  }
}

export function animateRemove(card, onDone){
  if (!card) return onDone?.();
  card.style.maxHeight = `${card.scrollHeight}px`;
  card.getBoundingClientRect();
  card.classList.add("removing");
  card.style.maxHeight = "0px";
  card.addEventListener("transitionend", () => onDone?.(), { once:true });
}

export function openModal(mode, task){
  renderTags();
  el("modalTitle").textContent = mode === "edit" ? "Edit task" : "Add task";
  el("deleteBtn").hidden = mode !== "edit";

  el("taskId").value = task?.id || "";
  el("titleInput").value = task?.title || "";
  el("dateInput").value = task?.dueDate || "";
  el("prioritySelect").value = task?.priority || "mid";
  el("tagInput").value = task?.tag || "";
  setupTagSuggest();
  _renderTagSuggest();

  el("modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => el("titleInput").focus(), 0);

  const backdrop = el("modalBackdrop");
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); }, { once:true });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); }, { once:true });
}

export function closeModal(){
  _hideTagSuggest();
  el("modalBackdrop").hidden = true;
  document.body.style.overflow = "";
}

export function toast(msg, danger=false){
  const host = el("toastArea");
  const t = document.createElement("div");
  t.className = `toast${danger ? " danger" : ""}`;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(10px)";
    setTimeout(() => t.remove(), 200);
  }, 2200);
}
