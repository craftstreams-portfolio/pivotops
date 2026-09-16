"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles, Trash2 } from "lucide-react";

// Cards never carry a birth year or age - only a name and a message - so a
// card cannot expose what an employee chose to hide. The RLS with-check on
// birthday_cards enforces the same visibility gate as the feed, so a card for
// a hidden birthday is rejected by the database rather than by this component.

interface Card {
  id: string;
  recipient_id: string;
  style: string;
  headline: string;
  message: string | null;
  company_name_snapshot: string;
  footer_text: string | null;
  sender_name: string | null;
  created_by: string | null;
  created_at: string;
}

const STYLES = [
  { value: "minimal",  label: "Minimal",  bg: "bg-zinc-900 border-zinc-800",                                   accent: "text-zinc-100" },
  { value: "warm",     label: "Warm",     bg: "bg-gradient-to-br from-amber-500/15 to-rose-500/10 border-amber-500/25", accent: "text-amber-200" },
  { value: "confetti", label: "Confetti", bg: "bg-gradient-to-br from-indigo-500/15 to-emerald-500/15 border-indigo-500/25", accent: "text-indigo-200" },
  { value: "branded",  label: "Branded",  bg: "bg-gradient-to-br from-emerald-500/15 to-transparent border-emerald-500/25", accent: "text-emerald-200" },
  { value: "team",     label: "Team",     bg: "bg-gradient-to-br from-sky-500/15 to-violet-500/10 border-sky-500/25",  accent: "text-sky-200" },
];

function styleOf(v: string) { return STYLES.find((s) => s.value === v) ?? STYLES[1]; }

