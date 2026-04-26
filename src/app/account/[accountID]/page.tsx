"use client";

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AccountDetail from '@/components/AccountDetail';
import { AUTH_SESSION_CHANGED_EVENT, AuthSession, loadAuthSession } from '@/lib/authSession';

type AccountDetailPageProps = {
  params: Promise<{
    accountID: string;
  }>;
};

export default function AccountDetailPage({ params }: AccountDetailPageProps) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const { accountID } = use(params);

  useEffect(() => {
    const refreshSession = () => {
      const next = loadAuthSession();
      setSession(next);
      setIsReady(true);
      if (!next) {
        router.replace('/account');
      }
    };
    refreshSession();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-black p-6 text-white sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {!isReady ? (
          <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-8 text-center">
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : session ? (
          <AccountDetail session={session} accountID={accountID} />
        ) : null}
      </div>
    </div>
  );
}
