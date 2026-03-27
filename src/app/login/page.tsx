"use client";

import { useRouter } from "next/navigation";
import AuthPanel from "@/components/AuthPanel";
import { AuthSession } from "@/lib/authSession";

export default function LoginPage() {
  const router = useRouter();

  const handleSessionChange = (session: AuthSession | null) => {
    // Only redirect after successful login
    if (session !== null) {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Trading Bot</h1>
          <p className="text-gray-400">Sign in or create an account to get started</p>
        </div>
        <AuthPanel onSessionChange={handleSessionChange} />
      </div>
    </div>
  );
}
