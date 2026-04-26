'use client';

import { useEffect } from 'react';
import { useDeveloperMode } from '@/lib/developerMode';
import {
  type CurrencyFormat,
  formatCurrency,
  useCurrencyFormat,
} from '@/lib/currencyFormat';

const CURRENCY_FORMAT_OPTIONS: Array<{ value: CurrencyFormat; label: string; example: string }> = [
  { value: 'symbol', label: 'Symbol', example: formatCurrency(1234.5, 'USD', 'symbol') },
  { value: 'code', label: 'Code', example: formatCurrency(1234.5, 'USD', 'code') },
  { value: 'compact', label: 'Compact', example: formatCurrency(1234.5, 'USD', 'compact') },
];

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" d="M6 6l12 12M6 18 18 6" />
    </svg>
  );
}

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [devMode, setDevMode] = useDeveloperMode();
  const [currencyFormat, setFormat] = useCurrencyFormat();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Settings">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/5 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>

        <section className="mt-6 space-y-3">
          <header>
            <h3 className="text-sm font-semibold text-white">General</h3>
            <p className="text-xs text-gray-400">Display preferences applied across the app.</p>
          </header>
          <div className="rounded-xl border border-white/5 bg-black/30 p-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-400">
              Currency format
            </label>
            <select
              value={currencyFormat}
              onChange={(event) => setFormat(event.target.value as CurrencyFormat)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {CURRENCY_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} — {option.example}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mt-6 space-y-3">
          <header>
            <h3 className="text-sm font-semibold text-white">Advanced</h3>
            <p className="text-xs text-gray-400">Diagnostic toggles for debugging.</p>
          </header>
          <div className="rounded-xl border border-white/5 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Developer mode</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Show service URLs, account IDs, and other diagnostic details.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={devMode}
                onClick={() => setDevMode(!devMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  devMode ? 'bg-blue-600' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    devMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
