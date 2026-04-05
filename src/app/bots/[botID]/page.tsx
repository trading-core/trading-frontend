'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import BotDecisionDashboard from '@/components/BotDecisionDashboard';
import {
  AUTH_SESSION_CHANGED_EVENT,
  type AuthSession,
  loadAuthSession,
} from '@/lib/authSession';
import {
  deleteBot,
  getBot,
  streamBotDecisionEvents,
  type BotDecisionEvent,
  type TradingBot,
  updateBotStatus,
} from '@/lib/bot';

type BotDetailPageProps = {
  params: Promise<{
    botID: string;
  }>;
};

export default function BotDetailPage({ params }: BotDetailPageProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const { botID } = use(params);
  const [bot, setBot] = useState<TradingBot | null>(null);
  const [decisionEvents, setDecisionEvents] = useState<BotDecisionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (!isReady || !session || !botID) {
      if (isReady && !session) {
        setLoading(false);
      }
      return;
    }

    const authorization = `${session.token_type} ${session.access_token}`;
    const fetchBot = async () => {
      setLoading(true);
      setError(null);
      try {
        setBot(await getBot(authorization, botID));
        setDecisionEvents([]);
      } catch (fetchError) {
        setBot(null);
        setDecisionEvents([]);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load bot.');
      } finally {
        setLoading(false);
      }
    };

    void fetchBot();
  }, [botID, isReady, session]);

  const refreshBot = async () => {
    if (!session || !botID) {
      return;
    }
    const authorization = `${session.token_type} ${session.access_token}`;
    setBot(await getBot(authorization, botID));
  };

  useEffect(() => {
    if (!session || !botID) {
      return;
    }
    const authorization = `${session.token_type} ${session.access_token}`;
    const abortController = new AbortController();

    setDecisionEvents([]);
    void streamBotDecisionEvents(authorization, botID, {
      signal: abortController.signal,
      onDecision: (event) => {
        setDecisionEvents((previous) => {
          if (previous.some((item) => item.sequence === event.sequence)) {
            return previous;
          }
          return [event, ...previous].slice(0, 250);
        });
      },
      onError: (message) => {
        setError(message);
      },
    }).catch((streamError) => {
      if (abortController.signal.aborted) {
        return;
      }
      setError(streamError instanceof Error ? streamError.message : 'Failed to stream decision events.');
    });

    return () => {
      abortController.abort();
    };
  }, [botID, session]);

  useEffect(() => {
    if (!session || !botID || !bot || bot.status !== 'running') {
      return;
    }
    const intervalID = window.setInterval(() => {
      void refreshBot();
    }, 5000);
    return () => window.clearInterval(intervalID);
  }, [bot, botID, session]);

  const handleSetStatus = async (status: 'running' | 'stopped') => {
    if (!session || !bot) {
      return;
    }
    const authorization = `${session.token_type} ${session.access_token}`;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateBotStatus(authorization, bot.id, status);
      await refreshBot();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update bot.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!session || !bot) {
      return;
    }
    const confirmed = window.confirm(`Delete bot "${bot.symbol || bot.id}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }
    const authorization = `${session.token_type} ${session.access_token}`;
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteBot(authorization, bot.id);
      window.location.href = '/bots';
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to delete bot.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-black xl:p-8">
      <div className="mx-auto max-w-[1440px]">
        <Link
          href="/bots"
          className="mb-6 inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <span className="mr-2">←</span> Back To Bots
        </Link>

        {!isReady || loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-zinc-900">
            <p className="text-gray-600 dark:text-gray-300">Loading bot...</p>
          </div>
        ) : !session ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-zinc-900">
            <p className="mb-4 text-gray-600 dark:text-gray-300">Sign in to view this bot.</p>
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
        ) : !bot ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-zinc-900">
            <p className="text-gray-600 dark:text-gray-300">Bot not found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="mb-3 text-sm uppercase tracking-[0.28em] text-gray-500 dark:text-gray-500">
                    Bot Detail
                  </p>
                  <h1 className="text-4xl font-bold text-black dark:text-white">
                    {bot.symbol || bot.id}
                  </h1>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{bot.id}</p>
                </div>
                <div
                  className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-semibold ${
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  { label: 'Allocation', value: `${bot.allocation_percent.toFixed(1)}%` },
                  { label: 'Account ID', value: bot.account_id },
                  { label: 'Broker Account ID', value: bot.broker_account_id || 'n/a' },
                  { label: 'Broker Type', value: bot.broker_type || 'n/a' },
                  { label: 'Created', value: new Date(bot.created_at).toLocaleString() },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-black"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</p>
                    <p className="mt-2 break-all text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {bot.status === 'running' ? (
                  <button
                    type="button"
                    onClick={() => void handleSetStatus('stopped')}
                    disabled={isSubmitting}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    Stop Bot
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSetStatus('running')}
                    disabled={isSubmitting}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    Start Bot
                  </button>
                )}
                <Link
                  href={`/stock/${encodeURIComponent(bot.symbol)}`}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-zinc-800"
                >
                  Open Symbol
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isSubmitting}
                  className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  Delete Bot
                </button>
              </div>
            </div>

            <BotDecisionDashboard bot={bot} decisionEvents={decisionEvents} />
          </div>
        )}
      </div>
    </div>
  );
}