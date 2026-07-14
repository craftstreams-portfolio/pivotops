"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const NAVY = "#06070D";
const TEAL = "#00BFA6";

interface SigField {
  id: string;
  kind: "signature" | "initials" | "date" | "text";
  label: string | null;
  required: boolean;
  page_index: number | null;
}

interface SignCtx {
  fields: SigField[];
  docName: string;
  fileUrl: string | null;
  message: string | null;
  sentBy: string;
  signerName: string;
  signerEmail: string;
  alreadySigned: boolean;
  signedAt: string | null;
  requestStatus: string;
}

export default function SignPage() {
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [ctx, setCtx]         = useState<SignCtx | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [typed, setTyped]     = useState("");
  const [textVals, setTextVals] = useState<Record<string, string>>({});
  const [signing, setSigning] = useState(false);
  const [done, setDone]       = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/signature/sign?token=${encodeURIComponent(token as string)}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Could not load."); setLoading(false); return; }
        setCtx(json);
        if (json.signerName) setTyped(json.signerName);
        setLoading(false);
      } catch {
        setError("Could not load this signing request."); setLoading(false);
      }
    })();
  }, [token]);

  async function submit() {
    if (!typed.trim()) return;
    setSigning(true);
    try {
      const res = await fetch("/api/signature/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signatureText: typed.trim(), fieldValues: textVals }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not sign."); setSigning(false); return; }
      setDone(true); setSigning(false);
    } catch {
      setError("Could not submit signature."); setSigning(false);
    }
  }

  const wrap: React.CSSProperties = { minHeight: "100vh", background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" };
  const card: React.CSSProperties = { maxWidth: 560, width: "100%", background: "#0d1117", border: "1px solid #222", borderRadius: 16, padding: 32 };

  if (loading) return <div style={wrap}><p style={{ color: "#888" }}>Loading…</p></div>;

  if (error) return (
    <div style={wrap}><div style={card}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Unable to open</h1>
      <p style={{ color: "#aaa", fontSize: 14 }}>{error}</p>
    </div></div>
  );

  if (done || ctx?.alreadySigned) return (
    <div style={wrap}><div style={{ ...card, textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✓</div>
      <h1 style={{ fontSize: 22, marginBottom: 8, color: TEAL }}>Signature recorded</h1>
      <p style={{ color: "#aaa", fontSize: 14 }}>
        {done ? "Thank you — your signature has been recorded." : "You have already signed this document."}
      </p>
      <p style={{ color: "#666", fontSize: 12, marginTop: 16 }}>{ctx?.docName}</p>
    </div></div>
  );

  return (
    <div style={wrap}><div style={card}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 3, color: TEAL, textTransform: "uppercase", marginBottom: 12 }}>PivotOps · Signature Request</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>{ctx?.docName}</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        {ctx?.sentBy} has requested your signature.
      </p>

      {ctx?.message && (
        <div style={{ background: "#161b22", borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13, color: "#ccc", fontStyle: "italic" }}>
          &ldquo;{ctx.message}&rdquo;
        </div>
      )}

      {ctx?.fileUrl && (
        <a href={ctx.fileUrl} target="_blank" rel="noreferrer"
          style={{ display: "inline-block", marginBottom: 22, color: TEAL, fontSize: 14, textDecoration: "underline" }}>
          📄 View the document
        </a>
      )}

      {(ctx?.fields?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 22, padding: 16, background: "#161b22", borderRadius: 10, border: "1px solid #222" }}>
          <p style={{ fontSize: 11, color: "#888", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            {ctx!.fields.length} field{ctx!.fields.length === 1 ? "" : "s"} for you on this document
          </p>

          {ctx!.fields.filter(f => f.kind === "text").map(f => (
            <div key={f.id} style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#aaa", marginBottom: 5 }}>
                {f.label ?? "Text"}{f.required ? " *" : ""}
              </label>
              <input
                value={textVals[f.id] ?? ""}
                onChange={e => setTextVals(v => ({ ...v, [f.id]: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, background: "#0d1117",
                         border: "1px solid #333", color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>
          ))}

          {ctx!.fields.filter(f => f.kind !== "text").length > 0 && (
            <p style={{ fontSize: 11, color: "#666", marginTop: 4, lineHeight: 1.6 }}>
              Your signature, initials and the date will be placed on the document automatically
              wherever they are required — you only type your name once, below.
            </p>
          )}
        </div>
      )}

      <div style={{ marginBottom: 8, fontSize: 13, color: "#aaa" }}>Type your full name to sign:</div>
      <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Your full name"
        style={{ width: "100%", padding: "12px 14px", borderRadius: 8, background: "#161b22", border: "1px solid #333", color: "#fff", fontSize: 20, fontFamily: "'Brush Script MT', cursive", marginBottom: 6, boxSizing: "border-box" }} />
      <p style={{ fontSize: 11, color: "#666", marginBottom: 20 }}>
        By typing your name and clicking Sign, you agree this constitutes your electronic signature. Your name, the time you signed and your IP address will be recorded on the document. This is a simple electronic signature under the US ESIGN Act and EU eIDAS; it is not notarised.
      </p>

      <button onClick={submit} disabled={!typed.trim() || signing}
        style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: TEAL, color: NAVY, fontSize: 16, fontWeight: 700, cursor: typed.trim() && !signing ? "pointer" : "default", opacity: typed.trim() && !signing ? 1 : 0.5 }}>
        {signing ? "Signing…" : "Sign document"}
      </button>

      <p style={{ fontSize: 11, color: "#555", marginTop: 16, textAlign: "center" }}>
        Signing as {ctx?.signerEmail}
      </p>
    </div></div>
  );
}