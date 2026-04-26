'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DailyPnL, DailyPnLResult } from '@/lib/account';
import { getDailyPnL } from '@/lib/pnl';
import { listJournalEntries, type JournalEntry } from '@/lib/journal';
import JournalEntryDrawer from './JournalEntryDrawer';

interface JournalCalendarProps {
  authorization: string;
  pnlAccountIDs: string[];
}

const netPnL = (day: { realized_pnl: number; fees: number }) =>
  day.realized_pnl - day.fees;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => n.toString().padStart(2, '0');

const formatDate = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
};

const pnlCellClass = (pnl: number) => {
  if (pnl > 0) {
    const intensity = Math.min(1, Math.abs(pnl) / 500);
    if (intensity > 0.66) return 'bg-green-600/40 border-green-500/50';
    if (intensity > 0.33) return 'bg-green-600/25 border-green-500/40';
    return 'bg-green-600/10 border-green-500/30';
  }
  if (pnl < 0) {
    const intensity = Math.min(1, Math.abs(pnl) / 500);
    if (intensity > 0.66) return 'bg-red-600/40 border-red-500/50';
    if (intensity > 0.33) return 'bg-red-600/25 border-red-500/40';
    return 'bg-red-600/10 border-red-500/30';
  }
  return 'border-gray-800';
};

