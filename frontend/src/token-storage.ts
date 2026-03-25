const TOKEN_KEY = 'sc_booking_token';

export function setAuthToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}
