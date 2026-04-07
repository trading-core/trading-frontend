'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import { getAuthorizationHeader } from '@/lib/authSession';
import { type TradingAccount } from '@/lib/account';
import {
  createBot,
  listBots,
  type TradingBot,
  updateBotStatus,
} from '@/lib/bot';

interface BotControlPanelProps {
  symbol: string;
}

const DEFAULT_BOT_ALLOCATION_PERCENT = 10;
const TIMEFRAME_OPTIONS = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d'] as const;
type Timeframe = (typeof TIMEFRAME_OPTIONS)[number];

export default function BotControlPanel({ symbol }: BotControlPanelProps) {
  const normalizedPageSymbol = symbol.trim().toUpperCase();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSymbol, setCreateSymbol] = useState(normalizedPageSymbol);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1h');
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const linkedAccounts = accounts.filter((account) => account.broker_linked && !!account.broker_account);
  const activeBot = selectedAccountId
    ? bots.find(
        (bot) =>
          bot.account_id === selectedAccountId &&
          bot.symbol.trim().toUpperCase() === normalizedPageSymbol
      )
    : undefined;
  const selectedAccount = accounts.find((account) => account.account_id === selectedAccountId);
  const isRunning = activeBot?.status === 'running';

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const authorization = getAuthorizationHeader();
        if (!authorization) {
          return;
        }
        const response = await fetch(apiUrl(ACCOUNT_SERVICE_BASE_URL, '/accounts/v1/accounts'), {
          headers: {
            Authorization: authorization,
          },
        });
        if (!response.ok) {
          return;
        }
        const data: TradingAccount[] = await response.json();
        setAccounts(data);
        const firstLinkedAccount = data.find((account) => account.broker_linked);
        setSelectedAccountId(firstLinkedAccount?.account_id ?? '');
        const loadedBots = await listBots(authorization);
        setBots(loadedBots);
      } catch {
        // Account selector can stay empty if loading fails.
      } finally {
        setLoadingAccounts(false);
      }
    };

    void fetchAccounts();
  }, []);

  useEffect(() => {
    setCreateSymbol(normalizedPageSymbol);
  }, [normalizedPageSymbol]);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const authorization = getAuthorizationHeader();
      if (!authorization || !selectedAccountId) {
        return;
      }

      let botID = activeBot?.id;
      if (!botID) {
        setCreateSymbol(normalizedPageSymbol);
        setIsCreateModalOpen(true);
        return;
      }
      await updateBotStatus(authorization, botID, 'running');
      setBots(await listBots(authorization));
    } catch {
      // Surface errors through existing disabled/loading states in this compact panel.
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      const authorization = getAuthorizationHeader();
      if (!authorization || !activeBot) {
        return;
      }
      await updateBotStatus(authorization, activeBot.id, 'stopped');
      setBots(await listBots(authorization));
    } catch {
      // Surface errors through existing disabled/loading states in this compact panel.
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCreateBot = async () => {
    const authorization = getAuthorizationHeader();
    if (!authorization || !selectedAccountId) {
      return;
    }
    const symbol = createSymbol.trim().toUpperCase();
    if (!symbol) {
      return;
    }

    setIsLoading(true);
    try {
      const newBot = await createBot(authorization, {
        account_id: selectedAccountId,
        symbol,
        allocation_percent: DEFAULT_BOT_ALLOCATION_PERCENT,
        trading_params: { timeframe: selectedTimeframe },
      });
      await updateBotStatus(authorization, newBot.id, 'running');
      setBots(await listBots(authorization));
      setIsCreateModalOpen(false);
    } catch {
      // Surface errors through existing disabled/loading states in this compact panel.
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (isRunning) return 'bg-green-100 dark:bg-green-950 border-green-300 dark:border-green-800';
    return 'bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-800';
  };

  const getStatusTextColor = () => {
    if (isRunning) return 'text-green-700 dark:text-green-400';
    return 'text-red-700 dark:text-red-400';
  };

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🤖 Bot Controller</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage automated trading bot
          </p>
        </div>

        {/* Status Section */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className={`p-4 rounded-lg border-2 ${getStatusColor()}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</p>
                <p className={`text-lg font-bold ${getStatusTextColor()}`}>
                  {isRunning ? '● Running' : '● Stopped'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Symbol: {normalizedPageSymbol}
                </p>
              </div>
              <div
                className={`h-3 w-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
              />
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
              Account
            </label>
            {loadingAccounts ? (
              <div className="h-10 animate-pulse rounded-lg bg-gray-200 dark:bg-zinc-700" />
            ) : accounts.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No accounts found</p>
            ) : (
              <>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                >
                  {linkedAccounts.length === 0 ? (
                    <option value="" disabled>
                      No linked accounts available
                    </option>
                  ) : null}
                  {accounts.map((acc) => (
                    <option
                      key={acc.account_id}
                      value={acc.account_id}
                      disabled={!acc.broker_linked || !acc.broker_account}
                    >
                      {acc.name}
                      {acc.broker_account ? ` · ${acc.broker_account.account_id}` : ''}
                      {!acc.broker_linked || !acc.broker_account ? ' · Link broker first' : ''}
                    </option>
                  ))}
                </select>
                {linkedAccounts.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Link a broker account first before starting bots from this panel.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="flex gap-3">
            {activeBot ? (
              <Link
                href={`/bots/${encodeURIComponent(activeBot.id)}`}
                className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition duration-200 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-zinc-800"
              >
                Open Bot Page
              </Link>
            ) : null}
            <button
              onClick={isRunning ? handleStop : handleStart}
              disabled={isLoading || !selectedAccountId}
              className={`flex-1 rounded-lg px-4 py-2 font-semibold text-white transition duration-200 disabled:cursor-not-allowed disabled:bg-gray-400 ${
                isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isLoading ? (isRunning ? 'Stopping...' : 'Starting...') : isRunning ? 'Stop Bot' : 'Start Bot'}
            </button>
          </div>
        </div>
      </div>
      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
            <h2 className="text-xl font-bold text-black dark:text-white">Create Bot</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Account: {selectedAccount?.name ?? selectedAccountId}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Symbol auto-assigned from page: {normalizedPageSymbol}
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Symbol
                </label>
                <input
                  type="text"
                  value={createSymbol}
                  readOnly
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Timeframe
                </label>
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value as Timeframe)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                >
                  {TIMEFRAME_OPTIONS.map((tf) => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
              </div>

            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCreateBot()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Create And Start
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
