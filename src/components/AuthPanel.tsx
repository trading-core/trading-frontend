'use client';

import { useEffect, useMemo, useState } from 'react';
import { AUTH_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import {
  AUTH_SESSION_STORAGE_KEY,
  AuthSession,
  loadAuthSession,
  dispatchSessionChanged,
} from '@/lib/authSession';
import { useDeveloperMode } from '@/lib/developerMode';

interface AuthPanelProps {
  onSessionChange?: (session: AuthSession | null) => void;
}

const PENDING_BROKER_SELECTION_STORAGE_KEY = 'pending-broker-selection';

export default function AuthPanel({ onSessionChange }: AuthPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [devMode] = useDeveloperMode();

  useEffect(() => {
    const parsed = loadAuthSession();
    setSession(parsed);
    onSessionChange?.(parsed);
  }, [onSessionChange]);

  const submitButtonLabel = useMemo(() => {
    if (isLoading) {
      return isRegisterMode ? 'Creating account…' : 'Signing in…';
    }
    return isRegisterMode ? 'Create account' : 'Sign in';
  }, [isLoading, isRegisterMode]);

  const register = async () => {
    const response = await fetch(apiUrl(AUTH_SERVICE_BASE_URL, '/auth/v1/users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Failed with ${response.status}`);
    }
  };

  const login = async () => {
    const response = await fetch(apiUrl(AUTH_SERVICE_BASE_URL, '/auth/v1/sessions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Failed with ${response.status}`);
    }
    const output = (await response.json()) as AuthSession;
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(output));
    setSession(output);
    dispatchSessionChanged();
    onSessionChange?.(output);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isRegisterMode) {
        await register();
        setSuccess('Account created. Sign in to continue.');
        setIsRegisterMode(false);
      } else {
        await login();
        setSuccess('Signed in successfully.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(PENDING_BROKER_SELECTION_STORAGE_KEY);
    setSession(null);
    dispatchSessionChanged();
    onSessionChange?.(null);
    setSuccess('Signed out.');
    setError(null);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
      {session ? (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">Signed in as</p>
            <p className="mt-1 text-lg font-medium text-white">{session.email}</p>
          </div>
          {devMode && (
            <div className="space-y-1 rounded-lg border border-white/5 bg-black/30 p-3 text-xs text-gray-400">
              <p>User ID: {session.user_id}</p>
              <p>Token expires: {new Date(session.expires_at).toLocaleString()}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/40 p-1">
            <button
              type="button"
              onClick={() => setIsRegisterMode(false)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                !isRegisterMode
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setIsRegisterMode(true)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                isRegisterMode
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Create account
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isRegisterMode ? 'At least 8 characters' : '••••••••'}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitButtonLabel}
          </button>
        </form>
      )}

      {(error || success) && (
        <div
          className={`mt-5 rounded-lg border px-3 py-2 text-sm ${
            error
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {error || success}
        </div>
      )}

      {devMode && (
        <p className="mt-5 truncate text-center text-[11px] text-gray-500">
          {AUTH_SERVICE_BASE_URL}
        </p>
      )}
    </div>
  );
}
