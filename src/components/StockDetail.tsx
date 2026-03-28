'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { STOCK_SCREENER_BASE_URL, apiUrl } from '@/lib/api';
import { getAuthorizationHeader } from '@/lib/authSession';

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6"
        >
          <span className="mr-2">←</span> Back to Screener
        </Link>

        {/* Header */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 mb-8 border border-gray-200 dark:border-gray-700">
          <h1 className="text-5xl font-bold text-black dark:text-white mb-6">
            {symbol}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                Last Trade
              </p>
              <p className="text-3xl font-bold text-black dark:text-white">
                ${data.latestTrade.p.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {formatTime(data.latestTrade.t)}
              </p>
            </div>

            <div
              className={`border-l-4 pl-4 ${isPositive ? 'border-green-500' : 'border-red-500'}`}
            >
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                Change (1D)
              </p>
              <p
                className={`text-3xl font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {isPositive ? '+' : ''}
                {change.toFixed(2)} ({percentChange.toFixed(2)}%)
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                Volume (Today)
              </p>
              <p className="text-3xl font-bold text-black dark:text-white">
                {formatVolume(data.dailyBar.v)}
              </p>
            </div>
          </div>
        </div>

        {/* Today's Bar & Latest Quote */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-6">
              Today&apos;s Bar
            </h2>
            <div className="space-y-4">
              {[
                { label: 'Open', value: `$${data.dailyBar.o.toFixed(2)}` },
                { label: 'High', value: `$${data.dailyBar.h.toFixed(2)}` },
                { label: 'Low', value: `$${data.dailyBar.l.toFixed(2)}` },
                { label: 'Close', value: `$${data.dailyBar.c.toFixed(2)}` },
                { label: 'VWAP', value: `$${data.dailyBar.vw.toFixed(2)}` },
                { label: 'Volume', value: formatVolume(data.dailyBar.v) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800"
                >
                  <span className="text-gray-600 dark:text-gray-400">
                    {label}
                  </span>
                  <span className="font-semibold text-black dark:text-white">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-6">
              Latest Quote
            </h2>
            <div className="space-y-4">
              {[
                { label: 'Ask Price', value: `$${data.latestQuote.ap.toFixed(2)}` },
                { label: 'Ask Size', value: data.latestQuote.as.toString() },
                { label: 'Bid Price', value: `$${data.latestQuote.bp.toFixed(2)}` },
                { label: 'Bid Size', value: data.latestQuote.bs.toString() },
                {
                  label: 'Spread',
                  value: `$${(data.latestQuote.ap - data.latestQuote.bp).toFixed(4)}`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800"
                >
                  <span className="text-gray-600 dark:text-gray-400">
                    {label}
                  </span>
                  <span className="font-semibold text-black dark:text-white">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Previous Day */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-black dark:text-white mb-6">
            Previous Day
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {[
              { label: 'Open', value: `$${data.prevDailyBar.o.toFixed(2)}` },
              { label: 'High', value: `$${data.prevDailyBar.h.toFixed(2)}` },
              { label: 'Low', value: `$${data.prevDailyBar.l.toFixed(2)}` },
              { label: 'Close', value: `$${data.prevDailyBar.c.toFixed(2)}` },
              { label: 'VWAP', value: `$${data.prevDailyBar.vw.toFixed(2)}` },
              { label: 'Volume', value: formatVolume(data.prevDailyBar.v) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="border-l-4 border-gray-300 dark:border-gray-600 pl-4"
              >
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {label}
                </p>
                <p className="font-semibold text-black dark:text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

