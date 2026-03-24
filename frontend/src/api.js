/**
 * 开发 / vite preview：VITE_API_BASE_URL 留空 → 走 Vite 代理（同源 /api → 后端）
 * 生产静态站：同源且 Nginx 反代 /api 时留空；否则填后端根地址，如 https://api.example.com
 * （不要填 .../api，否则会与 request('/api/...') 拼成 /api/api/... 导致 404）
 */
function resolveApiBaseUrl() {
  const h = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  const v = import.meta.env.VITE_API_BASE_URL;
  const trimmed = v === undefined || v === null ? '' : String(v).trim();

  if (trimmed === '') {
    // 开发、vite preview 均有 Vite 代理；生产留空则假定 Nginx 等同源反代 /api
    return '';
  }

  let base = trimmed.replace(/\/$/, '');
  if (base.endsWith('/api')) base = base.slice(0, -4);
  return base;
}

const API_BASE_URL = resolveApiBaseUrl();

const TOKEN_KEY = 'sc_booking_token';
const USER_KEY = 'sc_booking_user';

export function setAuthToken(token) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    const msg = data?.error || `Request failed: ${res.status}`;
    const err = new Error(msg);
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login(body) {
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },
  me() {
    return request('/api/auth/me');
  },
  listBookings(params) {
    const usp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      usp.set(k, String(v));
    });
    const qs = usp.toString();
    return request(`/api/bookings${qs ? `?${qs}` : ''}`);
  },
  createBooking(body) {
    return request('/api/bookings', { method: 'POST', body: JSON.stringify(body) });
  },
  updateBooking(id, body) {
    return request(`/api/bookings/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deleteBooking(id) {
    return request(`/api/bookings/${id}`, { method: 'DELETE' });
  },
  reassignExperimenter(body) {
    return request('/api/bookings/reassign-experimenter', { method: 'POST', body: JSON.stringify(body) });
  },
  getAnalytics() {
    return request('/api/analytics');
  },
  listExperimenters() {
    return request('/api/experimenters');
  },
  createExperimenter(body) {
    return request('/api/experimenters', { method: 'POST', body: JSON.stringify(body) });
  },
  updateExperimenter(id, body) {
    return request(`/api/experimenters/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deleteExperimenter(id) {
    return request(`/api/experimenters/${id}`, { method: 'DELETE' });
  },
  listUsers() {
    return request('/api/users');
  },
  createUser(body) {
    return request('/api/users', { method: 'POST', body: JSON.stringify(body) });
  },
  updateUser(id, body) {
    return request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deleteUser(id) {
    return request(`/api/users/${id}`, { method: 'DELETE' });
  },
  restoreUser(id) {
    return request(`/api/users/${id}/restore`, { method: 'PUT' });
  },
  resetUserPassword(id, newPassword) {
    return request(`/api/users/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword }) });
  },
  listRoles() {
    return request('/api/roles');
  },
  roleMeta() {
    return request('/api/roles/meta');
  },
  createRole(body) {
    return request('/api/roles', { method: 'POST', body: JSON.stringify(body) });
  },
  updateRole(id, body) {
    return request(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deleteRole(id) {
    return request(`/api/roles/${id}`, { method: 'DELETE' });
  },
  exportBookingsUrl(params) {
    const usp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      usp.set(k, String(v));
    });
    const qs = usp.toString();
    return `${API_BASE_URL}/api/export/bookings.xlsx${qs ? `?${qs}` : ''}`;
  },
  getCalendarSummary() {
    return request('/api/calendar/summary');
  },
  getCalendarDay(date) {
    const usp = new URLSearchParams();
    usp.set('date', String(date));
    return request(`/api/calendar/day?${usp.toString()}`);
  },
  listSeqTypes() {
    return request('/api/seq-types');
  },
  createSeqType(body) {
    return request('/api/seq-types', { method: 'POST', body: JSON.stringify(body) });
  },
  deleteSeqType(id) {
    return request(`/api/seq-types/${id}`, { method: 'DELETE' });
  },
  listPmOwners() {
    return request('/api/pm-owners');
  },
  createPmOwner(body) {
    return request('/api/pm-owners', { method: 'POST', body: JSON.stringify(body) });
  },
  updatePmOwner(id, body) {
    return request(`/api/pm-owners/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deletePmOwner(id) {
    return request(`/api/pm-owners/${id}`, { method: 'DELETE' });
  }
};

