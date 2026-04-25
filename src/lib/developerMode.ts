'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'developer-mode';
const EVENT_NAME = 'developer-mode-changed';

export function isDeveloperModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

export function setDeveloperMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useDeveloperMode(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const refresh = () => setEnabled(isDeveloperModeEnabled());
    refresh();
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return [enabled, setDeveloperMode];
}
