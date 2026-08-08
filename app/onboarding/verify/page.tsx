"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function OnboardingVerifyPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error,  setError]  = useState("");

  useEffect(() => {
    const verify = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token  = params.get("token");
        const claim  = params.get("shopline_claim");

        if (!token) {
          throw new Error("This verification link is missing its token. Please use the link from your email.");
        }

        // Clear any lingering session before verifying
        await supabase.auth.signOut();

        const res = await fetch("/api/owner/verify-token", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ token }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error ?? "Verification failed. The link may have expired.");
        }

        setStatus("success");
        // Send them to login to sign in, then they land on onboarding
        setTimeout(() => {
          window.location.href = "/login?verified=1" + (claim ? `&shopline_claim=${encodeURIComponent(claim)}` : "");
        }, 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed.");
        setStatus("error");
      }
    };
    verify();
  }, []);

  if (status === "loading") return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 size={28} className="animate-spin text-indigo-400 mx-auto" />
        <p className="text-zinc-500 text-sm">Verifying your email...</p>
      </div>
    </div>
  );

  if (status === "error") return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/25
                        flex items-center justify-center mx-auto">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Verification Failed</h2>
        <p className="text-zinc-400 text-sm">{error}</p>
        <a href="/login"
          className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                     text-white text-sm font-semibold transition">
          Go to Login
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
      <div className="text-center space-y-5 max-w-sm w-full">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center mx-auto">
          <CheckCircle2 size={36} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
          <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
            Your account is active. Taking you to sign in, then straight to workspace setup...
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
          <Loader2 size={13} className="text-indigo-400 animate-spin" />
          <span>Redirecting...</span>
        </div>
        <a href="/login" className="inline-block text-xs text-indigo-400 hover:text-indigo-300 transition">
          Click here if you are not redirected automatically
        </a>
      </div>
    </div>
  );
}