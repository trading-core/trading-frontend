'use client';

import { useCallback, useEffect, useState } from 'react';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import { type CreateAccountResponse, type TradingAccount } from '@/lib/account';
import { type AuthSession } from '@/lib/authSession';
import Balance from '@/components/Balance';

interface AccountDashboardProps {
  session: AuthSession;
}

type SupportedBroker = 'tastytrade';

const SUPPORTED_BROKERS: Array<{ value: SupportedBroker; label: string }> = [
  { value: 'tastytrade', label: 'Tastytrade' },
];

interface PendingBrokerSelection {
  broker_accounts: string[];
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
  const [selectedBroker, setSelectedBroker] = useState<SupportedBroker>('tastytrade');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingAccountID, setPendingAccountID] = useState<string | null>(null);
  const [pendingBrokerAccounts, setPendingBrokerAccounts] = useState<string[]>([]);
  const [selectedPendingBrokerAccountID, setSelectedPendingBrokerAccountID] = useState<string>('');
  const [loadingPendingBrokerAccounts, setLoadingPendingBrokerAccounts] = useState(false);
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

  // Handle OAuth callback query params written by the backend redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const oauthPending = params.get('oauth_pending');
    const oauthAccountID = params.get('oauth_account_id');
    if (oauthSuccess) {
      setSuccess('Broker account linked successfully.');
      window.history.replaceState({}, '', window.location.pathname);
      void fetchAccounts();
    } else if (oauthPending && oauthAccountID) {
      setPendingToken(oauthPending);
      setPendingAccountID(oauthAccountID);
      setSelectedAccountID(oauthAccountID);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthPending) {
      setError('Broker callback is missing the account context. Please try connecting again.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthError) {
      setError(`Failed to connect broker: ${oauthError.replace(/_/g, ' ')}.`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchAccounts]);

  useEffect(() => {
    if (!pendingToken || !pendingAccountID) {
      setPendingBrokerAccounts([]);
      setSelectedPendingBrokerAccountID('');
      return;
    }

    const fetchPendingBrokerAccounts = async () => {
      setLoadingPendingBrokerAccounts(true);
      setError(null);
      try {
        const response = await fetch(
          apiUrl(
            ACCOUNT_SERVICE_BASE_URL,
            `/accounts/v1/accounts/${pendingAccountID}/brokers?pending_token=${encodeURIComponent(pendingToken)}`,
          ),
          {
            method: 'GET',
            headers: {
              Authorization: `${session.token_type} ${session.access_token}`,
            },
          },
        );
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }
        const payload = (await response.json()) as PendingBrokerSelection;
        setPendingBrokerAccounts(payload.broker_accounts);
        setSelectedPendingBrokerAccountID(payload.broker_accounts[0] ?? '');
      } catch (err) {
        setPendingToken(null);
        setPendingAccountID(null);
        setPendingBrokerAccounts([]);
        setSelectedPendingBrokerAccountID('');
        setError(err instanceof Error ? err.message : 'Failed to load broker accounts.');
      } finally {
        setLoadingPendingBrokerAccounts(false);
      }
    };

    void fetchPendingBrokerAccounts();
  }, [pendingToken, pendingAccountID, session.access_token, session.token_type]);

  const selectedAccount = accounts.find((account) => account.account_id === selectedAccountID) ?? null;
  const pendingLinkAccount = accounts.find((account) => account.account_id === pendingAccountID) ?? selectedAccount;

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

  const handleConnectBroker = async () => {
    if (!selectedAccount) {
      return;
    }
    setLinkingBroker(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${selectedAccount.account_id}/brokers`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `${session.token_type} ${session.access_token}`,
          },
          body: JSON.stringify({ broker: selectedBroker }),
        },
      );
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      const data = (await response.json()) as { authorization_url: string };
      // Redirect the browser to Tastytrade's authorization page.
      window.location.href = data.authorization_url;
      // Do not reset linkingBroker — the page is navigating away.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start broker connection.');
      setLinkingBroker(false);
    }
  };

  const handleConfirmBrokerSelection = async () => {
    if (!pendingToken || !pendingAccountID || !selectedPendingBrokerAccountID) {
      return;
    }
    setLinkingBroker(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${pendingAccountID}/brokers`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${session.token_type} ${session.access_token}`,
        },
        body: JSON.stringify({
          pending_token: pendingToken,
          broker_account_id: selectedPendingBrokerAccountID,
        }),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      setPendingToken(null);
      setPendingAccountID(null);
      setPendingBrokerAccounts([]);
      setSelectedPendingBrokerAccountID('');
      setSuccess('Broker account linked successfully.');
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
          {pendingToken && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-xl font-semibold text-white mb-2">Choose Tastytrade Account</h3>
              <p className="text-sm text-gray-400 mb-4">
                Your Tastytrade login has multiple accounts. Choose which broker account to link to{' '}
                {pendingLinkAccount?.name ?? 'the selected trading account'}.
              </p>
              {pendingLinkAccount && (
                <p className="text-xs text-gray-500 mb-4">
                  Linking trading account {pendingLinkAccount.name} ({pendingLinkAccount.account_id})
                </p>
              )}
              {loadingPendingBrokerAccounts ? (
                <p className="text-gray-400">Loading available broker accounts...</p>
              ) : pendingBrokerAccounts.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-amber-300">
                    No broker accounts were returned for this authorization. Try reconnecting the broker.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingToken(null);
                      setPendingAccountID(null);
                      setPendingBrokerAccounts([]);
                      setSelectedPendingBrokerAccountID('');
                    }}
                    disabled={linkingBroker}
                    className="px-5 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white font-medium transition"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 max-w-sm">
                    <label className="block text-sm text-gray-300 mb-1">Broker account</label>
                    <select
                      value={selectedPendingBrokerAccountID}
                      onChange={(event) => setSelectedPendingBrokerAccountID(event.target.value)}
                      disabled={linkingBroker || pendingBrokerAccounts.length === 0}
                      className="w-full px-3 py-2 rounded border border-gray-600 bg-gray-900 text-white"
                    >
                      {pendingBrokerAccounts.map((brokerAccountID) => (
                        <option key={brokerAccountID} value={brokerAccountID}>
                          {brokerAccountID}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void handleConfirmBrokerSelection()}
                      disabled={linkingBroker || selectedPendingBrokerAccountID.length === 0}
                      className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium transition"
                    >
                      {linkingBroker ? 'Linking...' : 'Link selected account'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingToken(null);
                        setPendingAccountID(null);
                        setPendingBrokerAccounts([]);
                        setSelectedPendingBrokerAccountID('');
                      }}
                      disabled={linkingBroker}
                      className="px-5 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {!selectedAccount.broker_linked ? (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-xl font-semibold text-white mb-2">Connect Broker</h3>
              <p className="text-sm text-gray-400 mb-4">
                Choose a broker and authorize to securely link it to{' '}
                {selectedAccount.name}.
              </p>
              <div className="mb-4 max-w-sm">
                <label className="block text-sm text-gray-300 mb-1">Broker</label>
                <select
                  value={selectedBroker}
                  onChange={(event) => setSelectedBroker(event.target.value as SupportedBroker)}
                  disabled={linkingBroker}
                  className="w-full px-3 py-2 rounded border border-gray-600 bg-gray-900 text-white"
                >
                  {SUPPORTED_BROKERS.map((brokerOption) => (
                    <option key={brokerOption.value} value={brokerOption.value}>
                      {brokerOption.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void handleConnectBroker()}
                disabled={linkingBroker || pendingToken !== null}
                className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium transition"
              >
                {linkingBroker ? 'Redirecting...' : 'Connect broker'}
              </button>
            </div>
          ) : (
            <Balance account={selectedAccount} session={session} />
          )}
        </div>
      )}
    </div>
  );
}