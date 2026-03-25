'use client';

import { useEffect, useMemo, useState } from 'react';
import { AUTH_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import {
  AUTH_SESSION_STORAGE_KEY,
  AuthSession,
  loadAuthSession,
  dispatchSessionChanged,
} from '@/lib/authSession';

interface AuthPanelProps {
  onSessionChange?: (session: AuthSession | null) => void;
}

export default function AuthPanel({ onSessionChange }: AuthPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const parsed = loadAuthSession();
    setSession(parsed);
    onSessionChange?.(parsed);
  }, [onSessionChange]);

  const submitButtonLabel = useMemo(() => {
    if (isLoading) {
      return isRegisterMode ? 'Creating account...' : 'Signing in...';
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
    setSession(null);
    dispatchSessionChanged();
    onSessionChange?.(null);
    setSuccess('Signed out.');
    setError(null);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Auth</h2>
        <span className="text-xs text-gray-400">{AUTH_SERVICE_BASE_URL}</span>
      </div>

      {session ? (
        <div className="space-y-3">
          <p className="text-green-300 font-medium">Signed in as {session.email}</p>
          <p className="text-gray-400 text-sm">Account ID: {session.account_id}</p>
          <p className="text-gray-400 text-sm">Token expires: {new Date(session.expires_at).toLocaleString()}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition"
          >
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsRegisterMode(true)}
              className={`px-3 py-1.5 rounded text-sm ${isRegisterMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setIsRegisterMode(false)}
              className={`px-3 py-1.5 rounded text-sm ${!isRegisterMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Login
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-600 bg-gray-900 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-600 bg-gray-900 text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition"
          >
            {submitButtonLabel}
          </button>
        </form>
      )}

      {error && <p className="mt-4 text-red-300 text-sm">{error}</p>}
      {success && <p className="mt-4 text-green-300 text-sm">{success}</p>}
    </div>
  );
}
