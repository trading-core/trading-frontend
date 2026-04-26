"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AccountList from '@/components/AccountList';
import AuthPanel from '@/components/AuthPanel';
import { AUTH_SESSION_CHANGED_EVENT, AuthSession, loadAuthSession } from '@/lib/authSession';

export default function Account() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const refreshSession = () => {
      setSession(loadAuthSession());
      setIsReady(true);
    };
    refreshSession();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
  }, []);

  // OAuth callback lands on /account; forward to the relevant account detail
  // so the broker linking flow continues there.
  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const accountID = params.get('oauth_account_id');
    if (!accountID) return;
    router.replace(`/account/${accountID}?${params.toString()}`);
  }, [router, session]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-black p-6 text-white sm:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-gray-400">
            Pick an account to view its dashboard, or create a new one.
          </p>
        </header>

        {!session && <AuthPanel onSessionChange={setSession} />}

        {!isReady ? (
          <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-8 text-center">
            <p className="text-sm text-gray-400">Loading your session…</p>
          </div>
        ) : session ? (
          <AccountList session={session} />
        ) : (
          <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-8 text-center">
            <p className="text-sm text-gray-300">
              Sign in to manage your accounts, link a broker, and view balances.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
