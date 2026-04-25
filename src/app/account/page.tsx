"use client";

import { useEffect, useState } from 'react';
import AccountDashboard from '@/components/AccountDashboard';
import AuthPanel from '@/components/AuthPanel';
import { AUTH_SESSION_CHANGED_EVENT, AuthSession, loadAuthSession } from '@/lib/authSession';
import { useDeveloperMode } from '@/lib/developerMode';

export default function Account() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [devMode, setDevMode] = useDeveloperMode();

  useEffect(() => {
    const refreshSession = () => {
      setSession(loadAuthSession());
      setIsReady(true);
    };

    refreshSession();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-black p-6 text-white sm:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage your sign-in, link a broker, and view balances.
          </p>
        </header>

        <AuthPanel onSessionChange={setSession} />

        {!isReady ? (
          <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-8 text-center">
            <p className="text-sm text-gray-400">Loading your session…</p>
          </div>
        ) : session ? (
          <AccountDashboard session={session} />
        ) : (
          <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-8 text-center">
            <p className="text-sm text-gray-300">
              Sign in to manage your accounts, link a broker, and view balances.
            </p>
          </div>
        )}

        {/* Settings */}
        <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Developer mode</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Show service URLs, account IDs, and other diagnostic details.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={devMode}
              onClick={() => setDevMode(!devMode)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                devMode ? 'bg-blue-600' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  devMode ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
