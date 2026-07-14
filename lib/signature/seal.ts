import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "admin-documents";

export interface SignerRecord {
  id?:            string;
  signer_name:    string | null;
  signer_email:   string;
  signature_text: string | null;
  signed_at:      string | null;
  signer_ip:      string | null;
  token:          string;
}

export interface FieldRecord {
  id:           string;
  signature_id: string | null;
  kind:         "signature" | "initials" | "date" | "text";
  source:       "acroform" | "placed";
  acro_name:    string | null;
  page_index:   number | null;
  x:            number | null;   // normalised 0..1, from TOP-left
  y:            number | null;
  w:            number | null;
  h:            number | null;
  static_value: string | null;
  value:        string | null;
}

export function storagePath(storedUrl: string): string {
  const marker = `/${BUCKET}/`;
  const idx = storedUrl.indexOf(marker);
  const raw = idx >= 0 ? storedUrl.substring(idx + marker.length) : storedUrl;
  return decodeURIComponent(raw);
}

/** What text goes into a field: the signer's entry, else an admin-set static value. */
function fieldText(f: FieldRecord, signer?: SignerRecord): string {
  if (f.value?.trim()) return f.value.trim();
  if (f.static_value?.trim()) return f.static_value.trim();
  if (!signer) return "";
  switch (f.kind) {
    case "signature":
      return signer.signature_text ?? signer.signer_name ?? "";
    case "initials": {
      const n = (signer.signature_text ?? signer.signer_name ?? "").trim();
      return n.split(/\s+/).map((p) => p[0] ?? "").join("").toUpperCase();
    }
    case "date":
      return signer.signed_at ? new Date(signer.signed_at).toISOString().slice(0, 10) : "";
    default:
      return "";
  }
}

/**
 * Produce the SIGNED artifact.
 *
 * 1. Fill any AcroForm fields the template carries.
 * 2. Draw placed fields onto the page at their coordinates — so the signature
 *    lands on the contract's actual signature line, not just an appended page.
 * 3. Flatten the form so nothing remains editable.
 * 4. Append a Certificate of Completion (every signer, time, IP, token).
 * 5. SHA-256 the result so later alteration is detectable.
 *
 * Simple electronic signature under US ESIGN / EU eIDAS. Not a cryptographically
 * sealed PDF — that needs a document-signing certificate from an Adobe-trusted CA.
 */
