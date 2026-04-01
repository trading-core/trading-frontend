'use client';

import { type BotDecisionEvent, type TradingBot } from '@/lib/bot';
import TradingViewCompactChartWidget from './TradingViewCompactChartWidget';

interface BotDecisionDashboardProps {
  bot: TradingBot;
  decisionEvents: BotDecisionEvent[];
}

const actionToneByType: Record<BotDecisionEvent['action'], string> = {
  none: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  buy: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300',
  sell: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
};

const markerToneByType: Record<BotDecisionEvent['action'], string> = {
  none: 'bg-gray-400',
  buy: 'bg-green-500',
  sell: 'bg-amber-500',
};

const actionLabel = (action: BotDecisionEvent['action']) => {
  switch (action) {
    case 'buy':
      return 'Entry';
    case 'sell':
      return 'Sell';
    default:
      return 'No Action';
  }
};

export default function BotDecisionDashboard({ bot, decisionEvents }: BotDecisionDashboardProps) {
  const actionableEvents = decisionEvents.filter((event) => event.action !== 'none');
  const displayedMarkers = actionableEvents.slice(0, 8);
  const buyCount = actionableEvents.filter((event) => event.action === 'buy').length;
  const sellCount = actionableEvents.filter((event) => event.action === 'sell').length;
  const lastEvent = decisionEvents[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.24em] text-gray-500 dark:text-gray-500">
              Bot Dashboard
            </p>
            <h2 className="text-2xl font-bold text-black dark:text-white">Action Overlay Chart</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Simplified TradingView chart with recent bot buys and sells.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm md:min-w-[320px]">
            {[
              { label: 'Buys', value: buyCount.toString() },
              { label: 'Sells', value: sellCount.toString() },
              {
                label: 'Last Action',
                value: lastEvent ? actionLabel(lastEvent.action) : 'None',
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-black">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">{label}</p>
                <p className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-black p-2 dark:border-gray-700">
          <TradingViewCompactChartWidget symbol={bot.symbol} heightClassName="h-[320px]" />
          <div className="pointer-events-none absolute inset-x-4 top-5 bottom-5">
            {displayedMarkers.length > 0
              ? displayedMarkers.map((event, index) => {
                  const left = displayedMarkers.length === 1 ? 50 : (index / (displayedMarkers.length - 1)) * 100;
                  const top = event.action === 'buy' ? '30%' : '65%';
                  return (
                    <div
                      key={`${event.sequence}-${event.action}`}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${left}%`, top }}
                      title={`${actionLabel(event.action)} at $${event.price.toFixed(2)} on ${new Date(event.timestamp_millis).toLocaleString()}`}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-lg ${markerToneByType[event.action]}`}>
                        {event.action === 'buy' ? 'B' : 'S'}
                      </div>
                    </div>
                  );
                })
              : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['buy', 'sell'] as const).map((action) => (
            <div key={action} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-black dark:text-gray-200">
              <span className={`h-2.5 w-2.5 rounded-full ${markerToneByType[action]}`} />
              {actionLabel(action)}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
        <div className="mb-5">
          <p className="mb-2 text-sm uppercase tracking-[0.24em] text-gray-500 dark:text-gray-500">
            Decision Log
          </p>
          <h2 className="text-2xl font-bold text-black dark:text-white">Recent Decisions</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Actionable decisions recorded by this bot.
          </p>
        </div>

        {decisionEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-sm text-gray-600 dark:border-gray-700 dark:bg-black dark:text-gray-400">
            No actionable decisions have been recorded yet. Once the bot issues buy or sell actions, they will show up here.
          </div>
        ) : (
          <div className="space-y-3">
            {decisionEvents.slice(0, 12).map((event) => (
              <div key={event.sequence} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-black">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {actionLabel(event.action)} at ${event.price.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(event.timestamp_millis).toLocaleString()}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${actionToneByType[event.action]}`}>
                    {event.action.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">Reason</p>
                    <p className="mt-1 text-gray-800 dark:text-gray-200">{event.reason || 'n/a'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">Quantity</p>
                    <p className="mt-1 text-gray-800 dark:text-gray-200">{event.quantity.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}