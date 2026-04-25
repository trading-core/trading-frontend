"use client";

import { useRouter } from "next/navigation";
import AuthPanel from "@/components/AuthPanel";
import { AuthSession } from "@/lib/authSession";

export default function LoginPage() {
  const router = useRouter();

  const handleSessionChange = (session: AuthSession | null) => {
    if (session !== null) {
      router.push("/");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-400">
                <path
                  d="M3 17l6-6 4 4 8-8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 7h7v7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Welcome to Trading Core</h1>
            <p className="mt-2 text-sm text-gray-400">
              Sign in or create an account to get started.
            </p>
          </div>
          <AuthPanel onSessionChange={handleSessionChange} />
        </div>
      </div>
    </div>
  );
}