export default function CardsTab({
  me, names, companyName,
}: {
  me: { id: string; tenant_id: string; role: string };
  names: Record<string, string>;
  companyName: string;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [style, setStyle] = useState("warm");
  const [headline, setHeadline] = useState("Happy Birthday!");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [footerOn, setFooterOn] = useState(true);
  const [senderName, setSenderName] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("birthday_cards")
        .select("id, recipient_id, style, headline, message, company_name_snapshot, footer_text, sender_name, created_by, created_at")
        .order("created_at", { ascending: false }).limit(30),
      supabase.from("birthday_settings").select("show_powered_by, custom_footer, sender_name").eq("tenant_id", me.tenant_id).maybeSingle(),
    ]);
    setCards((c ?? []) as Card[]);
    if (s) {
      setFooterOn(s.show_powered_by !== false);
      setSenderName(s.sender_name ?? "");
    }
    setLoading(false);
  }

  const firstName = recipient && names[recipient]
    ? names[recipient].trim().split(/\s+/)[0]
    : "";

  async function save() {
    if (!recipient) { setErr("Choose who the card is for."); return; }
    if (!headline.trim()) { setErr("Add a headline."); return; }
    setSaving(true); setErr(""); setOk("");
    try {
      const { error } = await supabase.from("birthday_cards").insert({
        tenant_id: me.tenant_id,
        recipient_id: recipient,
        style,
        headline: headline.trim().slice(0, 80),
        message: message.trim().slice(0, 400) || null,
        company_name_snapshot: companyName,
        footer_text: footerOn ? "Powered by PivotOps" : null,
        sender_name: senderName || null,
        birthday_year: new Date().getFullYear(),
        created_by: me.id,
      });
      if (error) {
        // 42501 is the RLS with-check refusing: the recipient hid their birthday
        // or it is not visible to this user.
        if (error.code === "42501") throw new Error("You cannot create a card for this employee.");
        throw new Error(error.message);
      }
      setOk("Card created.");
      setMessage(""); setRecipient("");
      setTimeout(() => setOk(""), 4000);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the card.");
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this card?")) return;
    const { error } = await supabase.from("birthday_cards").delete().eq("id", id);
    if (error) { setErr("Only the person who made a card can delete it."); return; }
    await load();
  }

  const options = Object.entries(names).filter(([id]) => id !== me.id);
  const st = styleOf(style);

  return (
    <div className="space-y-6">
      {ok && <div role="status" className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">{ok}</div>}
      {err && <div role="alert" className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">{err}</div>}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles size={12} className="text-emerald-400" /> New card
        </h2>

        <div>
          <label htmlFor="cr" className="text-[11px] text-zinc-500 block mb-1">For</label>
          <select id="cr" value={recipient} onChange={(e) => setRecipient(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-emerald-500">
            <option value="">Choose...</option>
            {options.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
          </select>
        </div>

        <fieldset>
          <legend className="text-[11px] text-zinc-500 mb-1.5">Style</legend>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <button key={s.value} onClick={() => setStyle(s.value)} aria-pressed={style === s.value}
                className={"px-2.5 py-1 rounded-lg text-[11px] border transition " +
                  (style === s.value ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-zinc-300")}>
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="ch2" className="text-[11px] text-zinc-500 block mb-1">Headline</label>
          <input id="ch2" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500" />
        </div>

        <div>
          <label htmlFor="cm" className="text-[11px] text-zinc-500 block mb-1">Message <span className="text-zinc-600">(optional)</span></label>
          <textarea id="cm" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={400}
            placeholder={"From all of us at " + companyName + "."}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs placeholder-zinc-600 outline-none focus:border-emerald-500 resize-none" />
        </div>

        <div>
          <p className="text-[11px] text-zinc-500 mb-1.5">Preview</p>
          <CardView
            style={style}
            headline={headline || "Happy Birthday!"}
            name={firstName}
            message={message || ("From all of us at " + companyName + ".")}
            company={companyName}
            footer={footerOn ? "Powered by PivotOps" : null}
            sender={senderName}
          />
        </div>

        <button onClick={save} disabled={saving || !recipient}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 transition">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving..." : "Create card"}
        </button>
      </div>

      <section aria-labelledby="cards-h">
        <h2 id="cards-h" className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Cards</h2>
        {loading ? (
          <p className="text-xs text-zinc-600">Loading...</p>
        ) : cards.length === 0 ? (
          <p className="text-xs text-zinc-600">No cards yet.</p>
        ) : (
          <div className="space-y-3">
            {cards.map((c) => (
              <div key={c.id} className="space-y-1.5">
                <CardView
                  style={c.style}
                  headline={c.headline}
                  name={(names[c.recipient_id] ?? "").trim().split(/\s+/)[0]}
                  message={c.message ?? ""}
                  company={c.company_name_snapshot}
                  footer={c.footer_text}
                  sender={c.sender_name}
                />
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] text-zinc-600">
                    {names[c.recipient_id] ?? "Employee"} \u00B7 {new Date(c.created_at).toLocaleDateString()}
                  </span>
                  {c.created_by === me.id && (
                    <button onClick={() => remove(c.id)} aria-label="Delete card"
                      className="text-zinc-600 hover:text-red-400 transition">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CardView({ style, headline, name, message, company, footer, sender }: {
  style: string; headline: string; name: string; message: string;
  company: string; footer: string | null; sender: string | null;
}) {
  const st = styleOf(style);
  return (
    <div className={"rounded-2xl border p-6 text-center " + st.bg}>
      {style === "confetti" && (
        <div className="flex justify-center gap-1 mb-3" aria-hidden="true">
          {["\u{1F389}", "\u2728", "\u{1F382}", "\u2728", "\u{1F389}"].map((e, i) => (
            <span key={i} className="text-sm">{e}</span>
          ))}
        </div>
      )}
      <p className={"text-lg font-semibold " + st.accent}>
        {headline}{name ? ", " + name + "!" : ""}
      </p>
      {message && <p className="text-xs text-zinc-300 mt-2.5 leading-relaxed whitespace-pre-wrap">{message}</p>}
      {sender && <p className="text-[11px] text-zinc-500 mt-3">{sender}</p>}
      <p className="text-[11px] text-zinc-500 mt-1">{company}</p>
      {footer && <p className="text-[10px] text-zinc-600 mt-4">{footer}</p>}
    </div>
  );
}
