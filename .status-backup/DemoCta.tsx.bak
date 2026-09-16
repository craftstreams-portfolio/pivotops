"use client";

import { useState } from "react";
import { CalendarDays, MessageSquare, Loader2, Check } from "lucide-react";

const CALENDLY = "https://calendly.com/craftstreams/new-meeting";

// Sits between the cost-savings section and pricing: the moment a visitor is
// weighing numbers is when a human conversation converts best.
export default function DemoCta() {
  const [open, setOpen] = useState(false);

  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-900">
      <div className="max-w-2xl mx-auto text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-4">
          Before you compare plans
        </p>

        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
          Your team is not slow. Your systems are.
        </h2>

        <p className="text-zinc-400 mt-5 leading-relaxed">
          Hiring in one tool, shifts in another, compliance in a spreadsheet, and the
          answers nobody can find in time. Fifteen minutes with us and you will see
          exactly where your workforce operations lose hours every week, and whether
          PivotOps gets them back. If it does not, we will tell you.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <a href={CALENDLY} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #1E56E0, #00BFA6)" }}>
            <CalendarDays size={16} /> Book a Demo
          </a>
          <button onClick={() => setOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm font-semibold hover:bg-zinc-800 hover:border-zinc-600 transition">
            <MessageSquare size={16} /> Chat with Sales
          </button>
        </div>

        <p className="text-[11px] text-zinc-600 mt-4">
          No slide deck. No obligation. A working walkthrough against how your team actually operates.
        </p>
      </div>

      {open && <SalesChat onClose={() => setOpen(false)} />}
    </section>
  );
}

// Interim: collects the enquiry and emails it through the existing contact
// route. Replaced by the realtime Customer Support widget that routes into
// Craftstreams Teams -> Sales once that is built.
function SalesChat({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErr("Name, work email and a short message, please.");
      return;
    }
    setSending(true); setErr("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(),
          company: company.trim() || null,
          message: message.trim(), source: "landing_sales_chat",
        }),
      });
      if (!res.ok) throw new Error("send_failed");
      setSent(true);
    } catch {
      setErr("That did not send. Email inquiries@pivotops.app and we will pick it up.");
    } finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Chat with sales"
        className="relative w-full sm:max-w-md bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-3.5 max-h-[92vh] overflow-y-auto">

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Customer Support</h3>
            <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              Usually replies within a few hours
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="text-zinc-500 hover:text-white transition text-lg leading-none">&times;</button>
        </div>

        {sent ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
              <Check size={18} className="text-emerald-400" />
            </div>
            <p className="text-sm text-white">Got it, {name.trim().split(/\s+/)[0]}.</p>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
              We will reply to {email.trim()} shortly. If it is urgent, book a time
              and skip the queue.
            </p>
            <a href={CALENDLY} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
              Book a demo instead
            </a>
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Hi. Tell us what is costing your team time and we will come back with a
              straight answer, not a sales sequence.
            </p>

            {err && <p role="alert" className="text-[11px] text-red-400">{err}</p>}

            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Full name" aria-label="Full name" maxLength={80}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500 transition" />
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              type="email" placeholder="Work email" aria-label="Work email" maxLength={120}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500 transition" />
            <input value={company} onChange={(e) => setCompany(e.target.value)}
              placeholder="Company (optional)" aria-label="Company" maxLength={80}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500 transition" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)}
              rows={3} maxLength={1000} placeholder="What is slowing your team down?" aria-label="Message"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500 resize-none transition" />

            <button onClick={submit} disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #1E56E0, #00BFA6)" }}>
              {sending && <Loader2 size={14} className="animate-spin" />}
              {sending ? "Sending..." : "Start chat"}
            </button>

            <p className="text-[10px] text-zinc-600 text-center">
              Rather talk live? <a href={CALENDLY} target="_blank" rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">Book a demo</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
