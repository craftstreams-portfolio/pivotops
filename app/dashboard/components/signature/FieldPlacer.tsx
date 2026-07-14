"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { PenLine, Type, Calendar, Hash, Trash2, Loader2, Check, X } from "lucide-react";

type FieldKind = "signature" | "initials" | "date" | "text";

interface Signer  { id: string; signer_name: string | null; signer_email: string }
interface Placed  {
  id?: string;
  tempId: string;
  signature_id: string | null;
  kind: FieldKind;
  page_index: number;
  x: number; y: number; w: number; h: number;   // normalised 0..1, from top-left
  label?: string | null;
}

const KINDS: { id: FieldKind; label: string; icon: any; w: number; h: number }[] = [
  { id: "signature", label: "Signature", icon: PenLine,  w: 0.26, h: 0.045 },
  { id: "initials",  label: "Initials",  icon: Hash,     w: 0.09, h: 0.04  },
  { id: "date",      label: "Date",      icon: Calendar, w: 0.14, h: 0.03  },
  { id: "text",      label: "Text",      icon: Type,     w: 0.24, h: 0.03  },
];

const SIGNER_COLORS = ["#00BFA6", "#6366F1", "#F5B301", "#F43F5E", "#8B5CF6"];

export default function FieldPlacer({
  fileId, requestId, tenantId, signers, onDone, onCancel,
}: {
  fileId: string;
  requestId: string;
  tenantId: string;
  signers: Signer[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const [isPdf, setIsPdf]       = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [fields, setFields]     = useState<Placed[]>([]);
  const [activeSigner, setActiveSigner] = useState<string>(signers[0]?.id ?? "");
  const [activeKind, setActiveKind]     = useState<FieldKind>("signature");

  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const wrapRefs   = useRef<Record<number, HTMLDivElement | null>>({});

  const colorFor = (sid: string | null) => {
    const i = signers.findIndex((s) => s.id === sid);
    return SIGNER_COLORS[i < 0 ? 0 : i % SIGNER_COLORS.length];
  };

  // ── Render the PDF ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetch(`/api/signature/inspect?fileId=${fileId}`).then((r) => r.json());
        if (cancelled) return;
        if (meta.error) { setErr(meta.error); setLoading(false); return; }
        if (!meta.isPdf) { setIsPdf(false); setLoading(false); return; }

        setPageCount(meta.pageCount);

        const { data: file } = await supabase
          .from("admin_doc_files").select("file_url").eq("id", fileId).single();
        if (!file?.file_url) { setErr("File not found."); setLoading(false); return; }

        const marker = "/admin-documents/";
        const idx  = file.file_url.indexOf(marker);
        const path = idx >= 0
          ? decodeURIComponent(file.file_url.substring(idx + marker.length))
          : file.file_url;

        const { data: link } = await supabase.storage
          .from("admin-documents").createSignedUrl(path, 3600);
        if (!link?.signedUrl) { setErr("Could not open the document."); setLoading(false); return; }

        // @ts-expect-error - the /build/ subpath ships no type declarations
        const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
        // Worker version MUST match the library version, or it fails to load.
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const doc = await pdfjs.getDocument(link.signedUrl).promise;
        if (cancelled) return;

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const vp   = page.getViewport({ scale: 1.4 });
          const cv   = canvasRefs.current[i - 1];
          if (!cv) continue;
          cv.width  = vp.width;
          cv.height = vp.height;
          const ctx = cv.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        }
        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setErr(e?.message ?? "Could not render the document."); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [fileId, pageCount]);

  // ── Place a field ──
  const placeAt = (pageIndex: number, e: React.MouseEvent) => {
    const wrap = wrapRefs.current[pageIndex];
    if (!wrap || !activeSigner) return;
    const r = wrap.getBoundingClientRect();
    const cfg = KINDS.find((k) => k.id === activeKind)!;

    const x = (e.clientX - r.left) / r.width  - cfg.w / 2;
    const y = (e.clientY - r.top)  / r.height - cfg.h / 2;

    setFields((prev) => [...prev, {
      tempId: crypto.randomUUID(),
      signature_id: activeSigner,
      kind: activeKind,
      page_index: pageIndex,
      x: Math.max(0, Math.min(1 - cfg.w, x)),
      y: Math.max(0, Math.min(1 - cfg.h, y)),
      w: cfg.w,
      h: cfg.h,
    }]);
  };

  const save = async () => {
    if (fields.length === 0) { setErr("Place at least one field, or cancel."); return; }
    setSaving(true); setErr("");
    try {
      const rows = fields.map((f) => ({
        request_id:   requestId,
        tenant_id:    tenantId,
        signature_id: f.signature_id,
        kind:         f.kind,
        source:       "placed",
        page_index:   f.page_index,
        x: f.x, y: f.y, w: f.w, h: f.h,
        required:     true,
      }));
      const { error } = await supabase.from("signature_fields").insert(rows);
      if (error) throw new Error(error.message);
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? "Could not save the fields.");
      setSaving(false);
    }
  };

  if (!isPdf) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-white">This document is not a PDF.</p>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Signatures will still be recorded, and a Certificate of Completion is attached
          to the finished document. Field placement needs a PDF.
        </p>
        <button onClick={onDone}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-white transition">
          Send anyway
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-wrap">
        <div className="flex items-center gap-1.5">
          {signers.map((s, i) => (
            <button key={s.id} onClick={() => setActiveSigner(s.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition border
                ${activeSigner === s.id
                  ? "border-white/25 bg-white/[0.07] text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              <span className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ background: SIGNER_COLORS[i % SIGNER_COLORS.length] }} />
              {s.signer_name ?? s.signer_email}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        <div className="flex items-center gap-1">
          {KINDS.map((k) => (
            <button key={k.id} onClick={() => setActiveKind(k.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition border
                ${activeKind === k.id
                  ? "border-white/25 bg-white/[0.07] text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              <k.icon size={12} /> {k.label}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-zinc-600 ml-auto">
          Click the page to place a field
        </p>
      </div>

      {/* Pages */}
      <div className="flex-1 overflow-y-auto bg-zinc-950 p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-20 text-zinc-500 text-sm">
            <Loader2 size={16} className="animate-spin" /> Rendering document...
          </div>
        )}

        {Array.from({ length: pageCount }).map((_, pi) => (
          <div key={pi} className="mx-auto w-fit">
            <p className="text-[10px] text-zinc-600 mb-1.5">Page {pi + 1}</p>
            <div
              ref={(el) => { wrapRefs.current[pi] = el; }}
              onClick={(e) => placeAt(pi, e)}
              className="relative cursor-crosshair shadow-2xl">
              <canvas ref={(el) => { canvasRefs.current[pi] = el; }} className="block" />

              {fields.filter((f) => f.page_index === pi).map((f) => (
                <div key={f.tempId}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute group rounded"
                  style={{
                    left:   `${f.x * 100}%`,
                    top:    `${f.y * 100}%`,
                    width:  `${f.w * 100}%`,
                    height: `${f.h * 100}%`,
                    border: `1.5px solid ${colorFor(f.signature_id)}`,
                    background: `${colorFor(f.signature_id)}1f`,
                  }}>
                  <span className="absolute -top-4 left-0 text-[9px] font-medium whitespace-nowrap"
                    style={{ color: colorFor(f.signature_id) }}>
                    {KINDS.find((k) => k.id === f.kind)?.label}
                  </span>
                  <button
                    onClick={() => setFields((prev) => prev.filter((x) => x.tempId !== f.tempId))}
                    className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500
                               flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <X size={9} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-zinc-800">
        {err && <p className="text-xs text-red-400">{err}</p>}
        <p className="text-xs text-zinc-600">
          {fields.length} field{fields.length === 1 ? "" : "s"} placed
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCancel}
            className="px-3 py-2 rounded-xl text-xs text-zinc-500 hover:text-white transition">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#00BFA6] hover:bg-[#00d4b8] text-[#04211E]
                       text-xs font-semibold transition disabled:opacity-50
                       flex items-center gap-1.5">
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
              : <><Check size={13} /> Save fields &amp; send</>}
          </button>
        </div>
      </div>
    </div>
  );
}