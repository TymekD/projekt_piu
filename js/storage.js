const KEY_ITEMS = "planner_items";
const KEY_SETTINGS = "planner_settings";

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
