'use client';

import { useEffect, useState } from 'react';

interface BalanceInfo {
  account_broker: string;
  balance: number;
  currency: string;
}

export default function Balance() {
  const [data, setData] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('http://localhost:9000/accounts/v1/balance', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonData: BalanceInfo = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">Loading balance information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 border border-red-700 rounded-lg p-8">
        <p className="text-red-200">Error loading balance: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-800 rounded-lg p-8">
        <p className="text-gray-400">No balance data available</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <p className="text-gray-400 text-sm mb-2">Account Balance</p>
      <p className="text-3xl font-bold text-green-400">
        {data.balance.toFixed(2)} {data.currency}
      </p>
      <p className="text-gray-500 text-xs mt-2">Account Broker: {data.account_broker}</p>
    </div>
  );
}
