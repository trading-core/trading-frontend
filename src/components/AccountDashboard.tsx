'use client';

import { useCallback, useEffect, useState } from 'react';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import { type CreateAccountResponse, type TradingAccount } from '@/lib/account';
import { type AuthSession } from '@/lib/authSession';
import Balance from '@/components/Balance';
import { useDeveloperMode } from '@/lib/developerMode';

interface AccountDashboardProps {
  session: AuthSession;
}

type SupportedBroker = 'tastytrade' | 'tastytrade_sandbox';

const SUPPORTED_BROKERS: Array<{ value: SupportedBroker; label: string }> = [
  { value: 'tastytrade', label: 'Tastytrade' },
  { value: 'tastytrade_sandbox', label: 'Tastytrade (Sandbox)' },
];

const PENDING_BROKER_SELECTION_STORAGE_KEY = 'pending-broker-selection';

interface PendingBrokerSelection {
  broker: SupportedBroker;
  broker_accounts: string[];
}

interface StoredPendingBrokerSelection {
  userID: string;
  pendingToken: string;
  pendingAccountID: string;
}

const formatBrokerLabel = (broker: SupportedBroker | null) => {
  return SUPPORTED_BROKERS.find((option) => option.value === broker)?.label ?? 'Broker';
};

const readStoredPendingBrokerSelection = (): StoredPendingBrokerSelection | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const rawValue = window.sessionStorage.getItem(PENDING_BROKER_SELECTION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredPendingBrokerSelection>;
    if (
      typeof parsed.userID !== 'string' ||
      typeof parsed.pendingToken !== 'string' ||
      typeof parsed.pendingAccountID !== 'string'
    ) {
      clearStoredPendingBrokerSelection();
      return null;
    }
    return {
      userID: parsed.userID,
      pendingToken: parsed.pendingToken,
      pendingAccountID: parsed.pendingAccountID,
    };
  } catch {
    clearStoredPendingBrokerSelection();
    return null;
  }
};

const writeStoredPendingBrokerSelection = (selection: StoredPendingBrokerSelection) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(PENDING_BROKER_SELECTION_STORAGE_KEY, JSON.stringify(selection));
};

