"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CheckCircle2, Loader2, AlertCircle, Brain } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CandidateVerifyPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error,  setError]  = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [tenantId,    setTenantId]    = useState("default");

  useEffect(() => {
    const verify = async () => {
      try {
        const params  = new URLSearchParams(window.location.search);
        const cId     = params.get("candidateId") ?? "";
        const tId     = params.get("tenantId")    ?? "default";
        setCandidateId(cId);
        setTenantId(tId);

        // Supabase puts tokens in the URL hash after email confirmation
        const hash        = window.location.hash.slice(1);
        const hashParams  = new URLSearchParams(hash);
        const accessToken  = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type         = hashParams.get("type");

        if (accessToken && refreshToken) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) throw new Error(sessionErr.message);
          setStatus("success");

          // Redirect to portal after 3 seconds
          setTimeout(() => {
            window.location.href = `/candidate/portal?candidateId=${cId}&tenantId=${tId}`;
          }, 3000);
        } else {
          // No tokens — may already be verified, try to get existing session
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setStatus("success");
            setTimeout(() => {
              window.location.href = `/candidate/portal?candidateId=${cId}&tenantId=${tId}`;
            }, 3000);
          } else {
            throw new Error("No verification tokens found. The link may have expired.");
          }
        }
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
        <a href={`/candidate/login?candidateId=${candidateId}&tenantId=${tenantId}`}
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
            Your account is now active. Taking you to your compliance portal...
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
            Identity confirmed
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
            Portal access granted
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 size={13} className="text-indigo-400 animate-spin flex-shrink-0" />
            Redirecting to your portal...
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
          <Brain size={11} className="text-indigo-400" />
          <span>Managed by Xavier AI · PivotOps</span>
        </div>

        <a href={`/candidate/portal?candidateId=${candidateId}&tenantId=${tenantId}`}
          className="inline-block text-xs text-indigo-400 hover:text-indigo-300 transition">
          Click here if you are not redirected automatically
        </a>
      </div>
    </div>
  );
}