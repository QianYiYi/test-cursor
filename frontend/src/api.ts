import type { User } from './auth';
import type { HttpError } from './lib/http-error';
import { getAuthToken } from './token-storage';

export { getAuthToken, setAuthToken } from './token-storage';

/**
 * 开发 / vite preview：VITE_API_BASE_URL 留空 → 走 Vite 代理（同源 /api → 后端）
 * 生产静态站：同源且 Nginx 反代 /api 时留空；否则填后端根地址，如 https://api.example.com
 * （不要填 .../api，否则会与 request('/api/...') 拼成 /api/api/... 导致 404）
 */
function resolveApiBaseUrl() {
  const v = import.meta.env.VITE_API_BASE_URL;
  const trimmed = v === undefined || v === null ? '' : String(v).trim();

  if (trimmed === '') {
    return '';
  }

  let base = trimmed.replace(/\/$/, '');
  if (base.endsWith('/api')) {
    base = base.slice(0, -4);
  }
  return base;
}

const API_BASE_URL = resolveApiBaseUrl();

const TOKEN_KEY = 'sc_booking_token';
const USER_KEY = 'sc_booking_user';

export interface ListBookingsParams {
  page?: number;
  pageSize?: number;
  salesName?: string;
  contractNo?: string;
  customerUnit?: string;
  customerName?: string;
  needDissociation?: string;
  sampleInfo?: string;
  experimenter?: string;
  sampleCount?: string;
  seqType?: string;
  pmOwner?: string;
  platform?: string;
  status?: string;
  visitFrom?: string;
  visitTo?: string;
}

export type BookingPayload = Record<string, unknown>;

export interface BookingRow extends Record<string, unknown> {
  id: number;
  status?: string;
  customerUnit?: string;
  customerName?: string;
  visitTime?: string;
  serviceEndTime?: string;
  seqType?: string;
  platform?: string;
  sampleCount?: number;
}

export interface ListBookingsResult {
  items: BookingRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: User;
}

export interface MeResult {
  user: User;
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
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
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const msg = typeof obj.error === 'string' ? obj.error : `Request failed: ${res.status}`;
    const err = new Error(msg) as HttpError;
    err.status = res.status;
    err.data = data as HttpError['data'];
    throw err;
  }
  return data as T;
}