const clearStoredPendingBrokerSelection = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(PENDING_BROKER_SELECTION_STORAGE_KEY);
};

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
  const [pendingBroker, setPendingBroker] = useState<SupportedBroker | null>(null);
  const [selectedPendingBrokerAccountID, setSelectedPendingBrokerAccountID] = useState<string>('');
  const [loadingPendingBrokerAccounts, setLoadingPendingBrokerAccounts] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [linkingBroker, setLinkingBroker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devMode] = useDeveloperMode();

  const clearPendingSelection = useCallback(() => {
    setPendingToken(null);
    setPendingAccountID(null);
    setPendingBroker(null);
    setPendingBrokerAccounts([]);
    setSelectedPendingBrokerAccountID('');
    clearStoredPendingBrokerSelection();
  }, []);

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
      clearPendingSelection();
      window.history.replaceState({}, '', window.location.pathname);
      void fetchAccounts();
    } else if (oauthPending && oauthAccountID) {
      setPendingToken(oauthPending);
      setPendingAccountID(oauthAccountID);
      setSelectedAccountID(oauthAccountID);
      writeStoredPendingBrokerSelection({
        userID: session.user_id,
        pendingToken: oauthPending,
        pendingAccountID: oauthAccountID,
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthPending) {
      setError('Broker callback is missing the account context. Please try connecting again.');
      clearPendingSelection();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthError) {
      setError(`Failed to connect broker: ${oauthError.replace(/_/g, ' ')}.`);
      clearPendingSelection();
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      const storedSelection = readStoredPendingBrokerSelection();
      if (!storedSelection) {
        return;
      }
      if (storedSelection.userID !== session.user_id) {
        clearStoredPendingBrokerSelection();
        return;
      }
      if (storedSelection) {
        setPendingToken(storedSelection.pendingToken);
        setPendingAccountID(storedSelection.pendingAccountID);
        setSelectedAccountID(storedSelection.pendingAccountID);
      }
    }
  }, [clearPendingSelection, fetchAccounts, session.user_id]);

  useEffect(() => {
    if (!pendingToken || !pendingAccountID) {
      setPendingBroker(null);
      setPendingBrokerAccounts([]);
      setSelectedPendingBrokerAccountID('');
      return;
    }
    if (loadingAccounts) {
      return;
    }
    const pendingAccount = accounts.find((account) => account.account_id === pendingAccountID);
    if (pendingAccount?.broker_linked) {
      clearPendingSelection();
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
          if (response.status === 403 || response.status === 404) {
            throw new Error('Your broker authorization session is no longer available. Please connect your broker again.');
          }
          throw new Error(await getErrorMessage(response));
        }
        const payload = (await response.json()) as PendingBrokerSelection;
        setPendingBroker(payload.broker);
        setPendingBrokerAccounts(payload.broker_accounts);
        setSelectedPendingBrokerAccountID(payload.broker_accounts[0] ?? '');
      } catch (err) {
        clearPendingSelection();
        setError(err instanceof Error ? err.message : 'Failed to load broker accounts.');
      } finally {
        setLoadingPendingBrokerAccounts(false);
      }
    };

    void fetchPendingBrokerAccounts();
  }, [accounts, clearPendingSelection, loadingAccounts, pendingAccountID, pendingToken, session.access_token, session.token_type]);

  // Guard: if the pending account is already broker-linked (e.g. restored from router cache
  // after a successful confirmation), clear the stale pending state rather than re-fetching
  // with a deleted token.
  useEffect(() => {
    if (!pendingAccountID) return;
    const pendingAcc = accounts.find((a) => a.account_id === pendingAccountID);
    if (pendingAcc?.broker_linked) {
      clearPendingSelection();
    }
  }, [accounts, clearPendingSelection, pendingAccountID]);

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
        if (response.status === 403 || response.status === 404) {
          clearPendingSelection();
          void fetchAccounts();
          throw new Error('Your broker authorization session is no longer available. Please connect your broker again.');
        }
        throw new Error(await getErrorMessage(response));
      }
      clearPendingSelection();
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
      <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Your accounts</h2>
            {devMode && (
              <p className="mt-1 text-xs text-gray-500">User ID: {session.user_id}</p>
            )}
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
              {accounts.map((account) => {
                const isSelected = account.account_id === selectedAccountID;
                return (
                  <button
                    key={account.account_id}
                    type="button"
                    onClick={() => setSelectedAccountID(account.account_id)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-blue-500/60 bg-blue-500/10'
                        : 'border-white/5 bg-black/30 hover:border-white/20 hover:bg-white/5'
                    }`}
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
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedAccount && (
        <div className="space-y-6">
          {pendingToken && (
            <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
              <h3 className="text-base font-semibold text-white">
                Choose {formatBrokerLabel(pendingBroker)} account
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                Your {formatBrokerLabel(pendingBroker)} login has multiple accounts. Choose which broker account to link to{' '}
                {pendingLinkAccount?.name ?? 'the selected trading account'}.
              </p>
              {devMode && pendingLinkAccount && (
                <p className="mt-2 text-xs text-gray-500">
                  Linking trading account {pendingLinkAccount.name} ({pendingLinkAccount.account_id})
                </p>
              )}
              <div className="mt-4">
                {loadingPendingBrokerAccounts ? (
                  <p className="text-sm text-gray-400">Loading available broker accounts…</p>
                ) : pendingBrokerAccounts.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-amber-300">
                      No broker accounts were returned for this authorization. Try reconnecting the broker.
                    </p>
                    <button
                      type="button"
                      onClick={() => clearPendingSelection()}
                      disabled={linkingBroker}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 max-w-sm">
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-400">
                        Broker account
                      </label>
                      <select
                        value={selectedPendingBrokerAccountID}
                        onChange={(event) => setSelectedPendingBrokerAccountID(event.target.value)}
                        disabled={linkingBroker || pendingBrokerAccounts.length === 0}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {pendingBrokerAccounts.map((brokerAccountID) => (
                          <option key={brokerAccountID} value={brokerAccountID}>
                            {brokerAccountID}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleConfirmBrokerSelection()}
                        disabled={linkingBroker || selectedPendingBrokerAccountID.length === 0}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {linkingBroker ? 'Linking…' : 'Link selected account'}
                      </button>
                      <button
                        type="button"
                        onClick={() => clearPendingSelection()}
                        disabled={linkingBroker}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {!selectedAccount.broker_linked ? (
            <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
              <h3 className="text-base font-semibold text-white">Connect a broker</h3>
              <p className="mt-1 text-sm text-gray-400">
                Choose a broker and authorize to securely link it to {selectedAccount.name}.
              </p>
              <div className="mt-4 mb-4 max-w-sm">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-400">
                  Broker
                </label>
                <select
                  value={selectedBroker}
                  onChange={(event) => setSelectedBroker(event.target.value as SupportedBroker)}
                  disabled={linkingBroker}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linkingBroker ? 'Redirecting…' : 'Connect broker'}
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