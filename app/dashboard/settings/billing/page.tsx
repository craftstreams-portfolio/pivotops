"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import { useSubscription } from "@/lib/paddle/gate";
import { PLAN_FEATURES, PADDLE_CONFIG } from "@/lib/paddle/config";
import { CheckCircle2, Loader2, AlertCircle, Zap, Shield, Building2 } from "lucide-react";

const PLANS = [
  {
    key:      "starter" as const,
    name:     "Starter",
    monthly:  1500,
    annual:   16200,
    icon:     Zap,
    color:    "emerald",
    features: ["Up to 5 recruiters","Xavier AI scoring","Interview routing","Real-time notifications","Candidate portal"],
  },
  {
    key:      "professional" as const,
    name:     "Professional",
    monthly:  2500,
    annual:   27000,
    icon:     Shield,
    color:    "indigo",
    highlight: true,
    features: ["Up to 20 recruiters","Everything in Starter","Compliance tracking","Performance dashboards","Geolocation clock in/out","Multi-channel communications"],
  },
  {
    key:      "enterprise" as const,
    name:     "Enterprise",
    monthly:  6000,
    annual:   64800,
    icon:     Building2,
    color:    "purple",
    features: ["Unlimited recruiters","Everything in Professional","Dedicated onboarding","Custom integrations","Priority support","Advanced compliance"],
  },
];

export default function BillingPage() {
  const { tenantId } = useTenant();
  const sub          = useSubscription(tenantId);
  const [annual,     setAnnual]     = useState(false);
  const [loading,    setLoading]    = useState<string | null>(null);
  const [canceling,  setCanceling]  = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("status") === "success") setSuccess(true);
    }
  }, []);

  const handleSubscribe = async (plan: "starter" | "professional" | "enterprise") => {
    setLoading(plan);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Your session expired. Please sign in again.");
        setLoading(null);
        return;
      }
      const res = await fetch("/api/dodo/checkout", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body:    JSON.stringify({ plan, cycle: annual ? "annual" : "monthly" }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError(data.error || "Failed to start checkout. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel? Your access continues until the end of the billing period.")) return;
    setCanceling(true);
    try {
      const res = await fetch("/api/dodo/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel. Contact support@pivotops.app.");
        setCanceling(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Failed to cancel. Contact support@pivotops.app.");
    } finally {
      setCanceling(false);
    }
  };

  if (sub.loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-zinc-500" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your plan, billing cycle, and subscription status.</p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
          <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Subscription activated</p>
            <p className="text-xs text-zinc-400 mt-0.5">Your plan is now active. All features are available.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/25">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">Current Plan</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xl font-bold text-white">{PLAN_FEATURES[sub.plan].name}</p>
            <p className="text-sm text-zinc-500 mt-1">
              Status: <span className={`font-semibold ${sub.isActive ? "text-emerald-400" : "text-red-400"}`}>
                {sub.status.replace("_", " ")}
              </span>
              {sub.isTrial && " · trial"}
            </p>
            {sub.cancelAtPeriodEnd && (
              <p className="text-xs text-amber-400 mt-2">
                Your plan is set to cancel at the end of the current billing period. You keep full access until then.
              </p>
            )}
          </div>
          {sub.plan !== "free" && sub.isActive && !sub.isTrial && !sub.cancelAtPeriodEnd && (
            <button onClick={handleCancel} disabled={canceling}
              className="text-xs text-zinc-500 hover:text-red-400 transition border border-zinc-700 hover:border-red-500/30 px-4 py-2 rounded-xl">
              {canceling ? "Canceling..." : "Cancel plan"}
            </button>
          )}
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Choose a plan</h2>
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 p-1">
          <button onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${!annual ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
            Monthly
          </button>
          <button onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-2 ${annual ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
            Annual
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${annual ? "bg-emerald-600 text-white" : "bg-emerald-500/15 text-emerald-400"}`}>
              Save 10%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const price      = annual ? plan.annual : plan.monthly;
          const isCurrent  = sub.plan === plan.key;
          const Icon       = plan.icon;
          return (
            <div key={plan.key}
              className={`rounded-2xl p-6 flex flex-col relative border ${
                plan.highlight
                  ? "border-indigo-500 bg-indigo-500/[0.04]"
                  : "border-zinc-800 bg-zinc-900/30"
              }`}>
              {plan.highlight && (
                <span className="absolute -top-3 left-5 bg-indigo-500 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                  Most popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 right-5 bg-emerald-500 text-zinc-950 text-[11px] font-bold px-3 py-1 rounded-full">
                  Current
                </span>
              )}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                plan.color === "emerald" ? "bg-emerald-500/15" :
                plan.color === "indigo"  ? "bg-indigo-500/15"  : "bg-purple-500/15"
              }`}>
                <Icon size={18} className={
                  plan.color === "emerald" ? "text-emerald-400" :
                  plan.color === "indigo"  ? "text-indigo-400"  : "text-purple-400"
                } />
              </div>
              <h3 className="text-white font-bold text-lg">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-black text-white">${price.toLocaleString()}</span>
                <span className="text-zinc-500 text-sm">/{annual ? "yr" : "mo"}</span>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                    <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => !isCurrent && handleSubscribe(plan.key)}
                disabled={isCurrent || !!loading}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                  isCurrent
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : plan.highlight
                      ? "bg-indigo-500 hover:bg-indigo-400 text-white"
                      : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                }`}>
                {loading === plan.key
                  ? <><Loader2 size={14} className="animate-spin" /> Processing...</>
                  : isCurrent ? "Current plan" : "Subscribe"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-zinc-600 text-xs">
        Payments processed securely by Dodo Payments · All prices in USD · Tax included where applicable
      </p>
    </div>
  );
}