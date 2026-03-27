export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_at: string;
  user_id: string;
  email: string;
}

export const AUTH_SESSION_STORAGE_KEY = 'trading.auth.session';
export const AUTH_SESSION_CHANGED_EVENT = 'trading.auth.session.changed';

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
