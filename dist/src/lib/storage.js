const PROJECTS_KEY = 'pyeong-plan-projects-v1';
const CURRENT_KEY = 'pyeong-plan-current-v1';
const PREFS_KEY = 'pyeong-plan-prefs-v1';

export function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadCurrent() {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveCurrent(project) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(project));
}

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
