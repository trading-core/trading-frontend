'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StockNews from './StockNews';
import ActiveStocks from './ActiveStocks';
import TradingViewStockHeatmapWidget from './TradingViewStockHeatmapWidget';
import FearGreedCard from './FearGreedCard';
import { STOCK_SCREENER_BASE_URL, apiUrl } from '@/lib/api';
import { getAuthorizationHeader } from '@/lib/authSession';
import { useDeveloperMode } from '@/lib/developerMode';

interface MoverStock {
  symbol: string;
  price: number;
  change: number;
  percent_change: number;
}

interface ScreenerData {
  last_updated: string;
  gainers: MoverStock[];
  losers: MoverStock[];
}

const formatRelativeTime = (iso: string | undefined): string => {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleString();
};

interface MoversTableProps {
  variant: 'gainer' | 'loser';
  rows: MoverStock[] | undefined;
  onRowClick: (symbol: string) => void;
}

function MoversTable({ variant, rows, onRowClick }: MoversTableProps) {
  const isGainer = variant === 'gainer';
  const accent = isGainer
    ? 'text-emerald-400'
    : 'text-rose-400';
  const accentDot = isGainer ? 'bg-emerald-400' : 'bg-rose-400';

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/60 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${accentDot}`} />
          <h2 className="text-base font-semibold text-white">
            {isGainer ? 'Top Gainers' : 'Top Losers'}
          </h2>
        </div>
        <span className="text-xs text-gray-500">{rows?.length ?? 0} stocks</span>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 bg-zinc-950/95 backdrop-blur">
              <th className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Symbol
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Price
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Change
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-500">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {rows && rows.length > 0 ? (
              rows.map((stock) => (
                <tr
                  key={stock.symbol}
                  onClick={() => onRowClick(stock.symbol)}
                  className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                >
                  <td className="px-5 py-3 font-semibold text-white">{stock.symbol}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-200">
                    ${stock.price.toFixed(2)}
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums font-medium ${accent}`}>
                    {isGainer ? '+' : '-'}${Math.abs(stock.change).toFixed(2)}
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums font-semibold ${accent}`}>
                    {isGainer ? '+' : ''}
                    {stock.percent_change.toFixed(2)}%
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-500">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MoversTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/60 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4">
            <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
            <div className="flex gap-6">
              <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-14 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-12 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TopStockMovers() {
  const router = useRouter();
  const [data, setData] = useState<ScreenerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const [devMode] = useDeveloperMode();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const authorization = getAuthorizationHeader();
        if (!authorization) {
          throw new Error('Unauthorized. Please log in again.');
        }
        const response = await fetch(
          apiUrl(STOCK_SCREENER_BASE_URL, `/stock-screener/v1/movers?limit=${limit}`),
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

        const jsonData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, [limit]);

  const navigateToStock = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-rose-400">
              <path
                d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-white">Couldn&apos;t load market data</p>
          <p className="mt-2 text-sm text-gray-400">{error}</p>
          {devMode && (
            <p className="mt-4 text-xs text-gray-500">
              Make sure the screener backend is running on http://localhost:8080
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-black p-6 text-white sm:p-8">
      <div className="mx-auto max-w-7xl space-y-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Market Screener</h1>
            <p className="mt-1 text-sm text-gray-400">
              {data?.last_updated
                ? `Updated ${formatRelativeTime(data.last_updated)} · auto-refreshes every 30s`
                : 'Live market movers, refreshed every 30s.'}
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-xl border border-white/5 bg-zinc-950/60 px-3 py-2 sm:self-auto">
            <label htmlFor="mover-limit" className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Show top
            </label>
            <select
              id="mover-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border border-white/10 bg-black px-2.5 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Movers */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {loading && !data ? (
            <>
              <MoversTableSkeleton />
              <MoversTableSkeleton />
            </>
          ) : (
            <>
              <MoversTable variant="gainer" rows={data?.gainers} onRowClick={navigateToStock} />
              <MoversTable variant="loser" rows={data?.losers} onRowClick={navigateToStock} />
            </>
          )}
        </div>

        {/* Active + Sentiment */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ActiveStocks initialLimit={10} />
          <FearGreedCard />
        </div>

        {/* Heatmap */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/60 shadow-xl">
          <div className="border-b border-white/5 px-6 py-4">
            <h2 className="text-base font-semibold text-white">Sector Heat Map</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              S&amp;P 500 sector performance at a glance.
            </p>
          </div>
          <div className="p-4">
            <TradingViewStockHeatmapWidget />
          </div>
        </div>

        {/* News */}
        <StockNews limit={10} />
      </div>
    </div>
  );
}
