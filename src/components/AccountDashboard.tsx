'use client';

import { useCallback, useEffect, useState } from 'react';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import { type CreateAccountResponse, type TradingAccount } from '@/lib/account';
import { type AuthSession } from '@/lib/authSession';
import Balance from '@/components/Balance';

interface AccountDashboardProps {
  session: AuthSession;
}

const getErrorMessage = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      const message = payload.user_message ?? payload.message ?? payload.error;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    } catch {
      // Fall back to plain text below.
    }
  }
  const text = await response.text();
  return text || `Request failed with ${response.status}`;
};

export default function AccountDashboard({ session }: AccountDashboardProps) {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountID, setSelectedAccountID] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState('Primary');
  const [tastyTradeID, setTastyTradeID] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [linkingBroker, setLinkingBroker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setError(null);
    try {
      const response = await fetch(apiUrl(ACCOUNT_SERVICE_BASE_URL, '/accounts/v1/accounts'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${session.token_type} ${session.access_token}`,
        },
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      const rawPayload = (await response.json()) as TradingAccount[] | null;
      const payload = Array.isArray(rawPayload) ? rawPayload : [];
      setAccounts(payload);
      setSelectedAccountID((current) => {
        if (payload.length === 0) {
          return null;
        }
        if (current && payload.some((account) => account.account_id === current)) {
          return current;
        }
        return payload[0].account_id;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  }, [session.access_token, session.token_type]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const selectedAccount = accounts.find((account) => account.account_id === selectedAccountID) ?? null;

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingAccount(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(apiUrl(ACCOUNT_SERVICE_BASE_URL, '/accounts/v1/accounts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${session.token_type} ${session.access_token}`,
        },
        body: JSON.stringify({ account_name: newAccountName.trim() }),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      const created = (await response.json()) as CreateAccountResponse;
      setSuccess(`Created account ${created.account_name}.`);
      await fetchAccounts();
      setSelectedAccountID(created.account_id);
      setNewAccountName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleLinkBroker = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAccount) {
      return;
    }
    setLinkingBroker(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${selectedAccount.account_id}/broker`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `${session.token_type} ${session.access_token}`,
          },
          body: JSON.stringify({
            type: 'tastytrade',
            tastytrade: {
              id: tastyTradeID.trim(),
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      setSuccess(`Linked broker account ${tastyTradeID.trim()}.`);
      setTastyTradeID('');
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link broker account.');
    } finally {
      setLinkingBroker(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Your Accounts</h2>
            <p className="text-sm text-gray-400">User ID: {session.user_id}</p>
          </div>
          <button
            type="button"
            onClick={() => void fetchAccounts()}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition"
          >
            Refresh
          </button>
        </div>

        <form onSubmit={handleCreateAccount} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-300 mb-1">New account name</label>
            <input
              type="text"
              required
              value={newAccountName}
              onChange={(event) => setNewAccountName(event.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-600 bg-gray-900 text-white"
              placeholder="Primary"
            />
          </div>
          <button
            type="submit"
            disabled={creatingAccount || newAccountName.trim().length === 0}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition"
          >
            {creatingAccount ? 'Creating...' : 'Create account'}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        {success && <p className="mt-4 text-sm text-green-300">{success}</p>}
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Account List</h3>
        {loadingAccounts ? (
          <p className="text-gray-400">Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <p className="text-gray-400">No accounts yet. Create one to continue.</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => {
              const isSelected = account.account_id === selectedAccountID;
              return (
                <button
                  key={account.account_id}
                  type="button"
                  onClick={() => setSelectedAccountID(account.account_id)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/40'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{account.name}</p>
                      <p className="text-xs text-gray-400">{account.account_id}</p>
                    </div>
                    <span
                      className={`text-xs uppercase tracking-wide ${
                        account.broker_linked ? 'text-green-300' : 'text-amber-300'
                      }`}
                    >
                      {account.broker_linked ? 'Broker linked' : 'Needs broker'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedAccount && (
        <div className="space-y-6">
          {!selectedAccount.broker_linked ? (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-xl font-semibold text-white mb-2">Link Tastytrade Broker</h3>
              <p className="text-sm text-gray-400 mb-4">
                Link a broker account before requesting balances for {selectedAccount.name}.
              </p>
              <form onSubmit={handleLinkBroker} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="block text-sm text-gray-300 mb-1">Tastytrade account ID</label>
                  <input
                    type="text"
                    required
                    value={tastyTradeID}
                    onChange={(event) => setTastyTradeID(event.target.value)}
                    className="w-full px-3 py-2 rounded border border-gray-600 bg-gray-900 text-white"
                    placeholder="5WT00000"
                  />
                </div>
                <button
                  type="submit"
                  disabled={linkingBroker || tastyTradeID.trim().length === 0}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white transition"
                >
                  {linkingBroker ? 'Linking...' : 'Link broker'}
                </button>
              </form>
            </div>
          ) : (
            <Balance account={selectedAccount} session={session} />
          )}
        </div>
      )}
    </div>
  );
}