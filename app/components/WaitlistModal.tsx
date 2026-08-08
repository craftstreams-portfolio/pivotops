"use client";

import { useState } from "react";
import { X, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

interface WaitlistModalProps {
  open:    boolean;
  onClose: () => void;
}

const TEAM_SIZES = ["Just me", "2-5", "6-15", "16-50", "50+"];

export default function WaitlistModal({ open, onClose }: WaitlistModalProps) {
  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [company,   setCompany]   = useState("");
  const [teamSize,  setTeamSize]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);

  if (!open) return null;

  const valid = fullName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fullName, email, company, teamSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: "rgba(4,6,14,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-sm font-bold">P</span>
            </div>
            <p className="text-sm font-bold text-white">Join the waitlist</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition text-zinc-500 hover:text-white">
            <X size={14} />
          </button>
        </div>

        {success ? (
          /* Success state */
          <div className="px-6 py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/25
                            flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">You are on the list</h3>
              <p className="text-zinc-400 text-sm mt-2 leading-relaxed max-w-xs mx-auto">
                We will reach out personally to set up your workspace. Check your inbox for a confirmation email.
              </p>
            </div>
            <button onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400
                         text-zinc-950 text-sm font-bold transition">
              Done
            </button>
          </div>
        ) : (
          /* Form */
          <div className="px-6 py-6 space-y-4">
            <div>
              <p className="text-zinc-300 text-sm leading-relaxed">
                PivotOps is currently in <span className="text-emerald-400 font-semibold">private beta</span>.
                Join the waitlist and we will personally onboard your team.
              </p>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Full name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5
                           text-sm text-white placeholder-zinc-600 outline-none
                           focus:border-zinc-600 transition"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Work email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                placeholder="jane@company.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5
                           text-sm text-white placeholder-zinc-600 outline-none
                           focus:border-zinc-600 transition"
              />
            </div>

            {/* Company */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Company <span className="text-zinc-600">(optional)</span></label>
              <input
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Acme Staffing"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5
                           text-sm text-white placeholder-zinc-600 outline-none
                           focus:border-zinc-600 transition"
              />
            </div>

            {/* Team size */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Team size <span className="text-zinc-600">(optional)</span></label>
              <div className="flex flex-wrap gap-2">
                {TEAM_SIZES.map(s => (
                  <button key={s} onClick={() => setTeamSize(teamSize === s ? "" : s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                      teamSize === s
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20
                            rounded-xl px-4 py-2.5">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!valid || loading}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400
                         text-zinc-950 text-sm font-bold transition
                         disabled:opacity-40 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Joining...</>
                : <><ArrowRight size={14} /> Join waitlist</>
              }
            </button>

            <p className="text-center text-xs text-zinc-600">
              No spam. We will only reach out to onboard you personally.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}