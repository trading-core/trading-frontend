'use client';

import { useEffect, useState } from 'react';
import { STOCK_SCREENER_BASE_URL, apiUrl } from '@/lib/api';
import { getAuthorizationHeader } from '@/lib/authSession';

interface NewsArticle {
  id: number;
  headline: string;
  source: string;
  summary: string;
  created_at: string;
  url: string;
}

interface NewsData {
  news: NewsArticle[];
}

interface SymbolNewsPanelProps {
  symbol: string;
  limit?: number;
}

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function SymbolNewsPanel({
  symbol,
  limit = 4,
}: SymbolNewsPanelProps) {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError(null);
        const authorization = getAuthorizationHeader();
        if (!authorization) {
          throw new Error('Unauthorized. Please log in again.');
        }

        const response = await fetch(
          apiUrl(
            STOCK_SCREENER_BASE_URL,
            `/stock-screener/v1/news?limit=${limit}&symbols=${encodeURIComponent(symbol)}`
          ),
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

        const jsonData: NewsData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchNews();
    }
  }, [limit, symbol]);

  return (
    <div className="rounded-2xl border border-sky-200 bg-white shadow-lg dark:border-sky-900 dark:bg-zinc-900">
      <div className="border-b border-sky-200 bg-sky-50 px-5 py-4 dark:border-sky-900 dark:bg-sky-950/60">
        <h2 className="text-xl font-bold text-sky-700 dark:text-sky-300">
          Recent News
        </h2>
      </div>

      <div className="p-5">
        {loading && !data ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading news...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : data?.news.length ? (
          <div className="space-y-4">
            {data.news.map((article) => (
              <a
                key={article.id}
                href={article.url}
                className="block rounded-xl border border-gray-200 p-4 transition hover:border-sky-300 hover:bg-sky-50/40 dark:border-gray-800 dark:hover:border-sky-800 dark:hover:bg-zinc-800"
              >
                <p className="mb-2 text-sm font-semibold text-black dark:text-white">
                  {article.headline}
                </p>
                <p className="mb-3 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
                  {article.summary}
                </p>
                <div className="flex items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-500">
                  <span>{article.source}</span>
                  <span>{formatTimestamp(article.created_at)}</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No recent news for {symbol.toUpperCase()}.
          </p>
        )}
      </div>
    </div>
  );
}
