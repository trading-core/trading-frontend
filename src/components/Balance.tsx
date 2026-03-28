'use client';

import { useEffect, useState } from 'react';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import { type TradingAccount, type BalanceInfo } from '@/lib/account';
import { type AuthSession } from '@/lib/authSession';

interface BalanceProps {
  account: TradingAccount;
  session: AuthSession;
}

const formatBrokerType = (brokerType?: string) => {
  if (!brokerType) {
    return 'Unlinked';
  }
  return brokerType
    .split(/[-_]/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

export default function Balance({ account, session }: BalanceProps) {
  const [data, setData] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${account.account_id}/balances`),
          {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `${session.token_type} ${session.access_token}`,
          },
          },
        );

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `HTTP error! status: ${response.status}`);
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
  }, [account.account_id, session.access_token, session.token_type]);

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
      <p className="text-gray-500 text-xs mb-3">{account.name}</p>
      <p className="text-3xl font-bold text-green-400">
        {data.balance.toFixed(2)} {data.currency}
      </p>
      <p className="text-gray-500 text-xs mt-2">
        Broker: {formatBrokerType(account.broker_account?.account_type)}
      </p>
    </div>
  );
}
