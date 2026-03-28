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

interface AccountCardData {
  account: TradingAccount;
  balance: BalanceInfo | null;
  balanceError: string | null;
}

interface MockBotStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped';
  symbol: string;
  strategy: string;
  trades: number;
  pnl: number;
  winRate: number;
  uptime: string;
}

const MOCK_BOT_PRESETS: MockBotStatus[] = [
  {
    id: 'orb-preview',
    name: 'Opening Range Breakout',
    status: 'running',
    symbol: 'SPY',
    strategy: 'Momentum',
    trades: 14,
    pnl: 482.15,
    winRate: 64.3,
    uptime: '4h 18m',
  },
  {
    id: 'reversion-preview',
    name: 'VWAP Mean Reversion',
    status: 'stopped',
    symbol: 'QQQ',
    strategy: 'Mean Reversion',
    trades: 6,
    pnl: -84.2,
    winRate: 50.0,
    uptime: 'Paused',
  },
  {
    id: 'breakout-preview',
    name: 'High Volume Breakout',
    status: 'running',
    symbol: 'AAPL',
    strategy: 'Breakout',
    trades: 9,
    pnl: 219.6,
    winRate: 66.7,
    uptime: '2h 41m',
  },
];

const getMockBotsForAccount = (accountID: string): MockBotStatus[] => {
  const offset = accountID
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0) % MOCK_BOT_PRESETS.length;
  return [0, 1].map((index) => {
    const preset = MOCK_BOT_PRESETS[(offset + index) % MOCK_BOT_PRESETS.length];
    return {
      ...preset,
      id: `${accountID}-${preset.id}`,
    };
  });
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setLoading(false);
      return;
    }

    const fetchAccountCards = async () => {
      setLoading(true);
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

        const rawAccounts = (await response.json()) as TradingAccount[] | null;
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
                    Authorization: `${session.token_type} ${session.access_token}`,
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
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load accounts.');
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchAccountCards();
  }, [isReady, session]);

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
  const previewBots = accounts.flatMap(({ account }) => getMockBotsForAccount(account.account_id));
  const runningPreviewBotsCount = previewBots.filter((bot) => bot.status === 'running').length;

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
                label: 'Active Demo Bots',
                value: runningPreviewBotsCount.toString(),
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
            <p className="text-gray-600 dark:text-gray-300">Loading your accounts and balances...</p>
          </div>
        ) : !session ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-zinc-900">
            <p className="mb-4 text-gray-600 dark:text-gray-300">Sign in to view live accounts and balances.</p>
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
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
            <h2 className="mb-2 text-2xl font-bold text-black dark:text-white">No accounts yet</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Create an account and link a broker before running bots.
            </p>
            <Link
              href="/account"
              className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Manage Accounts
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {accounts.map(({ account, balance, balanceError }) => {
              const mockBots = getMockBotsForAccount(account.account_id);

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
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-black dark:text-white">
                        Bots Preview ({mockBots.length})
                      </h3>
                      <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        Demo
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Live account, mocked bots
                      </p>
                      <Link
                        href="/account"
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Manage Account
                      </Link>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="space-y-3">
                      {mockBots.map((bot) => (
                        <div
                          key={bot.id}
                          className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-black lg:flex-row lg:items-center lg:justify-between"
                        >
                        <div className="flex flex-1 flex-wrap items-center gap-4">
                          <div>
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
                          </div>
                          <div>
                            <p className="font-semibold text-black dark:text-white">{bot.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{bot.strategy}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Symbol</p>
                            <p className="font-semibold text-black dark:text-white">{bot.symbol}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Trades</p>
                            <p className="font-semibold text-black dark:text-white">{bot.trades}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">P&L</p>
                            <p
                              className={`font-semibold ${
                                bot.pnl >= 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              ${bot.pnl.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Win Rate</p>
                            <p className="font-semibold text-black dark:text-white">{bot.winRate.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Uptime</p>
                            <p className="font-semibold text-black dark:text-white">{bot.uptime}</p>
                          </div>
                        </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled
                              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            >
                              Preview Only
                            </button>
                            <button
                              type="button"
                              disabled
                              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                                bot.status === 'running' ? 'bg-red-400' : 'bg-green-400'
                              } opacity-70`}
                            >
                              {bot.status === 'running' ? 'Stop' : 'Start'}
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-black">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Account and balance data above are live. The bot cards in this section are mocked previews so you can evaluate the eventual layout before the bot endpoints exist.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}