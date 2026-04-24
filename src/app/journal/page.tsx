'use client';

import { useCallback, useEffect, useState } from 'react';
import JournalCalendar from '@/components/JournalCalendar';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import { type TradingAccount } from '@/lib/account';
import {
  AUTH_SESSION_CHANGED_EVENT,
  loadAuthSession,
  type AuthSession,
} from '@/lib/authSession';

export default function JournalPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountID, setSelectedAccountID] = useState<string | null>(null);
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
      if (list.length > 0 && !selectedAccountID) {
        const brokerLinked = list.find((account) => account.broker_linked);
        setSelectedAccountID((brokerLinked ?? list[0]).account_id);
      }
    } catch (loadErr) {
      setError((loadErr as Error).message);
    } finally {
      setLoading(false);
    }
  }, [session, selectedAccountID]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const authorization = session
    ? `${session.token_type} ${session.access_token}`
    : null;

  const selectedAccount = accounts.find((account) => account.account_id === selectedAccountID);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Trading Journal</h1>
          {accounts.length > 1 && (
            <select
              value={selectedAccountID ?? ''}
              onChange={(event) => setSelectedAccountID(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name} {account.broker_linked ? '' : '(no broker)'}
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
              accountID={selectedAccountID}
              brokerLinked={selectedAccount?.broker_linked ?? false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
