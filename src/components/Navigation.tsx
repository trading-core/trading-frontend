"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadAuthSession, AUTH_SESSION_CHANGED_EVENT } from "@/lib/authSession";

export default function Navigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const refresh = () => {
      setIsLoggedIn(loadAuthSession() !== null);
      setIsLoading(false);
    };
    refresh();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
  }, []);

  if (isLoading) {
    return (
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Trading Bot</h1>
          <div className="flex gap-6">
            <Link href="/" className="text-gray-300 hover:text-white transition">
              Home
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Trading Bot</h1>
        <div className="flex gap-6">
          <Link href="/" className="text-gray-300 hover:text-white transition">
            Home
          </Link>
          {isLoggedIn ? (
            <Link href="/account" className="text-gray-300 hover:text-white transition">
              Account
            </Link>
          ) : (
            <Link href="/login" className="text-gray-300 hover:text-white transition">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
