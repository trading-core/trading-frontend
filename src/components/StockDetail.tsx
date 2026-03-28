'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { STOCK_SCREENER_BASE_URL, apiUrl } from '@/lib/api';
import { getAuthorizationHeader } from '@/lib/authSession';
import SymbolNewsPanel from './SymbolNewsPanel';
import BotControlPanel from './BotControlPanel';
import TradingViewAdvancedChartWidget from './TradingViewAdvancedChartWidget';
import TradingViewCompanyProfileWidget from './TradingViewCompanyProfileWidget';
import TradingViewTechnicalAnalysisWidget from './TradingViewTechnicalAnalysisWidget';

interface SnapshotBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw: number;
}

interface SnapshotTrade {
  t: string;
  p: number;
  s: number;
}

interface SnapshotQuote {
  t: string;
  ap: number;
  as: number;
  bp: number;
  bs: number;
}

interface StockSnapshotData {
  latestTrade: SnapshotTrade;
  latestQuote: SnapshotQuote;
  minuteBar: SnapshotBar;
  dailyBar: SnapshotBar;
  prevDailyBar: SnapshotBar;
}

interface StockDetailProps {
  symbol: string;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function formatTime(t: string): string {
  try {
    return new Date(t).toLocaleTimeString();
  } catch {
    return t;
  }
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default function StockDetail({ symbol }: StockDetailProps) {
  const [data, setData] = useState<StockSnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const authorization = getAuthorizationHeader();
        if (!authorization) {
          throw new Error('Unauthorized. Please log in again.');
        }
        const response = await fetch(
          apiUrl(STOCK_SCREENER_BASE_URL, `/stock-screener/v1/stocks/${symbol}/snapshot`),
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authorization,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonData: StockSnapshotData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchDetails();
    }
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Loading stock details...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">
            Error loading stock details
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
          <Link
            href="/"
            className="inline-block mt-4 px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            Back to Screener
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600 dark:text-gray-400">
          No data available
        </p>
      </div>
    );
  }

  const change = data.dailyBar.c - data.prevDailyBar.c;
  const percentChange = (change / data.prevDailyBar.c) * 100;
  const isPositive = change >= 0;
  const spread = data.latestQuote.ap - data.latestQuote.bp;

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-black xl:p-8">
      <div className="mx-auto max-w-[1560px]">
        <Link
          href="/"
          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6"
        >
          <span className="mr-2">←</span> Back to Screener
        </Link>

        <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-zinc-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 text-sm uppercase tracking-[0.28em] text-gray-500 dark:text-gray-500">
                Symbol Overview
              </p>
              <h1 className="mb-3 text-5xl font-bold text-black dark:text-white">
                {symbol.toUpperCase()}
              </h1>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Last Trade</p>
                  <p className="text-4xl font-bold text-black dark:text-white">
                    {formatPrice(data.latestTrade.p)}
                  </p>
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                    isPositive
                      ? 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {change.toFixed(2)} ({percentChange.toFixed(2)}%)
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
                Last updated {formatTime(data.latestTrade.t)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:w-[420px]">
              {[
                { label: 'Prev Close', value: formatPrice(data.prevDailyBar.c) },
                { label: 'Today Volume', value: formatVolume(data.dailyBar.v) },
                { label: 'Bid/Ask Spread', value: `$${spread.toFixed(4)}` },
                { label: 'VWAP', value: formatPrice(data.dailyBar.vw) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-gray-200 bg-zinc-50 px-4 py-3 dark:border-gray-800 dark:bg-black"
                >
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-500">
                    {label}
                  </p>
                  <p className="text-sm font-semibold text-black dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[240px_minmax(0,1.45fr)_320px] 2xl:grid-cols-[260px_minmax(0,1.7fr)_340px]">
          <div className="space-y-6 xl:order-1">
            <BotControlPanel />

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
              <h2 className="mb-5 text-xl font-bold text-black dark:text-white">Today&apos;s Bar</h2>
              <div className="space-y-4">
                {[
                  { label: 'Open', value: formatPrice(data.dailyBar.o) },
                  { label: 'High', value: formatPrice(data.dailyBar.h) },
                  { label: 'Low', value: formatPrice(data.dailyBar.l) },
                  { label: 'Close', value: formatPrice(data.dailyBar.c) },
                  { label: 'VWAP', value: formatPrice(data.dailyBar.vw) },
                  { label: 'Volume', value: formatVolume(data.dailyBar.v) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{label}</span>
                    <span className="font-semibold text-black dark:text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
              <h2 className="mb-5 text-xl font-bold text-black dark:text-white">Latest Quote</h2>
              <div className="space-y-4">
                {[
                  { label: 'Ask Price', value: formatPrice(data.latestQuote.ap) },
                  { label: 'Ask Size', value: data.latestQuote.as.toString() },
                  { label: 'Bid Price', value: formatPrice(data.latestQuote.bp) },
                  { label: 'Bid Size', value: data.latestQuote.bs.toString() },
                  { label: 'Spread', value: `$${spread.toFixed(4)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{label}</span>
                    <span className="font-semibold text-black dark:text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
              <h2 className="mb-5 text-xl font-bold text-black dark:text-white">Previous Day</h2>
              <div className="space-y-4">
                {[
                  { label: 'Open', value: formatPrice(data.prevDailyBar.o) },
                  { label: 'High', value: formatPrice(data.prevDailyBar.h) },
                  { label: 'Low', value: formatPrice(data.prevDailyBar.l) },
                  { label: 'Close', value: formatPrice(data.prevDailyBar.c) },
                  { label: 'VWAP', value: formatPrice(data.prevDailyBar.vw) },
                  { label: 'Volume', value: formatVolume(data.prevDailyBar.v) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{label}</span>
                    <span className="font-semibold text-black dark:text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 xl:order-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
              <div className="mb-4 px-2 pt-2">
                <h2 className="text-2xl font-bold text-black dark:text-white">Chart</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Price action anchored around the current symbol.
                </p>
              </div>
              <TradingViewAdvancedChartWidget symbol={symbol} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
              <h2 className="mb-5 text-xl font-bold text-black dark:text-white">Company Profile</h2>
              <TradingViewCompanyProfileWidget symbol={symbol} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  label: 'Minute Close',
                  value: formatPrice(data.minuteBar.c),
                  accent: 'border-cyan-500',
                },
                {
                  label: 'Minute Range',
                  value: `${formatPrice(data.minuteBar.l)} - ${formatPrice(data.minuteBar.h)}`,
                  accent: 'border-amber-500',
                },
                {
                  label: 'Minute Volume',
                  value: formatVolume(data.minuteBar.v),
                  accent: 'border-fuchsia-500',
                },
              ].map(({ label, value, accent }) => (
                <div
                  key={label}
                  className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-zinc-900 ${accent}`}
                >
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-500">
                    {label}
                  </p>
                  <p className="text-lg font-semibold text-black dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 xl:order-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
              <h2 className="mb-5 text-xl font-bold text-black dark:text-white">Technicals</h2>
              <TradingViewTechnicalAnalysisWidget symbol={symbol} />
            </div>

            <SymbolNewsPanel symbol={symbol} />
          </div>
        </div>
      </div>
    </div>
  );
}