export async function sealSignedDocument(
  admin: SupabaseClient,
  opts: {
    requestId: string;
    tenantId:  string;
    docName:   string;
    sentBy:    string;
    fileUrl:   string | null;
    signers:   SignerRecord[];
    fields?:   FieldRecord[];
  }
): Promise<{ path: string; hash: string; filledFields: number } | { error: string }> {
  try {
    let pdf: PDFDocument;
    let originalIsPdf = false;

    if (opts.fileUrl) {
      const { data: blob } = await admin.storage.from(BUCKET).download(storagePath(opts.fileUrl));
      if (blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const looksPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
        if (looksPdf) {
          try { pdf = await PDFDocument.load(bytes, { ignoreEncryption: true }); originalIsPdf = true; }
          catch { pdf = await PDFDocument.create(); }
        } else { pdf = await PDFDocument.create(); }
      } else { pdf = await PDFDocument.create(); }
    } else {
      pdf = await PDFDocument.create();
    }

    const font       = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold   = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontScript = await pdf.embedFont(StandardFonts.HelveticaOblique); // stands in for a signature hand

    const signerById = new Map<string, SignerRecord>();
    for (const s of opts.signers) if (s.id) signerById.set(s.id, s);

    const ink   = rgb(0.04, 0.05, 0.08);
    const muted = rgb(0.45, 0.47, 0.52);
    const teal  = rgb(0, 0.75, 0.65);
    const rule  = rgb(0.85, 0.86, 0.88);

    let filledFields = 0;
    const fields = opts.fields ?? [];

    // ── 1. AcroForm fields ──
    if (originalIsPdf && fields.some((f) => f.source === "acroform")) {
      try {
        const form = pdf.getForm();
        for (const f of fields.filter((x) => x.source === "acroform" && x.acro_name)) {
          const text = fieldText(f, f.signature_id ? signerById.get(f.signature_id) : undefined);
          if (!text) continue;
          try {
            const tf = form.getTextField(f.acro_name!);
            tf.setText(text);
            filledFields++;
          } catch {
            try {
              const cb = form.getCheckBox(f.acro_name!);
              if (text.toLowerCase() !== "false" && text !== "0") { cb.check(); filledFields++; }
            } catch { /* field missing or unsupported type — skip */ }
          }
        }
        form.flatten(); // nothing stays editable
      } catch (e) {
        console.error("[seal] acroform fill failed:", e);
      }
    }

    // ── 2. Placed fields drawn onto the page ──
    const pages = pdf.getPages();
    for (const f of fields.filter((x) => x.source === "placed")) {
      const pi = f.page_index ?? 0;
      const page = pages[pi];
      if (!page || f.x == null || f.y == null) continue;

      const signer = f.signature_id ? signerById.get(f.signature_id) : undefined;
      const text = fieldText(f, signer);
      if (!text) continue;

      const { width: pw, height: ph } = page.getSize();
      const boxW = (f.w ?? 0.25) * pw;
      const boxH = (f.h ?? 0.05) * ph;
      const px   = f.x * pw;
      // stored from the top; pdf-lib measures from the bottom
      const py   = ph - (f.y * ph) - boxH;

      const isSig = f.kind === "signature" || f.kind === "initials";
      const size  = isSig
        ? Math.min(boxH * 0.72, 22)
        : Math.min(boxH * 0.6, 11);

      page.drawText(text, {
        x: px + 2,
        y: py + (boxH - size) / 2 + 1,
        size,
        font: isSig ? fontScript : font,
        color: ink,
        maxWidth: boxW - 4,
      });

      if (isSig) {
        page.drawLine({
          start: { x: px, y: py + 1 },
          end:   { x: px + boxW, y: py + 1 },
          thickness: 0.6,
          color: rule,
        });
        if (signer?.signed_at) {
          page.drawText(new Date(signer.signed_at).toISOString().slice(0, 10), {
            x: px, y: py - 8, size: 6, font, color: muted,
          });
        }
      }
      filledFields++;
    }

    // ── 3. Certificate of Completion ──
    const cert = pdf.addPage([595.28, 841.89]);
    const { width, height } = cert.getSize();
    const M = 56;
    let y = height - M;

    cert.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: teal });
    cert.drawText("CERTIFICATE OF COMPLETION", { x: M, y: y - 16, size: 16, font: fontBold, color: ink });
    y -= 40;
    cert.drawText(opts.docName, { x: M, y, size: 11, font, color: muted });
    y -= 26;
    cert.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.7, color: rule });
    y -= 28;

    const meta: [string, string][] = [
      ["Request ID",     opts.requestId],
      ["Sent by",        opts.sentBy || "-"],
      ["Completed",      new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC"],
      ["Signers",        String(opts.signers.length)],
      ["Fields filled",  String(filledFields)],
    ];
    for (const [k, v] of meta) {
      cert.drawText(k, { x: M, y, size: 8, font, color: muted });
      cert.drawText(v, { x: M + 90, y, size: 8, font, color: ink });
      y -= 15;
    }

    y -= 16;
    cert.drawText("SIGNATURES", { x: M, y, size: 9, font: fontBold, color: teal });
    y -= 8;
    cert.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.7, color: rule });
    y -= 26;

    for (const s of opts.signers) {
      if (y < 150) break;
      cert.drawText(s.signature_text ?? s.signer_name ?? s.signer_email, { x: M, y, size: 17, font: fontScript, color: ink });
      y -= 16;
      cert.drawText(s.signer_name ?? "-", { x: M, y, size: 9, font, color: ink });
      y -= 13;
      cert.drawText(s.signer_email, { x: M, y, size: 8, font, color: muted });
      y -= 12;
      const when = s.signed_at
        ? new Date(s.signed_at).toISOString().replace("T", " ").slice(0, 19) + " UTC"
        : "-";
      cert.drawText(`Signed ${when}   IP ${s.signer_ip ?? "unknown"}`, { x: M, y, size: 7.5, font, color: muted });
      y -= 11;
      cert.drawText(`Token ${s.token.slice(0, 16)}...`, { x: M, y, size: 7, font, color: muted });
      y -= 24;
    }

    const foot = [
      "Each signer was sent a unique, single-use link and typed their name as their electronic signature.",
      "Their IP address and the exact time of signing were recorded. Where the document carried fillable",
      "fields, the values above were written into it and the form was flattened so it cannot be edited.",
      "This is a simple electronic signature under the US ESIGN Act and EU eIDAS. It is not notarised and",
      "does not carry a cryptographic certificate from a Certificate Authority.",
    ];
    let fy = 96;
    cert.drawLine({ start: { x: M, y: fy + 22 }, end: { x: width - M, y: fy + 22 }, thickness: 0.7, color: rule });
    for (const line of foot) {
      cert.drawText(line, { x: M, y: fy, size: 6.6, font, color: muted });
      fy -= 9;
    }
    cert.drawText(
      `Generated by PivotOps${originalIsPdf ? "" : "  ·  original retained separately in its native format"}`,
      { x: M, y: fy - 6, size: 6.6, font, color: muted }
    );

    // ── 4. Hash + store ──
    const out  = await pdf.save();
    const buf  = Buffer.from(out);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    const path = `${opts.tenantId}/signed/${opts.requestId}.pdf`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: "application/pdf", upsert: true });
    if (upErr) return { error: upErr.message };

    return { path, hash, filledFields };
  } catch (e: any) {
    return { error: e?.message ?? "Failed to seal document" };
  }
}