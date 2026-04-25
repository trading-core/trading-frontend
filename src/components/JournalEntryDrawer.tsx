'use client';

import { useEffect, useState } from 'react';
import {
  deleteJournalEntry,
  getJournalEntry,
  upsertJournalEntry,
  type JournalEntry,
} from '@/lib/journal';
import type { DailyPnL } from '@/lib/account';

interface JournalEntryDrawerProps {
  authorization: string;
  date: string | null;
  pnl?: DailyPnL;
  currency?: string;
  onClose: () => void;
  onSaved: () => void;
}

const MOOD_OPTIONS = ['', 'focused', 'confident', 'anxious', 'tilted', 'bored', 'frustrated'];

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

export default function JournalEntryDrawer({
  authorization,
  date,
  pnl,
  currency = 'USD',
  onClose,
  onSaved,
}: JournalEntryDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [mood, setMood] = useState('');
  const [disciplineScore, setDisciplineScore] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getJournalEntry(authorization, date)
      .then((loaded) => {
        if (cancelled) return;
        setEntry(loaded);
        setNotes(loaded?.notes ?? '');
        setTagsInput((loaded?.tags ?? []).join(', '));
        setMood(loaded?.mood ?? '');
        setDisciplineScore(loaded?.discipline_score ?? 0);
      })
      .catch((loadErr: Error) => {
        if (cancelled) return;
        setError(loadErr.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authorization, date]);

  if (!date) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      await upsertJournalEntry(authorization, date, {
        notes: notes || undefined,
        tags: tags.length > 0 ? tags : undefined,
        mood: mood || undefined,
        discipline_score: disciplineScore > 0 ? disciplineScore : undefined,
      });
      onSaved();
      onClose();
    } catch (saveErr) {
      setError((saveErr as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteJournalEntry(authorization, date);
      onSaved();
      onClose();
    } catch (deleteErr) {
      setError((deleteErr as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const realized = pnl?.realized_pnl ?? 0;
  const fees = pnl?.fees ?? 0;
  const net = realized - fees;
  const pnlColor = net > 0 ? 'text-green-400' : net < 0 ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Close"
        className="flex-1 bg-black/60"
        onClick={onClose}
      />
      <div className="w-full max-w-md bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">{date}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm"
          >
            Close
          </button>
        </div>

        {pnl && (
          <div className="mb-6 rounded-lg border border-gray-800 bg-gray-800/50 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">Net PnL</div>
            <div className={`text-2xl font-semibold ${pnlColor}`}>
              {formatCurrency(net, currency)}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              {pnl.trade_count} trade{pnl.trade_count === 1 ? '' : 's'} · realized{' '}
              {formatCurrency(realized, currency)} · fees {formatCurrency(fees, currency)}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={8}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                placeholder="What went well? What would you change? Setup quality, execution, emotions…"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                placeholder="breakout, AAPL, earnings"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">
                  Mood
                </label>
                <select
                  value={mood}
                  onChange={(event) => setMood(event.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {MOOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option || '—'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">
                  Discipline (0–10)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={disciplineScore}
                  onChange={(event) => setDisciplineScore(Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              {entry ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50"
                >
                  Delete entry
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
