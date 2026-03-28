import { AUTH_SERVICE_BASE_URL, apiUrl } from './api';

export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_at: string;
  user_id: string;
  email: string;
}

export const AUTH_SESSION_STORAGE_KEY = 'trading.auth.session';
export const AUTH_SESSION_CHANGED_EVENT = 'trading.auth.session.changed';

// Refresh the token this many ms before expiry (5 minutes)
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export const dispatchSessionChanged = () => {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
};

export const loadAuthSession = (): AuthSession | null => {
  const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (new Date(parsed.expires_at).getTime() <= Date.now()) {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
};

export const saveAuthSession = (session: AuthSession) => {
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  dispatchSessionChanged();
};

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  dispatchSessionChanged();
};

export const getAuthorizationHeader = (): string | null => {
  const session = loadAuthSession();
  if (!session) {
    return null;
  }
  return `${session.token_type} ${session.access_token}`;
};

// Returns ms until token should be proactively refreshed (negative if already past threshold)
export const msUntilRefresh = (session: AuthSession): number => {
  const expiresAt = new Date(session.expires_at).getTime();
  return expiresAt - REFRESH_THRESHOLD_MS - Date.now();
};

export const refreshAuthSession = async (): Promise<AuthSession | null> => {
  const session = loadAuthSession();
  if (!session) {
    return null;
  }
  try {
    const response = await fetch(
      apiUrl(AUTH_SERVICE_BASE_URL, '/auth/v1/sessions/refresh'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${session.token_type} ${session.access_token}`,
        },
      }
    );
    if (!response.ok) {
      clearAuthSession();
      return null;
    }
    const newSession: AuthSession = await response.json();
    saveAuthSession(newSession);
    return newSession;
  } catch {
    return null;
  }
};
