'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StockSearchHeader from './StockSearchHeader';
import StockNews from './StockNews';
import ActiveStocks from './ActiveStocks';
import { STOCK_SCREENER_BASE_URL, apiUrl } from '@/lib/api';

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

export default function TopStockMovers() {
  const router = useRouter();
  const [data, setData] = useState<ScreenerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          apiUrl(STOCK_SCREENER_BASE_URL, `/stock-screener/v1/movers?limit=${limit}`),
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

        const jsonData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [limit]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      router.push(`/stock/${searchInput.toUpperCase()}`);
      setSearchInput('');
    }
  };

  const navigateToStock = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Loading market data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">
            Error loading data
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
            Make sure the screener backend is running on http://localhost:8080
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <StockSearchHeader
          searchInput={searchInput}
          onSearchChange={(value) => setSearchInput(value)}
          onSearch={handleSearch}
          lastUpdated={data?.last_updated}
        />

        {/* Controls */}
        <div className="mb-8 flex gap-4 items-center">
          <label className="text-gray-700 dark:text-gray-300 font-medium">
            Show top:
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-900 text-black dark:text-white"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gainers */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-green-200 dark:border-green-900">
            <div className="bg-green-50 dark:bg-green-950 px-6 py-4 border-b border-green-200 dark:border-green-900">
              <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">
                🚀 Top Gainers
              </h2>
              <p className="text-sm text-green-600 dark:text-green-500">
                {data?.gainers.length || 0} stocks
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-zinc-800">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Symbol
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Price
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Change (1D)
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                      % (1D)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.gainers && data.gainers.length > 0 ? (
                    data.gainers.map((stock) => (
                      <tr
                        key={stock.symbol}
                        onClick={() => navigateToStock(stock.symbol)}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-green-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                      >
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                          {stock.symbol}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-900 dark:text-gray-100">
                          ${stock.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-green-600 dark:text-green-400 font-semibold">
                          +${stock.change.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-green-600 dark:text-green-400 font-semibold">
                          +{stock.percent_change.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
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

          {/* Losers */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-red-200 dark:border-red-900">
            <div className="bg-red-50 dark:bg-red-950 px-6 py-4 border-b border-red-200 dark:border-red-900">
              <h2 className="text-2xl font-bold text-red-700 dark:text-red-400">
                📉 Top Losers
              </h2>
              <p className="text-sm text-red-600 dark:text-red-500">
                {data?.losers.length || 0} stocks
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-zinc-800">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Symbol
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Price
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Change (1D)
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                      % (1D)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.losers && data.losers.length > 0 ? (
                    data.losers.map((stock) => (
                      <tr
                        key={stock.symbol}
                        onClick={() => navigateToStock(stock.symbol)}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-red-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                      >
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                          {stock.symbol}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-900 dark:text-gray-100">
                          ${stock.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-red-600 dark:text-red-400 font-semibold">
                          -${Math.abs(stock.change).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-red-600 dark:text-red-400 font-semibold">
                          {stock.percent_change.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
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
        </div>

        {/* Most Active Stocks */}
        <div className="mt-12">
          <ActiveStocks initialLimit={10} />
        </div>

        {/* News Section */}
        <div className="mt-12">
          <StockNews limit={10} />
        </div>
      </div>
    </div>
  );
}
