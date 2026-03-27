"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '@/lib/authSession';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const isPublicRoute = useMemo(() => {
    // These routes are accessible without login
    const publicRoutes = ['/login', '/', '/stock'];
    return publicRoutes.some(route => {
      if (route === '/stock') return pathname.startsWith('/stock/');
      return pathname === route;
    });
  }, [pathname]);

  const isAccountRoute = useMemo(() => pathname === '/account', [pathname]);

  useEffect(() => {
    const refreshSession = () => {
      setHasSession(loadAuthSession() !== null);
    };

    refreshSession();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
  }, []);

  useEffect(() => {
    // Only redirect account page if not logged in
    if (hasSession === false && isAccountRoute) {
      router.push('/login');
    }
  }, [isAccountRoute, hasSession, router]);

  // Public routes and authenticated users can access anything
  if (isPublicRoute || hasSession) {
    return <>{children}</>;
  }

  // Not on public route and not logged in - show loading while redirecting
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-300">Redirecting to login...</p>
    </div>
  );
}
