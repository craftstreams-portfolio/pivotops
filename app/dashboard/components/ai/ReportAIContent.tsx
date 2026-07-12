"use client";

import { useState } from "react";
import { Flag, X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";

const REASONS = [
  { id: "inaccurate", label: "Inaccurate or wrong" },
  { id: "offensive",  label: "Offensive or inappropriate" },
  { id: "misleading", label: "Misleading or biased" },
  { id: "other",      label: "Something else" },
];

/**
 * Lets a merchant report AI-generated content WITHOUT leaving the app.
 * Required by SHOPLINE's App Review Standards for AIGC apps.
 */
export default function ReportAIContent({
  surface,
  refId,
  content,
  className = "",
}: {
  surface: string;
  refId?: string | null;
  content?: string | null;
  className?: string;
}) {
  const { tenantId } = useTenant();
  const [open, setOpen]       = useState(false);
  const [reason, setReason]   = useState("");
  const [note, setNote]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);
  const [err, setErr]         = useState("");

  async function submit() {
    if (!reason) { setErr("Please choose a reason."); return; }
    setSaving(true); setErr("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from("ai_content_reports").insert({
        tenant_id:        tenantId,
        user_id:          session?.user?.id ?? null,
        surface,
        ref_id:           refId ?? null,
        content_snapshot: content ? String(content).slice(0, 4000) : null,
        reason,
        note:             note.trim() || null,
      });
      if (error) throw new Error(error.message);
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setReason(""); setNote(""); }, 1600);
    } catch (e: any) {
      setErr(e?.message ?? "Could not send the report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Report this AI-generated content"
        className={`inline-flex items-center gap-1 text-[10px] text-zinc-600 hover:text-amber-400 transition ${className}`}
      >
        <Flag size={10} /> Report
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#0f0f1a] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Flag size={13} className="text-amber-400" /> Report AI content
              </p>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white transition">
                <X size={15} />
              </button>
            </div>

            {done ? (
              <div className="py-6 text-center space-y-2">
                <Check size={28} className="text-emerald-400 mx-auto" />
                <p className="text-sm text-white">Report sent. Thank you.</p>
                <p className="text-xs text-zinc-500">We use these reports to improve Xavier&apos;s output.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-500">
                  Tell us what&apos;s wrong with this Xavier-generated content. Reports go straight to our team.
                </p>

                <div className="space-y-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setReason(r.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition
                        ${reason === r.id
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : "border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add any detail (optional)"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white
                             placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
                />

                {err && <p className="text-xs text-red-400">{err}</p>}

                <button
                  onClick={submit}
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm
                             font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : "Send report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}