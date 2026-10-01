"use client";

import { useState } from "react";
import { CalendarDays, MessageSquare } from "lucide-react";
import SupportChat from "./SupportChat";

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

      {open && <SupportChat onClose={() => setOpen(false)} />}
    </section>
  );
}
