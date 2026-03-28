'use client';

import { useState } from 'react';
import Link from 'next/link';

interface BotStatus {
  id: string;
  status: 'running' | 'stopped';
  symbol?: string;
  trades: number;
  pnl: number;
  winRate: number;
  uptime: string;
}

interface Account {
  id: string;
  name: string;
  broker: string;
  cash: number;
  equity: number;
  dayReturn: number;
  dayReturnPercent: number;
  bots: BotStatus[];
}

export default function Portfolio() {
  const [accounts, setAccounts] = useState<Account[]>([
    {
      id: '1',
      name: 'Main Trading Account',
      broker: 'TastyTrade',
      cash: 25000,
      equity: 48750.5,
      dayReturn: 1250.75,
      dayReturnPercent: 2.63,
      bots: [
        {
          id: 'bot-1',
          status: 'running',
          symbol: 'SPY',
          trades: 12,
          pnl: 485.2,
          winRate: 66.7,
          uptime: '4h 23m',
        },
        {
          id: 'bot-2',
          status: 'stopped',
          symbol: 'QQQ',
          trades: 0,
          pnl: 0,
          winRate: 0,
          uptime: '-',
        },
      ],
    },
    {
      id: '2',
      name: 'Secondary Account',
      broker: 'Alpaca',
      cash: 15000,
      equity: 32100.25,
      dayReturn: 450.25,
      dayReturnPercent: 1.42,
      bots: [
        {
          id: 'bot-3',
          status: 'running',
          symbol: 'AAPL',
          trades: 8,
          pnl: 320.15,
          winRate: 62.5,
          uptime: '2h 15m',
        },
      ],
    },
  ]);

  const handleStartBot = (accountId: string, botId: string) => {
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              bots: acc.bots.map((bot) =>
                bot.id === botId ? { ...bot, status: 'running' } : bot
              ),
            }
          : acc
      )
    );
  };

  const handleStopBot = (accountId: string, botId: string) => {
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              bots: acc.bots.map((bot) =>
                bot.id === botId ? { ...bot, status: 'stopped' } : bot
              ),
            }
          : acc
      )
    );
  };

  const totalEquity = accounts.reduce((sum, acc) => sum + acc.equity, 0);
  const totalCash = accounts.reduce((sum, acc) => sum + acc.cash, 0);
  const totalReturn = accounts.reduce((sum, acc) => sum + acc.dayReturn, 0);
  const runningBotsCount = accounts.reduce(
    (sum, acc) => sum + acc.bots.filter((b) => b.status === 'running').length,
    0
  );

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-black xl:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6"
        >
          <span className="mr-2">←</span> Back to Screener
        </Link>

        {/* Portfolio Summary */}
        <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-gray-500 dark:text-gray-500">
            Portfolio Overview
          </p>
          <h1 className="mb-6 text-5xl font-bold text-black dark:text-white">
            My Portfolio
          </h1>

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
                label: 'Day Return',
                value: `$${totalReturn.toFixed(2)}`,
                accent: totalReturn >= 0 
                  ? 'bg-green-50 dark:bg-green-950/60'
                  : 'bg-red-50 dark:bg-red-950/60',
              },
              {
                label: 'Active Bots',
                value: runningBotsCount.toString(),
                accent: 'bg-purple-50 dark:bg-purple-950/60',
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

        {/* Accounts */}
        <div className="space-y-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-zinc-900"
            >
              {/* Account Header */}
              <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="mb-2 text-2xl font-bold text-black dark:text-white">
                    {account.name}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {account.broker}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Equity</p>
                  <p className="text-2xl font-bold text-black dark:text-white">
                    ${account.equity.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Account Stats */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Cash',
                    value: `$${account.cash.toFixed(0)}`,
                  },
                  {
                    label: 'Day Return',
                    value: `$${account.dayReturn.toFixed(2)}`,
                    isPositive: account.dayReturn >= 0,
                  },
                  {
                    label: 'Return %',
                    value: `${account.dayReturnPercent.toFixed(2)}%`,
                    isPositive: account.dayReturnPercent >= 0,
                  },
                ].map(({ label, value, isPositive }) => (
                  <div
                    key={label}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-black"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      {label}
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        isPositive !== false
                          ? isPositive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-900 dark:text-gray-100'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bots */}
              <div>
                <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">
                  Bots ({account.bots.length})
                </h3>
                <div className="space-y-3">
                  {account.bots.length > 0 ? (
                    account.bots.map((bot) => (
                      <div
                        key={bot.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-black"
                      >
                        <div className="flex flex-1 items-center gap-4">
                          {/* Status */}
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
                                  bot.status === 'running'
                                    ? 'bg-green-500 animate-pulse'
                                    : 'bg-gray-500'
                                }`}
                              />
                              {bot.status === 'running' ? 'Running' : 'Stopped'}
                            </div>
                          </div>

                          {/* Symbol */}
                          {bot.symbol && (
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Symbol</p>
                              <p className="font-semibold text-black dark:text-white">
                                {bot.symbol}
                              </p>
                            </div>
                          )}

                          {/* Stats */}
                          {bot.status === 'running' && (
                            <>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Trades</p>
                                <p className="font-semibold text-black dark:text-white">
                                  {bot.trades}
                                </p>
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
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Win Rate
                                </p>
                                <p className="font-semibold text-black dark:text-white">
                                  {bot.winRate.toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Uptime</p>
                                <p className="font-semibold text-black dark:text-white">
                                  {bot.uptime}
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Controls */}
                        <div className="ml-4 flex gap-2">
                          {bot.status === 'running' ? (
                            <button
                              onClick={() => handleStopBot(account.id, bot.id)}
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                            >
                              Stop
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartBot(account.id, bot.id)}
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
                            >
                              Start
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">No bots configured</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
