'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import { type CreateAccountResponse, type TradingAccount } from '@/lib/account';
import { type AuthSession } from '@/lib/authSession';
import { useDeveloperMode } from '@/lib/developerMode';

interface AccountListProps {
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
      // fall through
    }
  }
  const text = await response.text();
  return text || `Request failed with ${response.status}`;
};

export default function AccountList({ session }: AccountListProps) {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [newAccountName, setNewAccountName] = useState('Primary');
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devMode] = useDeveloperMode();

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
      setAccounts(Array.isArray(rawPayload) ? rawPayload : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  }, [session.access_token, session.token_type]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

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
      setNewAccountName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setCreatingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Your accounts</h2>
            <p className="mt-1 text-sm text-gray-400">
              Pick an account to view balances and YTD performance, or create a new one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchAccounts()}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        <form onSubmit={handleCreateAccount} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-400">
              New account name
            </label>
            <input
              type="text"
              required
              value={newAccountName}
              onChange={(event) => setNewAccountName(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Primary"
            />
          </div>
          <button
            type="submit"
            disabled={creatingAccount || newAccountName.trim().length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingAccount ? 'Creating…' : 'Create account'}
          </button>
        </form>

        {(error || success) && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              error
                ? 'border-red-500/30 bg-red-500/10 text-red-200'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            {error || success}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
        <h3 className="text-base font-semibold text-white">Linked accounts</h3>
        <div className="mt-4">
          {loadingAccounts ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-400">
              No accounts yet. Create one above to continue.
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <Link
                  key={account.account_id}
                  href={`/account/${account.account_id}`}
                  className="block rounded-xl border border-white/5 bg-black/30 p-4 transition hover:border-white/20 hover:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{account.name}</p>
                      {devMode && (
                        <p className="mt-0.5 text-xs text-gray-500">{account.account_id}</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        account.broker_linked
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          account.broker_linked ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      {account.broker_linked ? 'Broker linked' : 'Needs broker'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
