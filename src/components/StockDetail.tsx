'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { STOCK_SCREENER_BASE_URL, apiUrl } from '@/lib/api';

interface StockDetailData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percent_change: number;
  market_cap?: string;
  pe_ratio?: number;
  dividend_yield?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  avg_volume?: number;
  sector?: string;
  industry?: string;
  description?: string;
}

interface StockDetailProps {
  symbol: string;
}

export default function StockDetail({ symbol }: StockDetailProps) {
  const [data, setData] = useState<StockDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        // TODO: Update this endpoint based on your backend API
        const response = await fetch(
          apiUrl(STOCK_SCREENER_BASE_URL, `/stock-screener/v1/stock/${symbol}`),
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

  const isPositive = data.percent_change >= 0;

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
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold text-black dark:text-white mb-2">
                {data.symbol}
              </h1>
              {data.name && (
                <p className="text-xl text-gray-600 dark:text-gray-400">
                  {data.name}
                </p>
              )}
            </div>
          </div>

          {/* Price Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                Current Price
              </p>
              <p className="text-3xl font-bold text-black dark:text-white">
                ${data.price.toFixed(2)}
              </p>
            </div>

            <div
              className={`border-l-4 pl-4 ${
                isPositive
                  ? 'border-green-500'
                  : 'border-red-500'
              }`}
            >
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                Change (1D)
              </p>
              <p
                className={`text-3xl font-bold ${
                  isPositive
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {isPositive ? '+' : ''}
                {data.change.toFixed(2)} ({data.percent_change.toFixed(2)}%)
              </p>
            </div>

            {data.sector && (
              <div className="border-l-4 border-purple-500 pl-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                  Sector
                </p>
                <p className="text-lg font-semibold text-black dark:text-white">
                  {data.sector}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Financial Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Left Column */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-6">
              Key Metrics
            </h2>

            <div className="space-y-4">
              {data.market_cap && (
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    Market Cap
                  </span>
                  <span className="font-semibold text-black dark:text-white">
                    {data.market_cap}
                  </span>
                </div>
              )}

              {data.pe_ratio !== undefined && (
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    P/E Ratio
                  </span>
                  <span className="font-semibold text-black dark:text-white">
                    {data.pe_ratio.toFixed(2)}
                  </span>
                </div>
              )}

              {data.dividend_yield !== undefined && (
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    Dividend Yield
                  </span>
                  <span className="font-semibold text-black dark:text-white">
                    {data.dividend_yield.toFixed(2)}%
                  </span>
                </div>
              )}

              {data.industry && (
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    Industry
                  </span>
                  <span className="font-semibold text-black dark:text-white">
                    {data.industry}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-6">
              52-Week Range
            </h2>

            <div className="space-y-4">
              {data.fifty_two_week_high && (
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    52-Week High
                  </span>
                  <span className="font-semibold text-black dark:text-white">
                    ${data.fifty_two_week_high.toFixed(2)}
                  </span>
                </div>
              )}

              {data.fifty_two_week_low && (
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    52-Week Low
                  </span>
                  <span className="font-semibold text-black dark:text-white">
                    ${data.fifty_two_week_low.toFixed(2)}
                  </span>
                </div>
              )}

              {data.avg_volume && (
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    Avg Volume
                  </span>
                  <span className="font-semibold text-black dark:text-white">
                    {(data.avg_volume / 1000000).toFixed(2)}M
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-4">
              About
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {data.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
