'use client';

import { useState } from 'react';
import { type BotDecisionEvent, type TradingBot } from '@/lib/bot';
import LightweightBotChart from './LightweightBotChart';

interface BotDecisionDashboardProps {
  bot: TradingBot;
  decisionEvents: BotDecisionEvent[];
}

const CHART_TIMEFRAMES = ['1Day', '1Hour', '15Min'] as const;
type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];
const CHART_RANGES = ['1M', '3M', '6M', '1Y'] as const;
type ChartRange = (typeof CHART_RANGES)[number];

type DecisionAction = BotDecisionEvent['action'];

const normalizeAction = (action: unknown): DecisionAction => {
  if (action === 'buy' || action === 'sell' || action === 'none') {
    return action;
  }
  return 'none';
};

const actionToneByType: Record<BotDecisionEvent['action'], string> = {
  none: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  buy: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300',
  sell: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
};

const markerToneByType: Record<BotDecisionEvent['action'], string> = {
  none: 'bg-gray-400',
  buy: 'bg-green-500',
  sell: 'bg-red-500',
};

const actionLabel = (action: BotDecisionEvent['action']) => {
  switch (action) {
    case 'buy':
      return 'Buy';
    case 'sell':
      return 'Sell';
    default:
      return 'No Action';
  }
};

const formatMaybeNumber = (value: unknown, digits: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a';
  }
  return value.toFixed(digits);
};

export default function BotDecisionDashboard({ bot, decisionEvents }: BotDecisionDashboardProps) {
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('1Day');
  const [chartRange, setChartRange] = useState<ChartRange>('1Y');
  const actionableEvents = decisionEvents.filter((event) => normalizeAction(event.action) !== 'none');
  const buyCount = actionableEvents.filter((event) => normalizeAction(event.action) === 'buy').length;
  const sellCount = actionableEvents.filter((event) => normalizeAction(event.action) === 'sell').length;
  const lastEvent = decisionEvents[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.24em] text-gray-500 dark:text-gray-500">
              Bot Dashboard
            </p>
            <h2 className="text-2xl font-bold text-black dark:text-white">Price Chart</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Lightweight Charts line view with buy and sell markers.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">
                  Timeframe
                </label>
                <select
                  value={chartTimeframe}
                  onChange={(event) => setChartTimeframe(event.target.value as ChartTimeframe)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-black dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                >
                  {CHART_TIMEFRAMES.map((timeframe) => (
                    <option key={timeframe} value={timeframe}>
                      {timeframe}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">
                  Range
                </label>
                <select
                  value={chartRange}
                  onChange={(event) => setChartRange(event.target.value as ChartRange)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-black dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                >
                  {CHART_RANGES.map((range) => (
                    <option key={range} value={range}>
                      {range}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm md:min-w-[320px]">
            {[
              { label: 'Buys', value: buyCount.toString() },
              { label: 'Sells', value: sellCount.toString() },
              {
                label: 'Last Action',
              value: lastEvent ? actionLabel(normalizeAction(lastEvent.action)) : 'None',
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-black">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">{label}</p>
                <p className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-black p-2 dark:border-gray-700">
          <LightweightBotChart
            symbol={bot.symbol}
            decisionEvents={decisionEvents}
            timeframe={chartTimeframe}
            range={chartRange}
            heightClassName="h-[320px]"
          />
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

      <div className="flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
        <div className="mb-5 shrink-0">
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
          <div className="max-h-[620px] overflow-y-auto space-y-3 pr-1">
            {decisionEvents.map((event) => {
              const action = normalizeAction(event.action);
              return (
              <div key={event.sequence} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-black">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {actionLabel(action)} at ${formatMaybeNumber(event.price, 2)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(event.timestamp_millis).toLocaleString()}
                    </p>
                  </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${actionToneByType[action]}`}>
                {action.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">Reason</p>
                    <p className="mt-1 text-gray-800 dark:text-gray-200">{event.reason || 'n/a'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">Quantity</p>
                <p className="mt-1 text-gray-800 dark:text-gray-200">{formatMaybeNumber(event.quantity, 2)}</p>
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