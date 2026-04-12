'use client';

import { useState } from 'react';

const TIMEFRAME_OPTIONS = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d'] as const;
const SOURCE_OPTIONS = ['alpaca', 'tastytrade'] as const;

export interface BacktestFormValues {
  symbol: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  source: string;
  cash: string;
  // tradingstrategy.Parameters
  timeframe: string;
  maxPositionFraction: string;
  atrMultiplier: string;
  sessionStart: string;
  sessionEnd: string;
  reentryCooldownMinutes: string;
  oversoldRSI: string;
  overboughtRSI: string;
  lookbackBars: string;
  riskPerTradePct: string;
}

const DEFAULT_VALUES: BacktestFormValues = {
  symbol: '',
  startDate: '',
  startTime: '09:30',
  endDate: '',
  endTime: '16:00',
  source: 'alpaca',
  cash: '100000',
  timeframe: '1h',
  maxPositionFraction: '0.1',
  atrMultiplier: '2',
  sessionStart: '',
  sessionEnd: '',
  reentryCooldownMinutes: '',
  oversoldRSI: '30',
  overboughtRSI: '70',
  lookbackBars: '',
  riskPerTradePct: '',
};

/** Combines a date string (YYYY-MM-DD) and time string (HH:mm) into an RFC3339 UTC datetime. */
const combineDateTime = (date: string, time: string): string | undefined => {
  if (!date) return undefined;
  const t = time || '00:00';
  return `${date}T${t}:00Z`;
};

/** Serialises form values into the parameters map the worker expects. */
export function buildBacktestParameters(values: BacktestFormValues): Record<string, string> {
  const floatOrUndefined = (s: string) => {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : undefined;
  };
  const intOrUndefined = (s: string) => {
    const v = parseInt(s, 10);
    return Number.isFinite(v) ? v : undefined;
  };

  const payload = {
    symbol: values.symbol.trim().toUpperCase(),
    start: combineDateTime(values.startDate, values.startTime),
    end: combineDateTime(values.endDate, values.endTime),
    source: values.source,
    cash: parseInt(values.cash, 10) || 100000,
    trading_params: {
      timeframe: values.timeframe || undefined,
      max_position_fraction: floatOrUndefined(values.maxPositionFraction),
      atr_multiplier: floatOrUndefined(values.atrMultiplier),
      session_start: intOrUndefined(values.sessionStart),
      session_end: intOrUndefined(values.sessionEnd),
      reentry_cooldown_minutes: intOrUndefined(values.reentryCooldownMinutes),
      oversold_rsi: floatOrUndefined(values.oversoldRSI),
      overbought_rsi: floatOrUndefined(values.overboughtRSI),
      lookback_bars: intOrUndefined(values.lookbackBars),
      risk_per_trade_pct: floatOrUndefined(values.riskPerTradePct),
    },
  };

  return { json: JSON.stringify(payload) };
}

/** Returns a validation error string, or null if valid. */
export function validateBacktestForm(values: BacktestFormValues): string | null {
  if (!values.symbol.trim()) return 'Symbol is required.';
  if (!values.startDate) return 'Start date is required.';
  return null;
}

interface BacktestReportFormProps {
  values: BacktestFormValues;
  onChange: (values: BacktestFormValues) => void;
}

export default function BacktestReportForm({ values, onChange }: BacktestReportFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (field: keyof BacktestFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...values, [field]: event.target.value });

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-zinc-800 dark:text-white';
  const labelClass =
    'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400';

  return (
    <div className="space-y-3">
      {/* Core */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass}>Symbol</label>
          <input
            type="text"
            value={values.symbol}
            onChange={set('symbol')}
            placeholder="AAPL"
            className={inputClass}
          />
        </div>

        {/* Start */}
        <div>
          <label className={labelClass}>Start Date</label>
          <input type="date" value={values.startDate} onChange={set('startDate')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Start Time</label>
          <input type="time" value={values.startTime} onChange={set('startTime')} className={inputClass} />
        </div>

        {/* End */}
        <div>
          <label className={labelClass}>End Date (optional)</label>
          <input type="date" value={values.endDate} onChange={set('endDate')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>End Time</label>
          <input type="time" value={values.endTime} onChange={set('endTime')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Data Source</label>
          <select value={values.source} onChange={set('source')} className={inputClass}>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Starting Cash ($)</label>
          <input type="number" min="1" step="1000" value={values.cash} onChange={set('cash')} className={inputClass} />
        </div>
      </div>

      {/* Strategy */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-black space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Strategy Parameters
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Timeframe</label>
            <select value={values.timeframe} onChange={set('timeframe')} className={inputClass}>
              {TIMEFRAME_OPTIONS.map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Max Position Fraction</label>
            <input type="number" min="0" max="1" step="0.01" value={values.maxPositionFraction} onChange={set('maxPositionFraction')} placeholder="0.1" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Oversold RSI</label>
            <input type="number" min="0" max="100" step="1" value={values.oversoldRSI} onChange={set('oversoldRSI')} placeholder="30" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Overbought RSI</label>
            <input type="number" min="0" max="100" step="1" value={values.overboughtRSI} onChange={set('overboughtRSI')} placeholder="70" className={inputClass} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-zinc-800"
        >
          <span>Advanced</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>ATR Multiplier</label>
              <input type="number" min="0" step="0.1" value={values.atrMultiplier} onChange={set('atrMultiplier')} placeholder="2.0" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Lookback Bars</label>
              <input type="number" min="0" step="1" value={values.lookbackBars} onChange={set('lookbackBars')} placeholder="0 (disabled)" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Session Start (hour)</label>
              <input type="number" min="0" max="23" step="1" value={values.sessionStart} onChange={set('sessionStart')} placeholder="10" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Session End (hour)</label>
              <input type="number" min="0" max="23" step="1" value={values.sessionEnd} onChange={set('sessionEnd')} placeholder="15" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Re-entry Cooldown (min)</label>
              <input type="number" min="0" step="1" value={values.reentryCooldownMinutes} onChange={set('reentryCooldownMinutes')} placeholder="5" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Risk Per Trade %</label>
              <input type="number" min="0" step="0.01" value={values.riskPerTradePct} onChange={set('riskPerTradePct')} placeholder="0 (uses max fraction)" className={inputClass} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { DEFAULT_VALUES as BACKTEST_FORM_DEFAULTS };
