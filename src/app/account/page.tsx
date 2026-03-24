"use client";

import { useState } from 'react';
import Balance from '@/components/Balance';
import AuthPanel from '@/components/AuthPanel';
import { AuthSession, loadAuthSession } from '@/lib/authSession';

export default function Account() {
  const [session, setSession] = useState<AuthSession | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return loadAuthSession();
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Account Dashboard</h1>
        <AuthPanel onSessionChange={setSession} />
        {session ? (
          <Balance />
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-300">Sign in to view your account balance and portfolio details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
