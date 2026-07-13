/**
 * api.js - Centralized API helper for StudentOS (Express/MongoDB implementation)
 */

const API_BASE_URL = ""; // Served from the same Express origin

async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  const data = await res.json();
  if (!res.ok) throw new Error((data && data.error) || 'API request failed');
  return data;
}

const api = {
  student: {
    login: async (body) => {
      return await apiFetch('/api/student/login', { method: 'POST', body });
    },
    list: async () => {
      return await apiFetch('/api/students');
    },
    approve: async (id) => {
      return await apiFetch(`/api/students/${id}/approve`, { method: 'PUT' });
    },
    delete: async (id) => {
      return await apiFetch(`/api/students/${id}`, { method: 'DELETE' });
    },
    update: async (id, body) => {
      return await apiFetch(`/api/students/${id}`, { method: 'PUT', body });
    },
  },
  incharge: {
    login: async (body) => {
      return await apiFetch('/api/incharge/login', { method: 'POST', body });
    },
  },
  timetable: {
    get: async () => {
      return await apiFetch('/api/timetable');
    },
    add: async (body) => {
      return await apiFetch('/api/timetable', { method: 'POST', body });
    },
    update: async (id, body) => {
      return await apiFetch(`/api/timetable/${id}`, { method: 'PUT', body });
    },
    delete: async (id) => {
      return await apiFetch(`/api/timetable/${id}`, { method: 'DELETE' });
    },
  },
  assignments: {
    forStudent: async (studentId) => {
      return await apiFetch(`/api/assignments?studentId=${studentId}`);
    },
    all: async () => {
      return await apiFetch('/api/assignments');
    },
    add: async (body) => {
      return await apiFetch('/api/assignments', { method: 'POST', body });
    },
    delete: async (id) => {
      return await apiFetch(`/api/assignments/${id}`, { method: 'DELETE' });
    },
    complete: async (id, studentId) => {
      return await apiFetch(`/api/assignments/${id}/complete`, { method: 'POST', body: { studentId } });
    },
    uncomplete: async (id, studentId) => {
      return await apiFetch(`/api/assignments/${id}/complete`, { method: 'DELETE', body: { studentId } });
    },
    completions: async (id) => {
      return await apiFetch(`/api/assignments/${id}/completions`);
    },
  },
  attendance: {
    getAll: async () => {
      return await apiFetch('/api/attendance');
    },
    getStudent: async (studentId) => {
      return await apiFetch(`/api/attendance/${studentId}`);
    },
    update: async (studentId, body) => {
      return await apiFetch(`/api/attendance/${studentId}`, { method: 'PUT', body });
    },
    getByDate: async (date) => {
      return await apiFetch(`/api/attendance/date/${date}`);
    },
    updateByDate: async (date, body) => {
      return await apiFetch(`/api/attendance/date/${date}`, { method: 'POST', body: { attendance: body } });
    },
  },
  marks: {
    forStudent: async (studentId) => {
      return await apiFetch(`/api/marks?studentId=${studentId}`);
    },
    all: async () => {
      return await apiFetch('/api/marks');
    },
    add: async (body) => {
      return await apiFetch('/api/marks', { method: 'POST', body });
    },
    delete: async (id) => {
      return await apiFetch(`/api/marks/${id}`, { method: 'DELETE' });
    },
    update: async (id, body) => {
      return await apiFetch(`/api/marks/${id}`, { method: 'PUT', body });
    },
  },
  notes: {
    all: async () => {
      return await apiFetch('/api/notes');
    },
    get: async (studentId) => {
      return await apiFetch(`/api/notes/${studentId}`);
    },
    add: async (body) => {
      return await apiFetch('/api/notes', { method: 'POST', body });
    },
    update: async (id, body) => {
      return await apiFetch(`/api/notes/${id}`, { method: 'PUT', body });
    },
    delete: async (id) => {
      return await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
    },
  },
  export: {
    marks: async () => {
      return await apiFetch('/api/export/marks');
    },
    assignments: async () => {
      return await apiFetch('/api/export/assignments');
    },
  },
};

// Toast notification utility
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function createToastContainer() {
  const el = document.createElement('div');
  el.id = 'toastContainer';
  el.className = 'toast-container';
  document.body.appendChild(el);
  return el;
}

// Dark mode utility (Disabled - Force Light mode)
function applyDarkMode(isDark) {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.setItem('darkMode', 'light');
}

function loadDarkMode() {
  applyDarkMode(false);
  return false;
}

// Auto-run theme loaders
loadDarkMode();

// Format date utility
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dateStr) {
  return new Date(dateStr) < new Date();
}

function isDueSoon(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // 3 days
}

// Get initials
function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
