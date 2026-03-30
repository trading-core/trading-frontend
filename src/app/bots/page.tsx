'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import {
  AUTH_SESSION_CHANGED_EVENT,
  type AuthSession,
  loadAuthSession,
} from '@/lib/authSession';
import { type BalanceInfo, type TradingAccount } from '@/lib/account';
import {
  createBot,
  deleteBot,
  listBots,
  type TradingBot,
  updateBotStatus,
} from '@/lib/bot';

interface AccountCardData {
  account: TradingAccount;
  balance: BalanceInfo | null;
  balanceError: string | null;
}

const MOCK_PREVIEW_ACCOUNT = {
  name: 'Preview Account',
  brokerType: 'tastytrade',
  accountID: 'preview-account-01',
  cash: 10400,
  buyingPower: 40800,
  netLiq: 25000,
};

const MOCK_PREVIEW_BOT = {
  id: 'preview-bot-01',
  name: 'Preview Momentum Bot',
  status: 'running',
  symbol: 'NVDA',
  strategy: 'Momentum Breakout',
  pnl: 482.3,
  pnlPercent: 1.92,
  openPositions: 1,
  tradesToday: 8,
  winRate: 62.5,
  heartbeat: '3s ago',
  createdAt: new Date().toLocaleString(),
};

const formatBrokerType = (brokerType?: string) => {
  if (!brokerType) {
    return 'Unlinked';
  }
  return brokerType
    .split(/[-_]/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const formatStrategyTradeType = (strategyTradeType?: string) => {
  if (!strategyTradeType) {
    return 'n/a';
  }
  return strategyTradeType
    .split(/[-_]/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
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

export default function MyBotsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [accounts, setAccounts] = useState<AccountCardData[]>([]);
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botWarning, setBotWarning] = useState<string | null>(null);
  const [botActionByAccountID, setBotActionByAccountID] = useState<Record<string, boolean>>({});
  const [createBotAccount, setCreateBotAccount] = useState<TradingAccount | null>(null);
  const [createBotSymbol, setCreateBotSymbol] = useState('AAPL');
  const [createBotStrategy, setCreateBotStrategy] = useState('momentum_breakout');
  const [createBotAllocationPercent, setCreateBotAllocationPercent] = useState('10');

  useEffect(() => {
    const refreshSession = () => {
      setSession(loadAuthSession());
      setIsReady(true);
    };

    refreshSession();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (!session) {
      setAccounts([]);
      setBots([]);
      setLoading(false);
      return;
    }

    const authorization = `${session.token_type} ${session.access_token}`;

    const fetchAccountCardsAndBots = async () => {
      setLoading(true);
      setError(null);
      setBotWarning(null);
      try {
        const accountsResponse = await fetch(apiUrl(ACCOUNT_SERVICE_BASE_URL, '/accounts/v1/accounts'), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authorization,
          },
        });

        if (!accountsResponse.ok) {
          throw new Error(await getErrorMessage(accountsResponse));
        }

        const rawAccounts = (await accountsResponse.json()) as TradingAccount[] | null;
        const tradingAccounts = Array.isArray(rawAccounts) ? rawAccounts : [];

        const cards = await Promise.all(
          tradingAccounts.map(async (account): Promise<AccountCardData> => {
            if (!account.broker_linked) {
              return {
                account,
                balance: null,
                balanceError: null,
              };
            }

            try {
              const balanceResponse = await fetch(
                apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${account.account_id}/balances`),
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: authorization,
                  },
                }
              );

              if (!balanceResponse.ok) {
                throw new Error(await getErrorMessage(balanceResponse));
              }

              return {
                account,
                balance: (await balanceResponse.json()) as BalanceInfo,
                balanceError: null,
              };
            } catch (balanceError) {
              return {
                account,
                balance: null,
                balanceError:
                  balanceError instanceof Error ? balanceError.message : 'Failed to load balance.',
              };
            }
          })
        );

        setAccounts(cards);
        try {
          setBots(await listBots(authorization));
        } catch {
          setBots([]);
          setBotWarning('Bot service is currently unavailable. Account data is still live.');
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load accounts.');
        setAccounts([]);
        setBots([]);
        setBotWarning(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchAccountCardsAndBots();
  }, [isReady, session]);

  const withAccountAction = async (accountID: string, action: () => Promise<void>) => {
    setBotActionByAccountID((prev) => ({ ...prev, [accountID]: true }));
    try {
      await action();
    } finally {
      setBotActionByAccountID((prev) => ({ ...prev, [accountID]: false }));
    }
  };

  const refreshBots = async () => {
    if (!session) {
      return;
    }
    const authorization = `${session.token_type} ${session.access_token}`;
    try {
      setBots(await listBots(authorization));
      setBotWarning(null);
    } catch {
      setBots([]);
      setBotWarning('Bot service is currently unavailable. Account data is still live.');
    }
  };

  const handleCreateBot = (account: TradingAccount) => {
    setCreateBotAccount(account);
    setCreateBotSymbol('AAPL');
    setCreateBotStrategy('momentum_breakout');
    setCreateBotAllocationPercent('10');
  };

  const handleConfirmCreateBot = async () => {
    if (!createBotAccount || !session) {
      return;
    }
    const symbol = createBotSymbol.trim().toUpperCase();
    const strategyTradeType = createBotStrategy.trim();
    const allocationPercent = Number.parseFloat(createBotAllocationPercent);
    if (!symbol || !strategyTradeType) {
      setBotWarning('Symbol and strategy trade type are required');
      return;
    }
    if (!Number.isFinite(allocationPercent) || allocationPercent <= 0 || allocationPercent > 80) {
      setBotWarning('Allocation percent must be greater than 0 and less than or equal to 80');
      return;
    }

    const account = createBotAccount;
    setCreateBotAccount(null);
    const authorization = `${session.token_type} ${session.access_token}`;
    try {
      await withAccountAction(account.account_id, async () => {
        await createBot(authorization, {
          account_id: account.account_id,
          symbol,
          strategy_trade_type: strategyTradeType,
          allocation_percent: allocationPercent,
        });
        await refreshBots();
      });
    } catch (error) {
      setBotWarning(error instanceof Error ? error.message : 'Failed to create bot');
    }
  };

  const handleCancelCreateBot = () => {
    setCreateBotAccount(null);
  };

  const handleDeleteBot = async (accountID: string, botID: string, botName: string) => {
    if (!session) {
      return;
    }
    const confirmed = window.confirm(`Delete bot \"${botName}\"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }
    const authorization = `${session.token_type} ${session.access_token}`;
    try {
      await withAccountAction(accountID, async () => {
        await deleteBot(authorization, botID);
        await refreshBots();
      });
    } catch (error) {
      setBotWarning(error instanceof Error ? error.message : 'Failed to delete bot');
    }
  };

  const handleSetBotStatus = async (accountID: string, botID: string, status: 'running' | 'stopped') => {
    if (!session) {
      return;
    }
    const authorization = `${session.token_type} ${session.access_token}`;
    try {
      await withAccountAction(accountID, async () => {
        await updateBotStatus(authorization, botID, status);
        await refreshBots();
      });
    } catch (error) {
      setBotWarning(error instanceof Error ? error.message : 'Failed to update bot status');
    }
  };

  const totalEquity = accounts.reduce(
    (sum, account) => sum + (account.balance?.net_liquidating_value ?? 0),
    0
  );
  const totalCash = accounts.reduce(
    (sum, account) => sum + (account.balance?.cash_balance ?? 0),
    0
  );
  const totalBuyingPower = accounts.reduce(
    (sum, account) => sum + (account.balance?.equity_buying_power ?? 0),
    0
  );
  const runningBotsCount = bots.filter((bot) => bot.status === 'running').length;

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-black xl:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <span className="mr-2">←</span> Back to Screener
        </Link>

        <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-gray-500 dark:text-gray-500">
            Accounts And Bots Overview
          </p>
          <h1 className="mb-6 text-5xl font-bold text-black dark:text-white">My Bots</h1>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              {
                label: 'Total Equity',
                value: `$${totalEquity.toFixed(2)}`,
                accent: 'bg-blue-50 dark:bg-blue-950/60',
              },
              {
                label: 'Cash Available',
                value: `$${totalCash.toFixed(2)}`,
                accent: 'bg-green-50 dark:bg-green-950/60',
              },
              {
                label: 'Equity Buying Power',
                value: `$${totalBuyingPower.toFixed(2)}`,
                accent: 'bg-amber-50 dark:bg-amber-950/60',
              },
              {
                label: 'Active Bots',
                value: runningBotsCount.toString(),
                accent: 'bg-rose-50 dark:bg-rose-950/50',
              },
            ].map(({ label, value, accent }) => (
              <div
                key={label}
                className={`rounded-2xl border border-gray-200 px-6 py-4 dark:border-gray-700 ${accent}`}
              >
                <p className="mb-2 text-sm uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  {label}
                </p>
                <p className="text-2xl font-bold text-black dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {!isReady || loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-zinc-900">
            <p className="text-gray-600 dark:text-gray-300">Loading your accounts and bots...</p>
          </div>
        ) : !session ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-zinc-900">
            <p className="mb-4 text-gray-600 dark:text-gray-300">Sign in to view live accounts and bots.</p>
            <Link
              href="/login"
              className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Go To Login
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-lg dark:border-red-900 dark:bg-red-950/40">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-indigo-950/40">
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                Preview Mode: no live accounts found yet, showing one mock linked account with a running bot.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
              <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-black dark:text-white">Preview Account</h2>
                    <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/60 dark:text-green-300">
                      Broker Linked
                    </span>
                    <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      Mock Data
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatBrokerType(MOCK_PREVIEW_ACCOUNT.brokerType)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Net Liq</p>
                  <p className="text-2xl font-bold text-black dark:text-white">
                    ${MOCK_PREVIEW_ACCOUNT.netLiq.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  {
                    label: 'Cash',
                    value: `$${MOCK_PREVIEW_ACCOUNT.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                  },
                  {
                    label: 'Equity Buying Power',
                    value: `$${MOCK_PREVIEW_ACCOUNT.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                  },
                  { label: 'Account ID', value: MOCK_PREVIEW_ACCOUNT.accountID },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-black"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</p>
                    <p className="break-all text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-black dark:text-white">Live Bots (1)</h3>
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-gray-400 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Create Bot
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-black lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700 dark:bg-green-950/60 dark:text-green-300">
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        Running
                      </div>
                      <div>
                        <p className="font-semibold text-black dark:text-white">{MOCK_PREVIEW_BOT.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{MOCK_PREVIEW_BOT.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
                        <p className="font-semibold text-black dark:text-white">{MOCK_PREVIEW_BOT.createdAt}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled
                        className="rounded-lg bg-gray-400 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Stop
                      </button>
                      <button
                        type="button"
                        disabled
                        className="rounded-lg bg-gray-400 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: 'Symbol', value: MOCK_PREVIEW_BOT.symbol },
                    {
                      label: 'PnL',
                      value: `${MOCK_PREVIEW_BOT.pnl >= 0 ? '+' : ''}$${MOCK_PREVIEW_BOT.pnl.toFixed(2)} (${MOCK_PREVIEW_BOT.pnlPercent.toFixed(2)}%)`,
                    },
                    { label: 'Trades Today', value: MOCK_PREVIEW_BOT.tradesToday.toString() },
                    { label: 'Win Rate', value: `${MOCK_PREVIEW_BOT.winRate.toFixed(1)}%` },
                    { label: 'Strategy', value: MOCK_PREVIEW_BOT.strategy },
                    { label: 'Open Positions', value: MOCK_PREVIEW_BOT.openPositions.toString() },
                    { label: 'Heartbeat', value: MOCK_PREVIEW_BOT.heartbeat },
                    { label: 'Attached Account', value: MOCK_PREVIEW_ACCOUNT.accountID },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-black"
                    >
                      <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
              <h2 className="mb-2 text-2xl font-bold text-black dark:text-white">No live accounts yet</h2>
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                Create an account and link a broker to replace this preview with live bots.
              </p>
              <Link
                href="/account"
                className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Manage Accounts
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {botWarning ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-lg dark:border-amber-900 dark:bg-amber-950/40">
                <p className="text-sm text-amber-800 dark:text-amber-300">{botWarning}</p>
              </div>
            ) : null}
            {bots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50 p-5 shadow-lg dark:border-indigo-800 dark:bg-indigo-950/40">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    Preview Mode: no live bots yet, showing one mock running bot card.
                  </p>
                  <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    Mock Data
                  </span>
                </div>
                <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-black lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700 dark:bg-green-950/60 dark:text-green-300">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      Running
                    </div>
                    <div>
                        <p className="font-semibold text-black dark:text-white">{MOCK_PREVIEW_BOT.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{MOCK_PREVIEW_BOT.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
                        <p className="font-semibold text-black dark:text-white">{MOCK_PREVIEW_BOT.createdAt}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled
                      className="rounded-lg bg-gray-400 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Stop
                    </button>
                    <button
                      type="button"
                      disabled
                      className="rounded-lg bg-gray-400 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: 'Symbol', value: MOCK_PREVIEW_BOT.symbol },
                    {
                      label: 'PnL',
                      value: `${MOCK_PREVIEW_BOT.pnl >= 0 ? '+' : ''}$${MOCK_PREVIEW_BOT.pnl.toFixed(2)} (${MOCK_PREVIEW_BOT.pnlPercent.toFixed(2)}%)`,
                    },
                    { label: 'Trades Today', value: MOCK_PREVIEW_BOT.tradesToday.toString() },
                    { label: 'Win Rate', value: `${MOCK_PREVIEW_BOT.winRate.toFixed(1)}%` },
                    { label: 'Strategy', value: MOCK_PREVIEW_BOT.strategy },
                    { label: 'Open Positions', value: MOCK_PREVIEW_BOT.openPositions.toString() },
                    { label: 'Heartbeat', value: MOCK_PREVIEW_BOT.heartbeat },
                    { label: 'Attached Account', value: MOCK_PREVIEW_ACCOUNT.accountID },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-black"
                    >
                      <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {accounts.map(({ account, balance, balanceError }) => {
              const accountBots = bots.filter((bot) => bot.account_id === account.account_id);
              const accountActionLoading = botActionByAccountID[account.account_id] ?? false;

              return (
                <div
                  key={account.account_id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-zinc-900"
                >
                  <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-bold text-black dark:text-white">{account.name}</h2>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            account.broker_linked
                              ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {account.broker_linked ? 'Broker Linked' : 'Broker Not Linked'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatBrokerType(account.broker_account?.account_type)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Net Liq</p>
                      <p className="text-2xl font-bold text-black dark:text-white">
                        {balance ? `$${balance.net_liquidating_value.toFixed(2)}` : '--'}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {[
                      {
                        label: 'Cash',
                        value: balance ? `$${balance.cash_balance.toFixed(2)}` : '--',
                      },
                      {
                        label: 'Equity Buying Power',
                        value: balance ? `$${balance.equity_buying_power.toFixed(2)}` : '--',
                      },
                      {
                        label: 'Account ID',
                        value: account.account_id,
                      },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-black"
                      >
                        <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">
                          {label}
                        </p>
                        <p className="break-all text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {!account.broker_linked ? (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        Link a broker on the Account page before this account can run bots or load live balances.
                      </p>
                    </div>
                  ) : balanceError ? (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Failed to load balance: {balanceError}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-black dark:text-white">
                        Live Bots ({accountBots.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => void handleCreateBot(account)}
                        disabled={!account.broker_linked || !account.broker_account || accountActionLoading}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                      >
                        {accountActionLoading ? 'Working...' : 'Create Bot'}
                      </button>
                    </div>

                    {accountBots.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-black">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          No bots for this account yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {accountBots.map((bot) => (
                          <div
                            key={bot.id}
                            className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-black lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="flex flex-wrap items-center gap-4">
                              <div
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                                  bot.status === 'running'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300'
                                    : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    bot.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                                  }`}
                                />
                                {bot.status === 'running' ? 'Running' : 'Stopped'}
                              </div>
                              <div>
                                <p className="font-semibold text-black dark:text-white">
                                  {bot.symbol || bot.name || 'Unnamed Bot'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{bot.id}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Strategy</p>
                                <p className="font-semibold text-black dark:text-white">
                                  {formatStrategyTradeType(bot.strategy_trade_type)}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Allocation</p>
                                <p className="font-semibold text-black dark:text-white">
                                  {bot.allocation_percent.toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
                                <p className="font-semibold text-black dark:text-white">
                                  {new Date(bot.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              {bot.status === 'running' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleSetBotStatus(account.account_id, bot.id, 'stopped')}
                                  disabled={accountActionLoading}
                                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                                >
                                  Stop
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleSetBotStatus(account.account_id, bot.id, 'running')}
                                  disabled={accountActionLoading}
                                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                                >
                                  Start
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteBot(
                                    account.account_id,
                                    bot.id,
                                    bot.symbol || bot.name || bot.id
                                  )
                                }
                                disabled={accountActionLoading}
                                className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {createBotAccount ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
            <h2 className="text-xl font-bold text-black dark:text-white">Create Bot</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Account: {createBotAccount.name}
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Symbol
                </label>
                <input
                  type="text"
                  value={createBotSymbol}
                  onChange={(event) => setCreateBotSymbol(event.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                  placeholder="AAPL"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Strategy Trade Type
                </label>
                <select
                  value={createBotStrategy}
                  onChange={(event) => setCreateBotStrategy(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="momentum_breakout">{formatStrategyTradeType('momentum_breakout')}</option>
                  <option value="mean_reversion">{formatStrategyTradeType('mean_reversion')}</option>
                  <option value="trend_following">{formatStrategyTradeType('trend_following')}</option>
                  <option value="opening_range_breakout">{formatStrategyTradeType('opening_range_breakout')}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Allocation Percent
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="80"
                  step="0.1"
                  value={createBotAllocationPercent}
                  onChange={(event) => setCreateBotAllocationPercent(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                  placeholder="10"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Active bots on the same account cannot exceed 80% combined allocation.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelCreateBot}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCreateBot()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
