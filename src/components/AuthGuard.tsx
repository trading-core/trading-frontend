"use client";

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { loadAuthSession } from '@/lib/authSession';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = useMemo(() => {
    // These routes are accessible without login
    const publicRoutes = ['/login', '/', '/stock'];
    return publicRoutes.some(route => {
      if (route === '/stock') return pathname.startsWith('/stock/');
      return pathname === route;
    });
  }, [pathname]);

  const isAccountRoute = useMemo(() => pathname === '/account', [pathname]);

  const hasSession =
    typeof window !== 'undefined' ? loadAuthSession() !== null : false;

  useEffect(() => {
    // Only redirect account page if not logged in
    if (isAccountRoute && !hasSession) {
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
