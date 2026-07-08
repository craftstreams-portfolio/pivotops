"use client";

import { useState } from "react";
import { isValidEmail } from "@/lib/validation";
import { Mail, Send, CheckCircle2, Loader2 } from "lucide-react";

export default function ContactPage() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  const submit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email, and message.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, company, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "Failed to send. Please try again."); return; }
      setSent(true);
    } catch {
      setError("Something went wrong. Please email support@pivotops.app.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080810] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold">Contact Us</h1>
        <p className="text-zinc-400 mt-2">
          Questions about PivotOps, the SHOPLINE integration, billing, or support? Send us a message and we will
          get back to you.
        </p>

        <div className="mt-8 grid sm:grid-cols-3 gap-3 text-sm">
          <a href="mailto:support@pivotops.app" className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition">
            <Mail size={16} className="text-indigo-400" />
            <p className="mt-2 font-medium">Support</p>
            <p className="text-zinc-500 text-xs mt-0.5">support@pivotops.app</p>
          </a>
          <a href="mailto:sales@pivotops.app" className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition">
            <Mail size={16} className="text-indigo-400" />
            <p className="mt-2 font-medium">Sales</p>
            <p className="text-zinc-500 text-xs mt-0.5">sales@pivotops.app</p>
          </a>
          <a href="mailto:inquiries@pivotops.app" className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition">
            <Mail size={16} className="text-indigo-400" />
            <p className="mt-2 font-medium">General</p>
            <p className="text-zinc-500 text-xs mt-0.5">inquiries@pivotops.app</p>
          </a>
        </div>

        {sent ? (
          <div className="mt-10 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-8 text-center">
            <CheckCircle2 size={40} className="text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold mt-4">Message sent</h2>
            <p className="text-zinc-400 text-sm mt-2">Thanks for reaching out. We will reply to {email} shortly.</p>
          </div>
        ) : (
          <div className="mt-10 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-sm px-4 py-3">{error}</div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name *"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-indigo-500 transition" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email *" type="email"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-indigo-500 transition" />
            </div>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company (optional)"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-indigo-500 transition" />
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-indigo-500 transition" />
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="How can we help? *" rows={6}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-indigo-500 transition resize-none" />
            <button onClick={submit} disabled={sending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600
                         hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold transition disabled:opacity-50">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? "Sending..." : "Send message"}
            </button>
          </div>
        )}

        <p className="mt-12 text-xs text-zinc-600">PivotOps · Craftstreams · www.pivotops.app</p>
      </div>
    </main>
  );
}