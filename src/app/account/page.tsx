"use client";

import { useEffect, useState } from 'react';
import AccountDashboard from '@/components/AccountDashboard';
import AuthPanel from '@/components/AuthPanel';
import { AUTH_SESSION_CHANGED_EVENT, AuthSession, loadAuthSession } from '@/lib/authSession';

export default function Account() {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Account Dashboard</h1>
        <AuthPanel onSessionChange={setSession} />
        {!isReady ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-300">Loading your session...</p>
          </div>
        ) : session ? (
          <AccountDashboard session={session} />
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-300">Sign in to manage your accounts, link a broker, and view balances.</p>
          </div>
        )}
      </div>
    </div>
  );
}
