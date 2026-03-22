'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ActiveStock {
  symbol: string;
  trade_count: number;
  volume: number;
}

interface ActiveStocksData {
  last_updated: string;
  most_actives: ActiveStock[];
}

interface ActiveStocksProps {
  initialLimit?: number;
}

export default function ActiveStocks({ initialLimit = 10 }: ActiveStocksProps) {
  const router = useRouter();
  const [data, setData] = useState<ActiveStocksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rankBy, setRankBy] = useState<'trades' | 'volume'>('trades');
  const [limit, setLimit] = useState(initialLimit);

  useEffect(() => {
    const fetchActiveStocks = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `http://localhost:8080/stock-screener/v1/most-actives?limit=${limit}&rank_by=${rankBy}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonData: ActiveStocksData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchActiveStocks();
    const interval = setInterval(fetchActiveStocks, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [limit, rankBy]);

  const navigateToStock = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  if (loading && !data) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <p className="text-center text-gray-600 dark:text-gray-400">
          Loading active stocks...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <p className="text-center text-red-600 dark:text-red-400">
          Error loading active stocks: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-orange-200 dark:border-orange-900">
      <div className="bg-orange-50 dark:bg-orange-950 px-6 py-4 border-b border-orange-200 dark:border-orange-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              🔥 Most Active Stocks
            </h2>
            <p className="text-sm text-orange-600 dark:text-orange-500">
              {data?.most_actives.length || 0} stocks
              {data?.last_updated && (
                <span className="ml-2">
                  (Last updated: {new Date(data.last_updated).toLocaleTimeString()})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-orange-700 dark:text-orange-300 font-medium whitespace-nowrap">
                Show:
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-3 py-1.5 border border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-zinc-800 text-orange-900 dark:text-orange-100 text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-orange-700 dark:text-orange-300 font-medium whitespace-nowrap">
                Rank by:
              </label>
              <select
                value={rankBy}
                onChange={(e) => setRankBy(e.target.value as 'trades' | 'volume')}
                className="px-3 py-1.5 border border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-zinc-800 text-orange-900 dark:text-orange-100 text-sm"
              >
                <option value="trades">Trade Count</option>
                <option value="volume">Volume</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-zinc-800">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                #
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Symbol
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                {rankBy === 'trades' ? 'Trade Count' : 'Volume'}
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.most_actives && data.most_actives.length > 0 ? (
              data.most_actives.map((stock, index) => (
                <tr
                  key={stock.symbol}
                  onClick={() => navigateToStock(stock.symbol)}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-orange-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                    {stock.symbol}
                  </td>
                  <td className="px-6 py-4 text-right text-orange-600 dark:text-orange-400 font-semibold">
                    {rankBy === 'trades'
                      ? stock.trade_count.toLocaleString()
                      : (stock.volume / 1000000).toFixed(2) + 'M'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                >
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
