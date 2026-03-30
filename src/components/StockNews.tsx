'use client';

import { useEffect, useState } from 'react';
import { STOCK_SCREENER_BASE_URL, apiUrl } from '@/lib/api';
import { getAuthorizationHeader } from '@/lib/authSession';

interface StockImage {
  size: string;
  url: string;
}

interface NewsArticle {
  author: string;
  content: string;
  created_at: string;
  headline: string;
  id: number;
  images: StockImage[];
  source: string;
  summary: string;
  symbols: string[];
  updated_at: string;
  url: string;
}

interface NewsData {
  last_updated: string;
  news: NewsArticle[];
  next_page_token?: string;
}

interface StockNewsProps {
  limit?: number;
}

export default function StockNews({ limit = 10 }: StockNewsProps) {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [pageHistory, setPageHistory] = useState<(string | undefined)[]>([undefined]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(limit);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbolInput, setSymbolInput] = useState('');

  const fetchNews = async (token?: string) => {
    try {
      setLoading(true);
      setError(null);
      const authorization = getAuthorizationHeader();
      if (!authorization) {
        throw new Error('Unauthorized. Please log in again.');
      }
      
      let url = apiUrl(STOCK_SCREENER_BASE_URL, `/stock-screener/v1/news?limit=${pageSize}`);
      
      if (symbols.length > 0) {
        url += `&symbols=${symbols.join(',')}`;
      }
      
      if (token) {
        url += `&page_token=${token}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData: NewsData = await response.json();
      setData(jsonData);
      setPageToken(jsonData.next_page_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [pageSize, symbols]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPageToken(undefined);
    setPageHistory([undefined]);
    setCurrentPageIndex(0);
  };

  const handleAddSymbol = () => {
    const upperSymbol = symbolInput.toUpperCase().trim();
    if (upperSymbol && !symbols.includes(upperSymbol)) {
      setSymbols([...symbols, upperSymbol]);
      setSymbolInput('');
      setPageToken(undefined);
      setPageHistory([undefined]);
      setCurrentPageIndex(0);
    }
  };

  const handleRemoveSymbol = (symbol: string) => {
    setSymbols(symbols.filter((s) => s !== symbol));
    setPageToken(undefined);
    setPageHistory([undefined]);
    setCurrentPageIndex(0);
  };

  const handleAddSymbolKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSymbol();
    }
  };

  const handleNextPage = () => {
    if (pageToken) {
      const newPageIndex = currentPageIndex + 1;
      const newPageHistory = [...pageHistory];
      
      if (newPageIndex < newPageHistory.length) {
        newPageHistory[newPageIndex] = pageToken;
      } else {
        newPageHistory.push(pageToken);
      }
      
      setPageHistory(newPageHistory);
      setCurrentPageIndex(newPageIndex);
      fetchNews(pageToken);
    }
  };

  const handlePreviousPage = () => {
    if (currentPageIndex > 0) {
      const newPageIndex = currentPageIndex - 1;
      setCurrentPageIndex(newPageIndex);
      const prevPageToken = pageHistory[newPageIndex];
      fetchNews(prevPageToken);
    }
  };

  const canGoNext = !!pageToken;
  const canGoPrev = currentPageIndex > 0;

  if (loading && !data) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <p className="text-center text-gray-600 dark:text-gray-400">
          Loading news...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <p className="text-center text-red-600 dark:text-red-400">
          Error loading news: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-blue-200 dark:border-blue-900">
      <div className="bg-blue-50 dark:bg-blue-950 px-6 py-4 border-b border-blue-200 dark:border-blue-900">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              📰 Latest News
            </h2>
            <p className="text-sm text-blue-600 dark:text-blue-500">
              {data?.news.length || 0} articles
              {data?.last_updated && (
                <span className="ml-2">
                  (Last updated: {new Date(data.last_updated).toLocaleTimeString()})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-700 dark:text-blue-300 font-medium whitespace-nowrap">
              Per page:
            </label>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-3 py-1.5 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-100 text-sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Symbol Filter */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add symbol (e.g., AAPL)..."
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              onKeyDown={handleAddSymbolKeyDown}
              className="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-100 text-sm placeholder-blue-500 dark:placeholder-blue-400"
            />
            <button
              onClick={handleAddSymbol}
              className="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition text-sm font-medium"
            >
              Add
            </button>
          </div>
          
          {symbols.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {symbols.map((symbol) => (
                <span
                  key={symbol}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded-full text-sm font-medium"
                >
                  {symbol}
                  <button
                    onClick={() => handleRemoveSymbol(symbol)}
                    className="ml-1 hover:text-red-600 dark:hover:text-red-400 transition"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {symbols.length === 0 && (
            <p className="text-xs text-blue-600 dark:text-blue-400">No symbols selected - showing all news</p>
          )}
        </div>
      </div>

      <div className="p-6">
        {data?.news && data.news.length > 0 ? (
          <div className="space-y-6">
            {data.news.map((article) => (
              <article
                key={article.id}
                className="border-b border-gray-100 dark:border-gray-800 pb-6 last:border-b-0 last:pb-0"
              >
                <div className="flex gap-4">
                  {/* Article Image */}
                  {article.images && article.images.length > 0 && (
                    <div className="flex-shrink-0 w-24 h-24">
                      <img
                        src={article.images[0].url}
                        alt={article.headline}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}

                  {/* Article Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <a
                          href={article.url}
                          className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition"
                        >
                          {article.headline}
                        </a>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {article.source}
                          {article.author && ` • By ${article.author}`}
                        </p>
                      </div>
                      <time className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(article.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>

                    {article.summary && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
                        {article.summary}
                      </p>
                    )}

                    {/* Symbols Tags */}
                    {article.symbols && article.symbols.length > 0 && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {article.symbols.map((symbol) => (
                          <span
                            key={symbol}
                            className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium"
                          >
                            {symbol}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">
            No news available
          </p>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="bg-gray-50 dark:bg-zinc-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <button
          onClick={handlePreviousPage}
          disabled={!canGoPrev}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-400 dark:hover:bg-gray-600 transition"
        >
          ← Previous
        </button>

        <span className="text-sm text-gray-600 dark:text-gray-400">
          Page {currentPageIndex + 1}
        </span>

        <button
          onClick={handleNextPage}
          disabled={!canGoNext}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 dark:hover:bg-blue-600 transition"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
