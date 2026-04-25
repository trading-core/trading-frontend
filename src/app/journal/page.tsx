'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import JournalCalendar from '@/components/JournalCalendar';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import { type TradingAccount } from '@/lib/account';
import {
  AUTH_SESSION_CHANGED_EVENT,
  loadAuthSession,
  type AuthSession,
} from '@/lib/authSession';

const ALL_ACCOUNTS = '__all__';

export default function JournalPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selection, setSelection] = useState<string>(ALL_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setSession(loadAuthSession());
    };
    refresh();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl(ACCOUNT_SERVICE_BASE_URL, '/accounts/v1/accounts'), {
        headers: { Authorization: `${session.token_type} ${session.access_token}` },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const list = (await response.json()) as TradingAccount[];
      setAccounts(list);
    } catch (loadErr) {
      setError((loadErr as Error).message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const authorization = session
    ? `${session.token_type} ${session.access_token}`
    : null;

  const linkedAccounts = useMemo(
    () => accounts.filter((account) => account.broker_linked),
    [accounts]
  );

  const pnlAccountIDs = useMemo(() => {
    if (linkedAccounts.length === 0) return [];
    if (selection === ALL_ACCOUNTS) {
      return linkedAccounts.map((account) => account.account_id);
    }
    return linkedAccounts.some((account) => account.account_id === selection)
      ? [selection]
      : [];
  }, [linkedAccounts, selection]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Trading Journal</h1>
          {linkedAccounts.length > 0 && (
            <select
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {linkedAccounts.length > 1 && (
                <option value={ALL_ACCOUNTS}>All accounts ({linkedAccounts.length})</option>
              )}
              {linkedAccounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {!authorization ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-300">Sign in to use the journal.</p>
          </div>
        ) : loading ? (
          <p className="text-gray-400">Loading accounts…</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : accounts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-300">
              No accounts yet. Create one on the Account page — journal entries are keyed by date,
              not account, but PnL comes from the linked broker.
            </p>
          </div>
        ) : (
          <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
            <JournalCalendar
              authorization={authorization}
              pnlAccountIDs={pnlAccountIDs}
            />
          </div>
        )}
      </div>
    </div>
  );
}
