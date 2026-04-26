'use client';

import { useEffect, useMemo, useState } from 'react';
import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from '@/lib/api';
import type { BalanceInfo, DailyPnL, DailyPnLResult, TradingAccount } from '@/lib/account';
import { type AuthSession } from '@/lib/authSession';
import { getDailyPnL } from '@/lib/pnl';
import { formatCurrency, useCurrencyFormat } from '@/lib/currencyFormat';

interface YtdPerformanceProps {
  account: TradingAccount;
  session: AuthSession;
}

interface BalanceTrendPoint {
  date: string;
  balance: number;
}

// buildBalanceTrend reconstructs an estimated end-of-day balance series by
// walking backwards from the current net liquidating value and subtracting
// each day's net realized PnL. It excludes deposits/withdrawals and unrealized
// PnL, so it is an approximation of the balance trajectory rather than an
// audit.
function buildBalanceTrend(days: DailyPnL[], currentBalance: number): BalanceTrendPoint[] {
  if (days.length === 0) return [];
  const points: BalanceTrendPoint[] = new Array(days.length);
  let runningBalance = currentBalance;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    points[i] = { date: days[i].date, balance: runningBalance };
    runningBalance -= days[i].realized_pnl - days[i].fees;
  }
  return points;
}

function startOfYearISO(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-01-01`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function BalanceTrendChart({
  points,
  format,
  currency,
}: {
  points: BalanceTrendPoint[];
  format: ReturnType<typeof useCurrencyFormat>[0];
  currency: string;
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-500">Not enough data yet to draw a balance trend.</p>
    );
  }
  const width = 600;
  const height = 160;
  const paddingX = 8;
  const paddingY = 12;
  const balances = points.map((p) => p.balance);
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);
  const range = maxBalance - minBalance || 1;
  const stepX = (width - paddingX * 2) / (points.length - 1);
  const path = points
    .map((point, index) => {
      const x = paddingX + index * stepX;
      const y = paddingY + (1 - (point.balance - minBalance) / range) * (height - paddingY * 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const areaPath = `${path} L${(paddingX + (points.length - 1) * stepX).toFixed(2)} ${(height - paddingY).toFixed(2)} L${paddingX.toFixed(2)} ${(height - paddingY).toFixed(2)} Z`;
  const first = points[0].balance;
  const last = points[points.length - 1].balance;
  const isUp = last >= first;
  const stroke = isUp ? '#34d399' : '#f87171';
  const fill = isUp ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)';
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-gray-500">
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-40 w-full" preserveAspectRatio="none">
        <path d={areaPath} fill={fill} />
        <path d={path} fill="none" stroke={stroke} strokeWidth={2} />
      </svg>
      <div className="mt-1 flex items-baseline justify-between text-xs text-gray-400">
        <span>{formatCurrency(minBalance, currency, format)} low</span>
        <span>{formatCurrency(maxBalance, currency, format)} high</span>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-300'
      : tone === 'negative'
        ? 'text-red-300'
        : 'text-white';
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function YtdPerformance({ account, session }: YtdPerformanceProps) {
  const [pnl, setPnL] = useState<DailyPnLResult | null>(null);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [format] = useCurrencyFormat();

  useEffect(() => {
    let cancelled = false;
    const authorization = `${session.token_type} ${session.access_token}`;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [pnlResult, balanceResponse] = await Promise.all([
          getDailyPnL(authorization, account.account_id, startOfYearISO(), todayISO()),
          fetch(
            apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${account.account_id}/balances`),
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: authorization,
              },
            },
          ),
        ]);
        if (!balanceResponse.ok) {
          throw new Error(`Failed to load balance (${balanceResponse.status})`);
        }
        const balanceJson = (await balanceResponse.json()) as BalanceInfo;
        if (cancelled) return;
        setPnL(pnlResult);
        setBalance(balanceJson);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load YTD performance.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [account.account_id, session.access_token, session.token_type]);

  const trend = useMemo(() => {
    if (!pnl || !balance) return [];
    return buildBalanceTrend(pnl.days, balance.net_liquidating_value);
  }, [pnl, balance]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
        <div className="h-5 w-40 animate-pulse rounded bg-white/5" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!pnl || !balance) {
    return null;
  }

  const summary = pnl.summary;
  const currency = pnl.currency || balance.currency || 'USD';
  const netTone: 'positive' | 'negative' | 'neutral' =
    summary.net_pnl_after_fees > 0 ? 'positive' : summary.net_pnl_after_fees < 0 ? 'negative' : 'neutral';
  const winRatePct = `${(summary.win_rate * 100).toFixed(1)}%`;
  const winsLossesValue = `${summary.winning_trades} W / ${summary.losing_trades} L`;

  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-950/60 p-6 shadow-xl">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-white">YTD performance</h3>
        <p className="text-xs text-gray-500">
          {pnl.days.length > 0
            ? `${pnl.days[0].date} → ${pnl.days[pnl.days.length - 1].date}`
            : 'No activity this year'}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Net PnL (after fees)"
          value={formatCurrency(summary.net_pnl_after_fees, currency, format)}
          tone={netTone}
        />
        <StatTile label="Total trades" value={summary.total_trades.toLocaleString()} />
        <StatTile label="Wins / losses" value={winsLossesValue} />
        <StatTile label="Win rate" value={winRatePct} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Gross wins"
          value={formatCurrency(summary.gross_wins, currency, format)}
          tone="positive"
        />
        <StatTile
          label="Gross losses"
          value={formatCurrency(summary.gross_losses, currency, format)}
          tone="negative"
        />
        <StatTile label="Fees" value={formatCurrency(summary.fees, currency, format)} />
        <StatTile
          label="Net PnL"
          value={formatCurrency(summary.net_pnl, currency, format)}
          tone={summary.net_pnl > 0 ? 'positive' : summary.net_pnl < 0 ? 'negative' : 'neutral'}
        />
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          Estimated balance trend
        </p>
        <div className="mt-2">
          <BalanceTrendChart points={trend} format={format} currency={currency} />
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Reconstructed from current Net Liq and daily realized PnL — excludes deposits, withdrawals,
          and unrealized PnL.
        </p>
      </div>
    </div>
  );
}
