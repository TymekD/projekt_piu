const KEY_ITEMS = "planner_items";
const KEY_SETTINGS = "planner_settings";
const KEY_HOLIDAYS = "planner_holidays_v1";

export function loadItems() {
  try {
    const raw = localStorage.getItem(KEY_ITEMS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveItems(items) {
  localStorage.setItem(KEY_ITEMS, JSON.stringify(items));
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
}

/* ---------------- Holidays (Nager.Date) ---------------- */
function holidaysKey(countryCode, year){
  return `${String(countryCode || "PL").toUpperCase()}-${String(year)}`;
}

export function loadHolidays(countryCode, year){
  try{
    const raw = localStorage.getItem(KEY_HOLIDAYS);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return null;
    const key = holidaysKey(countryCode, year);
    const payload = parsed[key];
    if (!payload || typeof payload !== "object") return null;
    return Array.isArray(payload.items) ? payload : null;
  } catch {
    return null;
  }
}

export function saveHolidays(countryCode, year, items){
  try{
    const raw = localStorage.getItem(KEY_HOLIDAYS);
    const parsed = raw ? JSON.parse(raw) : {};
    const safe = (parsed && typeof parsed === "object") ? parsed : {};
    const key = holidaysKey(countryCode, year);
    safe[key] = { items: Array.isArray(items) ? items : [], savedAt: Date.now() };
    localStorage.setItem(KEY_HOLIDAYS, JSON.stringify(safe));
  } catch {
    // ignore storage failures
  }
}