export default function JournalCalendar({
  authorization,
  pnlAccountIDs,
}: JournalCalendarProps) {
  const hasPnLSource = pnlAccountIDs.length > 0;
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [pnlResult, setPnlResult] = useState<DailyPnLResult | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = formatDate(cursor.year, cursor.month, 1);
  const monthEnd = formatDate(cursor.year, cursor.month, daysInMonth(cursor.year, cursor.month));

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const journalPromise = listJournalEntries(authorization, monthStart, monthEnd);
      const pnlPromise: Promise<DailyPnLResult | null> = hasPnLSource
        ? Promise.all(
            pnlAccountIDs.map((id) =>
              getDailyPnL(authorization, id, monthStart, monthEnd).catch((pnlErr: Error) => {
                setError(`PnL unavailable for an account: ${pnlErr.message}`);
                return null;
              })
            )
          ).then((results) => {
            const successful = results.filter(
              (result): result is DailyPnLResult => result !== null
            );
            if (successful.length === 0) return null;
            const merged = new Map<string, DailyPnL>();
            for (const result of successful) {
              for (const day of result.days) {
                const existing = merged.get(day.date);
                if (existing) {
                  existing.realized_pnl += day.realized_pnl;
                  existing.fees += day.fees;
                  existing.trade_count += day.trade_count;
                } else {
                  merged.set(day.date, { ...day });
                }
              }
            }
            const days = Array.from(merged.values()).sort((a, b) =>
              a.date < b.date ? -1 : a.date > b.date ? 1 : 0
            );
            const currency =
              successful.find((result) => result.currency)?.currency ?? 'USD';
            const summary = successful.reduce(
              (accumulator, result) => ({
                total_trades: accumulator.total_trades + result.summary.total_trades,
                winning_trades: accumulator.winning_trades + result.summary.winning_trades,
                losing_trades: accumulator.losing_trades + result.summary.losing_trades,
                net_pnl: accumulator.net_pnl + result.summary.net_pnl,
                net_pnl_after_fees:
                  accumulator.net_pnl_after_fees + result.summary.net_pnl_after_fees,
                fees: accumulator.fees + result.summary.fees,
                gross_wins: accumulator.gross_wins + result.summary.gross_wins,
                gross_losses: accumulator.gross_losses + result.summary.gross_losses,
                win_rate: 0,
              }),
              {
                total_trades: 0,
                winning_trades: 0,
                losing_trades: 0,
                net_pnl: 0,
                net_pnl_after_fees: 0,
                fees: 0,
                gross_wins: 0,
                gross_losses: 0,
                win_rate: 0,
              },
            );
            const decided = summary.winning_trades + summary.losing_trades;
            summary.win_rate = decided > 0 ? summary.winning_trades / decided : 0;
            return { currency, days, summary };
          })
        : Promise.resolve(null);
      const [journalResult, pnl] = await Promise.all([journalPromise, pnlPromise]);
      setEntries(journalResult.entries);
      setPnlResult(pnl);
    } catch (loadErr) {
      setError((loadErr as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authorization, hasPnLSource, pnlAccountIDs, monthStart, monthEnd]);

  useEffect(() => {
    reload();
  }, [reload]);

  const pnlByDate = useMemo(() => {
    const map = new Map<string, DailyPnL>();
    (pnlResult?.days ?? []).forEach((day) => map.set(day.date, day));
    return map;
  }, [pnlResult]);

  const entryDates = useMemo(() => new Set(entries.map((entry) => entry.date)), [entries]);

  const monthTotal = useMemo(
    () => (pnlResult?.days ?? []).reduce((sum, day) => sum + netPnL(day), 0),
    [pnlResult]
  );

  const goToPreviousMonth = () => {
    setCursor((current) => {
      if (current.month === 0) return { year: current.year - 1, month: 11 };
      return { year: current.year, month: current.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setCursor((current) => {
      if (current.month === 11) return { year: current.year + 1, month: 0 };
      return { year: current.year, month: current.month + 1 };
    });
  };

  const goToToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
  };

  const currency = pnlResult?.currency ?? 'USD';
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const leadingBlanks = firstDayOfMonth(cursor.year, cursor.month);
  const totalDays = daysInMonth(cursor.year, cursor.month);
  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({ date: null, day: null });
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ date: formatDate(cursor.year, cursor.month, day), day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            →
          </button>
          <h2 className="text-xl font-semibold text-white ml-2">{monthLabel}</h2>
        </div>
        {pnlResult && (
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-500">Month total</div>
            <div
              className={`text-lg font-semibold ${
                monthTotal > 0 ? 'text-green-400' : monthTotal < 0 ? 'text-red-400' : 'text-gray-300'
              }`}
            >
              {formatCurrency(monthTotal, currency)}
            </div>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400 mb-2">Loading…</p>}
      {error && <p className="text-sm text-amber-400 mb-2">{error}</p>}
      {!hasPnLSource && (
        <p className="text-sm text-gray-500 mb-4">
          Link a broker to see realized PnL per day. Journal notes still work without one.
        </p>
      )}

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs uppercase tracking-wide text-gray-500 py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell.date) {
            return <div key={`blank-${index}`} className="aspect-square" />;
          }
          const pnl = pnlByDate.get(cell.date);
          const net = pnl ? netPnL(pnl) : 0;
          const hasEntry = entryDates.has(cell.date);
          const isToday =
            cell.date === formatDate(today.getFullYear(), today.getMonth(), today.getDate());
          return (
            <button
              type="button"
              key={cell.date}
              onClick={() => setSelectedDate(cell.date)}
              className={`aspect-square rounded-lg border p-2 text-left transition hover:ring-2 hover:ring-blue-500/50 ${
                pnl ? pnlCellClass(net) : 'border-gray-800 bg-gray-900'
              } ${isToday ? 'ring-1 ring-blue-500/60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs text-gray-400">{cell.day}</span>
                {hasEntry && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
              </div>
              {pnl && (
                <div
                  className={`mt-1 text-sm font-semibold ${
                    net > 0
                      ? 'text-green-300'
                      : net < 0
                        ? 'text-red-300'
                        : 'text-gray-300'
                  }`}
                >
                  {formatCurrency(net, currency)}
                </div>
              )}
              {pnl && (
                <div className="text-[10px] text-gray-500">
                  {pnl.trade_count} trade{pnl.trade_count === 1 ? '' : 's'}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <JournalEntryDrawer
        authorization={authorization}
        date={selectedDate}
        pnl={selectedDate ? pnlByDate.get(selectedDate) : undefined}
        currency={currency}
        onClose={() => setSelectedDate(null)}
        onSaved={reload}
      />
    </div>
  );
}
