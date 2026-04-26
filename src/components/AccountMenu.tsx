'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { type AuthSession, clearAuthSession, loadAuthSession, AUTH_SESSION_CHANGED_EVENT } from '@/lib/authSession';
import { useDeveloperMode } from '@/lib/developerMode';
import SettingsDrawer from '@/components/SettingsDrawer';

const PENDING_BROKER_SELECTION_STORAGE_KEY = 'pending-broker-selection';

function IconAccount() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function AccountMenu() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [devMode] = useDeveloperMode();

  useEffect(() => {
    const refresh = () => setSession(loadAuthSession());
    refresh();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!session) return null;

  const handleSignOut = () => {
    clearAuthSession();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(PENDING_BROKER_SELECTION_STORAGE_KEY);
    }
    setMenuOpen(false);
    router.push('/');
  };

  const handleDashboard = () => {
    setMenuOpen(false);
    router.push('/account');
  };

  const handleOpenSettings = () => {
    setMenuOpen(false);
    setSettingsOpen(true);
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
          className="group relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-700 hover:text-white"
        >
          <IconAccount />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl"
          >
            <div className="border-b border-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Signed in as</p>
              <p className="mt-0.5 truncate text-sm font-medium text-white">{session.email}</p>
              {devMode && (
                <p className="mt-0.5 truncate text-[11px] text-gray-500">{session.user_id}</p>
              )}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={handleDashboard}
              className="block w-full px-4 py-2.5 text-left text-sm text-gray-200 transition hover:bg-white/5"
            >
              Accounts
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenSettings}
              className="block w-full px-4 py-2.5 text-left text-sm text-gray-200 transition hover:bg-white/5"
            >
              Settings
            </button>
            <div className="h-px bg-white/5" />
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-500/10"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
