import { getAuthToken, setAuthToken } from './api';

const USER_KEY = 'sc_booking_user';

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  if (!user) localStorage.removeItem(USER_KEY);
  else localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isLoggedIn() {
  return Boolean(getAuthToken());
}

export function logout() {
  setAuthToken(null);
  setCurrentUser(null);
}

export function can(permission) {
  const user = getCurrentUser();
  const perms = Array.isArray(user?.permissions)
    ? user.permissions
    : (user?.role === 'admin'
        ? ['*']
        : ['booking:create', 'booking:update', 'booking:read', 'booking:export', 'analytics:read', 'experimenter:read']);
  return perms.includes('*') || perms.includes(permission);
}

