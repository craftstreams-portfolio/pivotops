"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function PivotLogo() {
  return (
    <svg
      width="72"
      height="62"
      viewBox="0 0 100 86"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto"
    >
      <path
        d="M50 2L98 84H2L50 2Z"
        stroke="url(#silver)"
        strokeWidth="4"
      />

      <path
        d="M50 22L82 76H18L50 22Z"
        stroke="url(#silver2)"
        strokeWidth="2"
        opacity="0.5"
      />

      <defs>
        <linearGradient id="silver" x1="0" y1="0" x2="100" y2="86">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#d4d4d4" />
          <stop offset="100%" stopColor="#737373" />
        </linearGradient>

        <linearGradient id="silver2" x1="100" y1="0" x2="0" y2="86">
          <stop offset="0%" stopColor="#737373" />
          <stop offset="50%" stopColor="#d4d4d4" />
          <stop offset="100%" stopColor="#404040" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit() {
    if (!email || !password) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          setError(error.message);
        } else {
          setSuccess(
            "Account created successfully. Check your email to verify your account."
          );
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          setError(error.message);
        } else {
          router.push("/dashboard");
        }
      }
    } catch {
      setError("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08),transparent_65%)]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="animate-pulse">
            <PivotLogo />
          </div>

          <h1 className="mt-4 text-3xl font-bold text-white">
            PivotOps
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Autonomous Workforce OS
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 backdrop-blur-xl">
          <h2 className="mb-2 text-xl font-semibold text-white">
            {mode === "login"
              ? "Sign in to your account"
              : "Create your account"}
          </h2>

          <p className="mb-6 text-sm text-zinc-500">
            Access your workforce operations dashboard
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              {success}
            </div>
          )}

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="you@company.com"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-emerald-500"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Password
              </label>

              <div className="relative">
                <input
                  type={
                    showPassword ? "text" : "password"
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 pr-16 text-white outline-none transition focus:border-emerald-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((v) => !v)
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={
                loading || !email || !password
              }
              className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </div>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(
                  mode === "login"
                    ? "signup"
                    : "login"
                );
                setError("");
                setSuccess("");
              }}
              className="text-sm text-zinc-500 transition hover:text-zinc-300"
            >
              {mode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          © 2026 PivotOps · Autonomous Workforce OS
        </p>
      </div>
    </div>
  );
}