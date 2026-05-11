'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Balance from '@/components/Balance';
import YtdPerformance from '@/components/YtdPerformance';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import { type TradingAccount } from '@/lib/account';
import { type AuthSession } from '@/lib/authSession';
import { useDeveloperMode } from '@/lib/developerMode';

interface AccountDetailProps {
  session: AuthSession;
  accountID: string;
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

const formatBrokerLabel = (broker: SupportedBroker | null) =>
  SUPPORTED_BROKERS.find((option) => option.value === broker)?.label ?? 'Broker';

const readStoredPendingBrokerSelection = (): StoredPendingBrokerSelection | null => {
  if (typeof window === 'undefined') return null;
  const rawValue = window.sessionStorage.getItem(PENDING_BROKER_SELECTION_STORAGE_KEY);
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredPendingBrokerSelection>;
    if (
      typeof parsed.userID !== 'string' ||
      typeof parsed.pendingToken !== 'string' ||
      typeof parsed.pendingAccountID !== 'string'
    ) {
      window.sessionStorage.removeItem(PENDING_BROKER_SELECTION_STORAGE_KEY);
      return null;
    }
    return {
      userID: parsed.userID,
      pendingToken: parsed.pendingToken,
      pendingAccountID: parsed.pendingAccountID,
    };
  } catch {
    window.sessionStorage.removeItem(PENDING_BROKER_SELECTION_STORAGE_KEY);
    return null;
  }
};

const writeStoredPendingBrokerSelection = (selection: StoredPendingBrokerSelection) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_BROKER_SELECTION_STORAGE_KEY, JSON.stringify(selection));
};

const clearStoredPendingBrokerSelection = () => {
  if (typeof window === 'undefined') return;
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
      // fall through
    }
  }
  const text = await response.text();
  return text || `Request failed with ${response.status}`;
};

export default function AccountDetail({ session, accountID }: AccountDetailProps) {
  const router = useRouter();
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedBroker, setSelectedBroker] = useState<SupportedBroker>('tastytrade');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingBrokerAccounts, setPendingBrokerAccounts] = useState<string[]>([]);
  const [pendingBroker, setPendingBroker] = useState<SupportedBroker | null>(null);
  const [selectedPendingBrokerAccountID, setSelectedPendingBrokerAccountID] = useState<string>('');
  const [loadingPendingBrokerAccounts, setLoadingPendingBrokerAccounts] = useState(false);
  const [linkingBroker, setLinkingBroker] = useState(false);

  const [devMode] = useDeveloperMode();

  const clearPendingSelection = useCallback(() => {
    setPendingToken(null);
    setPendingBroker(null);
    setPendingBrokerAccounts([]);
    setSelectedPendingBrokerAccountID('');
    clearStoredPendingBrokerSelection();
  }, []);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await fetch(
        apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${accountID}`),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `${session.token_type} ${session.access_token}`,
          },
        },
      );
      if (response.status === 404 || response.status === 403) {
        setNotFound(true);
        setAccount(null);
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      const payload = (await response.json()) as TradingAccount;
      setAccount(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account.');
    } finally {
      setLoading(false);
    }
  }, [accountID, session.access_token, session.token_type]);

  useEffect(() => {
    void fetchAccount();
  }, [fetchAccount]);

  // Pick up OAuth callback params (from /account redirect) or restore stored pending selection.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const oauthPending = params.get('oauth_pending');
    if (oauthSuccess) {
      setSuccess('Broker account linked successfully.');
      clearPendingSelection();
      router.replace(window.location.pathname);
      void fetchAccount();
      return;
    }
    if (oauthPending) {
      setPendingToken(oauthPending);
      writeStoredPendingBrokerSelection({
        userID: session.user_id,
        pendingToken: oauthPending,
        pendingAccountID: accountID,
      });
      router.replace(window.location.pathname);
      return;
    }
    if (oauthError) {
      setError(`Failed to connect broker: ${oauthError.replace(/_/g, ' ')}.`);
      clearPendingSelection();
      router.replace(window.location.pathname);
      return;
    }
    const stored = readStoredPendingBrokerSelection();
    if (stored && stored.userID === session.user_id && stored.pendingAccountID === accountID) {
      setPendingToken(stored.pendingToken);
    } else if (stored && stored.userID !== session.user_id) {
      clearStoredPendingBrokerSelection();
    }
  }, [accountID, clearPendingSelection, fetchAccount, session.user_id]);

  // Once pendingToken is set and account loaded, fetch the available broker accounts to choose from.
  useEffect(() => {
    if (!pendingToken || loading) return;
    if (account?.broker_linked) {
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
            `/accounts/v1/accounts/${accountID}/brokers?pending_token=${encodeURIComponent(pendingToken)}`,
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
            throw new Error(
              'Your broker authorization session is no longer available. Please connect your broker again.',
            );
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
  }, [account?.broker_linked, accountID, clearPendingSelection, loading, pendingToken, session.access_token, session.token_type]);

  const handleConnectBroker = async () => {
    if (!account) return;
    setLinkingBroker(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${account.account_id}/brokers`),
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
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start broker connection.');
      setLinkingBroker(false);
    }
  };

  const handleConfirmBrokerSelection = async () => {
    if (!pendingToken || !selectedPendingBrokerAccountID) return;
    setLinkingBroker(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${accountID}/brokers`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `${session.token_type} ${session.access_token}`,
          },
          body: JSON.stringify({
            pending_token: pendingToken,
            broker_account_id: selectedPendingBrokerAccountID,
          }),
        },
      );
      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          clearPendingSelection();
          void fetchAccount();
          throw new Error(
            'Your broker authorization session is no longer available. Please connect your broker again.',
          );
        }
        throw new Error(await getErrorMessage(response));
      }
      clearPendingSelection();
      setSuccess('Broker account linked successfully.');
      await fetchAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link broker account.');
    } finally {
      setLinkingBroker(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6">
        <div className="h-6 w-40 animate-pulse rounded bg-white/5" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-8 text-center">
        <p className="text-sm text-gray-300">Account not found, or you no longer have access.</p>
        <button
          type="button"
          onClick={() => router.push('/account')}
          className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Back to accounts
        </button>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {error ?? 'Failed to load account.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/account"
          className="text-sm text-gray-400 transition hover:text-white"
        >
          ← All accounts
        </Link>
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

      <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
        <h2 className="text-2xl font-semibold text-white">{account.name}</h2>
        {devMode && (
          <p className="mt-1 text-xs text-gray-500">{account.account_id}</p>
        )}
      </div>

      {(error || success) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            error
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {error || success}
        </div>
      )}

      {pendingToken && !account.broker_linked && (
        <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
          <h3 className="text-base font-semibold text-white">
            Choose {formatBrokerLabel(pendingBroker)} account
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            Your {formatBrokerLabel(pendingBroker)} login has multiple accounts. Choose which broker
            account to link to {account.name}.
          </p>
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

      {!account.broker_linked ? (
        !pendingToken && (
          <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
            <h3 className="text-base font-semibold text-white">Connect a broker</h3>
            <p className="mt-1 text-sm text-gray-400">
              Choose a broker and authorize to securely link it to {account.name}.
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
              disabled={linkingBroker}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {linkingBroker ? 'Redirecting…' : 'Connect broker'}
            </button>
          </div>
        )
      ) : (
        <>
          <Balance account={account} session={session} />
          <YtdPerformance account={account} session={session} />
        </>
      )}
    </div>
  );
}
