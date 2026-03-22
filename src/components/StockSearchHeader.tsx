'use client';

interface StockSearchHeaderProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  onSearch: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  lastUpdated?: string;
}

export default function StockSearchHeader({
  searchInput,
  onSearchChange,
  onSearch,
  lastUpdated,
}: StockSearchHeaderProps) {
  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-black dark:text-white">
          Stock Screener
        </h1>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search for a stock symbol (e.g., AAPL)..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onSearch}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Press Enter to search
          {lastUpdated && (
            <span className="ml-4">
              (Last updated: {new Date(lastUpdated).toLocaleTimeString()})
            </span>
          )}
        </p>
      </div>
    </>
  );
}
