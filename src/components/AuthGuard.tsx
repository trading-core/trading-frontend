"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AUTH_SESSION_CHANGED_EVENT,
  loadAuthSession,
  msUntilRefresh,
  refreshAuthSession,
} from '@/lib/authSession';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const isPublicRoute = useMemo(() => {
    return pathname === '/login';
  }, [pathname]);

  useEffect(() => {
    const refreshSession = () => {
      setHasSession(loadAuthSession() !== null);
    };

    refreshSession();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
  }, []);

  // Schedule proactive token refresh
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const scheduleRefresh = () => {
      const session = loadAuthSession();
      if (!session) return;

      const delay = msUntilRefresh(session);

      if (delay <= 0) {
        // Already within threshold — refresh immediately
        refreshAuthSession().then((newSession) => {
          if (!newSession) {
            router.push('/login');
          } else {
            scheduleRefresh(); // Reschedule after successful refresh
          }
        });
      } else {
        timer = setTimeout(async () => {
          const newSession = await refreshAuthSession();
          if (!newSession) {
            router.push('/login');
          } else {
            scheduleRefresh(); // Reschedule for the next expiry
          }
        }, delay);
      }
    };

    if (hasSession) {
      scheduleRefresh();
    }

    return () => clearTimeout(timer);
  }, [hasSession, router]);

  useEffect(() => {
    if (hasSession === false && !isPublicRoute) {
      router.push('/login');
    }
  }, [hasSession, isPublicRoute, router]);

  if (isPublicRoute || hasSession) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-300">Redirecting to login...</p>
    </div>
  );
}