export const api = {
  login(body: LoginBody) {
    return request<LoginResult>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },
  me() {
    return request<MeResult>('/api/auth/me');
  },
  listBookings(params: ListBookingsParams) {
    const usp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') {
        return;
      }
      usp.set(k, String(v));
    });
    const qs = usp.toString();
    return request<ListBookingsResult>(`/api/bookings${qs ? `?${qs}` : ''}`);
  },
  createBooking(body: BookingPayload) {
    return request<unknown>('/api/bookings', { method: 'POST', body: JSON.stringify(body) });
  },
  updateBooking(id: number, body: BookingPayload) {
    return request<unknown>(`/api/bookings/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deleteBooking(id: number) {
    return request<unknown>(`/api/bookings/${id}`, { method: 'DELETE' });
  },
  reassignExperimenter(body: BookingPayload) {
    return request<unknown>('/api/bookings/reassign-experimenter', { method: 'POST', body: JSON.stringify(body) });
  },
  getAnalytics() {
    return request<AnalyticsData>('/api/analytics');
  },
  listExperimenters() {
    return request<{ items: ExperimenterRow[] }>('/api/experimenters');
  },
  createExperimenter(body: BookingPayload) {
    return request<unknown>('/api/experimenters', { method: 'POST', body: JSON.stringify(body) });
  },
  updateExperimenter(id: number, body: BookingPayload) {
    return request<unknown>(`/api/experimenters/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deleteExperimenter(id: number) {
    return request<unknown>(`/api/experimenters/${id}`, { method: 'DELETE' });
  },
  listUsers() {
    return request<{ items: UserRow[] }>('/api/users');
  },
  createUser(body: BookingPayload) {
    return request<unknown>('/api/users', { method: 'POST', body: JSON.stringify(body) });
  },
  updateUser(id: number, body: BookingPayload) {
    return request<unknown>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deleteUser(id: number) {
    return request<unknown>(`/api/users/${id}`, { method: 'DELETE' });
  },
  restoreUser(id: number) {
    return request<unknown>(`/api/users/${id}/restore`, { method: 'PUT' });
  },
  resetUserPassword(id: number, newPassword: string) {
    return request<unknown>(`/api/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword })
    });
  },
  listRoles() {
    return request<{ items: RoleRow[] }>('/api/roles');
  },
  roleMeta() {
    return request<RoleMeta>('/api/roles/meta');
  },
  createRole(body: BookingPayload) {
    return request<unknown>('/api/roles', { method: 'POST', body: JSON.stringify(body) });
  },
  updateRole(id: number, body: BookingPayload) {
    return request<unknown>(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deleteRole(id: number) {
    return request<unknown>(`/api/roles/${id}`, { method: 'DELETE' });
  },
  exportBookingsUrl(params: ListBookingsParams) {
    const usp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') {
        return;
      }
      usp.set(k, String(v));
    });
    const qs = usp.toString();
    return `${API_BASE_URL}/api/export/bookings.xlsx${qs ? `?${qs}` : ''}`;
  },
  getCalendarSummary() {
    return request<CalendarSummary>('/api/calendar/summary');
  },
  getCalendarDay(date: string) {
    const usp = new URLSearchParams();
    usp.set('date', String(date));
    return request<CalendarDayResult>(`/api/calendar/day?${usp.toString()}`);
  },
  listSeqTypes() {
    return request<ListSeqTypesResult>('/api/seq-types');
  },
  createSeqType(body: BookingPayload) {
    return request<unknown>('/api/seq-types', { method: 'POST', body: JSON.stringify(body) });
  },
  deleteSeqType(id: number) {
    return request<unknown>(`/api/seq-types/${id}`, { method: 'DELETE' });
  },
  listPmOwners() {
    return request<{ items: PmOwnerRow[] }>('/api/pm-owners');
  },
  createPmOwner(body: BookingPayload) {
    return request<unknown>('/api/pm-owners', { method: 'POST', body: JSON.stringify(body) });
  },
  updatePmOwner(id: number, body: BookingPayload) {
    return request<unknown>(`/api/pm-owners/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },
  deletePmOwner(id: number) {
    return request<unknown>(`/api/pm-owners/${id}`, { method: 'DELETE' });
  }
};

export interface ExperimenterRow {
  id: number;
  name: string;
  email?: string | null;
  notifyMethods?: string[];
  isActive?: boolean;
}

export interface PmOwnerRow {
  id: number;
  name: string;
  email?: string | null;
  isActive?: boolean;
}

export interface UserRow extends Record<string, unknown> {
  id: number;
  name?: string;
  email?: string;
  roleName?: string;
  roleCode?: string;
  role?: string;
  roleId?: number;
  experimenterId?: number | null;
  experimenterName?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

export interface RoleRow extends Record<string, unknown> {
  id: number;
  name?: string;
  code?: string;
  description?: string;
  permissions?: string[];
  menus?: string[];
  isActive?: boolean;
}

export interface CalendarDayResult {
  companyOrderCount?: number;
  companySampleSum?: number;
  items?: BookingRow[];
}

export interface CalendarSummary {
  activeExperimenters?: number;
  days?: Array<{
    day: string;
    orderCount?: number;
    sampleSum?: number;
    remainingExperimenters?: number;
    busyLevel?: string;
  }>;
}

export interface ListSeqTypesResult {
  all: string[];
  custom?: Array<{ id: number; name: string }>;
}

export interface RoleMetaRow {
  method: string;
  path: string;
  permission: string;
}

export interface RoleMeta {
  permissionOptions: Array<{ code: string; label: string }>;
  menuOptions: Array<{ key: string; label: string }>;
  interfacePermissionMap?: RoleMetaRow[];
}

export interface AnalyticsData {
  status?: Array<{ label: string; count: number }>;
  seqType?: Array<{ seqType: string; count: number }>;
  platform?: Array<{ platform: string; count: number }>;
  trend?: Array<{ day: string; count: number }>;
  dailyCompany?: Array<{ day: string; count: number }>;
  insight?: string;
  personal?: {
    experimenter?: string;
    total?: number;
    done?: number;
    undone?: number;
    trend?: Array<{ day: string; count: number }>;
    seqType?: Array<{ seqType: string; count: number }>;
  };
}
