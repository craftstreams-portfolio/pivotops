"use client";

import { useState, useEffect } from "react";
import { X, Cookie, Shield, BarChart2, Settings2 } from "lucide-react";

type ConsentState = {
  essential:  true;
  analytics:  boolean;
  functional: boolean;
  decided:    boolean;
};

const CONSENT_KEY = "pivotops_cookie_consent";

export default function CookieConsent() {
  const [visible,    setVisible]    = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [prefs,      setPrefs]      = useState<ConsentState>({
    essential:  true,
    analytics:  false,
    functional: false,
    decided:    false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setTimeout(() => setVisible(true), 1200);
    }
  }, []);

  const save = (consent: ConsentState) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...consent, decided: true }));
    setVisible(false);
  };

  const acceptAll = () => save({ essential: true, analytics: true, functional: true, decided: true });
  const rejectAll = () => save({ essential: true, analytics: false, functional: false, decided: true });
  const savePrefs = () => save({ ...prefs, decided: true });

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[400] p-4 md:p-6">
      <div
        className="max-w-4xl mx-auto rounded-2xl border border-zinc-700 shadow-2xl shadow-black/60 overflow-hidden"
        style={{ background: "rgba(10,12,20,0.97)", backdropFilter: "blur(16px)" }}
      >
        {/* Main bar */}
        <div className="px-5 py-4 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                            flex items-center justify-center">
              <Cookie size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Cookie Preferences</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                We use cookies to improve your experience.{" "}
                <a href="/legal/privacy" target="_blank"
                  className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition">
                  Privacy Policy
                </a>
                {" "}·{" "}
                <a href="/legal/terms" target="_blank"
                  className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition">
                  Terms of Use
                </a>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700
                         text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-medium transition">
              <Settings2 size={12} /> Manage preferences
            </button>
            <button
              onClick={rejectAll}
              className="px-4 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500
                         text-zinc-300 hover:text-white text-xs font-semibold transition">
              Reject non-essential
            </button>
            <button
              onClick={acceptAll}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400
                         text-zinc-950 text-xs font-bold transition shadow-lg shadow-emerald-500/20">
              Accept all
            </button>
            <button
              onClick={rejectAll}
              className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center
                         text-zinc-600 hover:text-zinc-400 transition flex-shrink-0">
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Expanded preferences */}
        {expanded && (
          <div className="border-t border-zinc-800 px-5 py-4 space-y-3">
            <p className="text-xs text-zinc-500 mb-3">
              Choose which cookies you allow. Essential cookies cannot be disabled as they are
              required for the site to function correctly.
            </p>

            {[
              {
                key:      "essential",
                icon:     <Shield size={14} className="text-emerald-400" />,
                label:    "Essential",
                desc:     "Required for authentication, security, and core site functionality. Cannot be disabled.",
                locked:   true,
                value:    true,
              },
              {
                key:      "functional",
                icon:     <Cookie size={14} className="text-blue-400" />,
                label:    "Functional",
                desc:     "Remember your preferences and settings across visits.",
                locked:   false,
                value:    prefs.functional,
              },
              {
                key:      "analytics",
                icon:     <BarChart2 size={14} className="text-purple-400" />,
                label:    "Analytics",
                desc:     "Anonymised usage data to help us improve PivotOps. No personal data shared.",
                locked:   false,
                value:    prefs.analytics,
              },
            ].map(({ key, icon, label, desc, locked, value }) => (
              <div key={key}
                className="flex items-start justify-between gap-4 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    {icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white flex items-center gap-2">
                      {label}
                      {locked && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10
                                         px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                          Always on
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 mt-0.5">
                  {locked ? (
                    <div className="w-10 h-5 rounded-full bg-emerald-500/30 border border-emerald-500/40
                                    flex items-center justify-end px-0.5 cursor-not-allowed">
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-400" />
                    </div>
                  ) : (
                    <button
                      onClick={() => setPrefs(p => ({ ...p, [key]: !value }))}
                      className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5
                        ${value
                          ? "bg-emerald-500 justify-end"
                          : "bg-zinc-700 justify-start"
                        }`}>
                      <div className="w-3.5 h-3.5 rounded-full bg-white transition-all" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setExpanded(false)}
                className="px-4 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400
                           hover:text-white transition">
                Cancel
              </button>
              <button onClick={savePrefs}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400
                           text-zinc-950 text-xs font-bold transition">
                Save preferences
              </button>
            </div>
          </div>
        )}

        {/* Copyright bar */}
        <div className="border-t border-zinc-800/60 px-5 py-2 flex items-center justify-between">
          <p className="text-[10px] text-zinc-700">
            © 2024–2026 Craftstreams. PivotOps is a trademark of Craftstreams. All rights reserved.
          </p>
          <p className="text-[10px] text-zinc-700">
            Governed by Delaware law · GDPR & CCPA compliant
          </p>
        </div>
      </div>
    </div>
  );
}