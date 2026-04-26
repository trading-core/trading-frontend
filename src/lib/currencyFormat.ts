'use client';

import { useEffect, useState } from 'react';

export type CurrencyFormat = 'symbol' | 'code' | 'compact';

const STORAGE_KEY = 'currency-format';
const EVENT_NAME = 'currency-format-changed';
const DEFAULT_FORMAT: CurrencyFormat = 'symbol';

const isCurrencyFormat = (value: unknown): value is CurrencyFormat =>
  value === 'symbol' || value === 'code' || value === 'compact';

export function getCurrencyFormat(): CurrencyFormat {
  if (typeof window === 'undefined') return DEFAULT_FORMAT;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isCurrencyFormat(stored) ? stored : DEFAULT_FORMAT;
}

export function setCurrencyFormat(format: CurrencyFormat): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, format);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useCurrencyFormat(): [CurrencyFormat, (format: CurrencyFormat) => void] {
  const [format, setFormat] = useState<CurrencyFormat>(DEFAULT_FORMAT);
  useEffect(() => {
    const refresh = () => setFormat(getCurrencyFormat());
    refresh();
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return [format, setCurrencyFormat];
}

export function formatCurrency(amount: number, currency: string, format: CurrencyFormat): string {
  const safeCurrency = currency && currency.length === 3 ? currency : 'USD';
  try {
    if (format === 'code') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: safeCurrency,
        currencyDisplay: 'code',
      }).format(amount);
    }
    if (format === 'compact') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: safeCurrency,
        notation: 'compact',
        maximumFractionDigits: 2,
      }).format(amount);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${safeCurrency}`;
  }
}
