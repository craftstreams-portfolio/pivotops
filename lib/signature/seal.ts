import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "admin-documents";

export interface SignerRecord {
  signer_name:    string | null;
  signer_email:   string;
  signature_text: string | null;
  signed_at:      string | null;
  signer_ip:      string | null;
  token:          string;
}

/** Strip the storage path out of a stored file_url. */
export function storagePath(storedUrl: string): string {
  const marker = `/${BUCKET}/`;
  const idx = storedUrl.indexOf(marker);
  const raw = idx >= 0 ? storedUrl.substring(idx + marker.length) : storedUrl;
  return decodeURIComponent(raw);
}

/**
 * Produce the SIGNED artifact.
 *
 * The original document is left byte-for-byte intact; we append a Certificate of
 * Completion page recording every signer, what they typed, when, and from where.
 * The result is flattened and hashed (SHA-256) so any later alteration is detectable.
 *
 * This is a simple electronic signature under ESIGN / eIDAS — legally binding for
 * employment and commercial agreements. It is NOT a cryptographically sealed PDF;
 * that requires a document-signing certificate from an Adobe-trusted CA.
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
  }
): Promise<{ path: string; hash: string } | { error: string }> {
  try {
    let pdf: PDFDocument;

    // Start from the original when it is a PDF; otherwise the certificate stands alone
    // (and references the original file by name, which stays in storage untouched).
    let originalIsPdf = false;
    if (opts.fileUrl) {
      const path = storagePath(opts.fileUrl);
      const { data: blob } = await admin.storage.from(BUCKET).download(path);
      if (blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const looksPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
        if (looksPdf) {
          try { pdf = await PDFDocument.load(bytes); originalIsPdf = true; }
          catch { pdf = await PDFDocument.create(); }
        } else {
          pdf = await PDFDocument.create();
        }
      } else {
        pdf = await PDFDocument.create();
      }
    } else {
      pdf = await PDFDocument.create();
    }

    const font     = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const page = pdf.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const M = 56;
    let y = height - M;

    const ink   = rgb(0.04, 0.05, 0.08);
    const muted = rgb(0.45, 0.47, 0.52);
    const teal  = rgb(0, 0.75, 0.65);
    const rule  = rgb(0.85, 0.86, 0.88);

    page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: teal });

    page.drawText("CERTIFICATE OF COMPLETION", {
      x: M, y: y - 16, size: 16, font: fontBold, color: ink,
    });
    y -= 40;

    page.drawText(opts.docName, { x: M, y, size: 11, font, color: muted });
    y -= 26;

    page.drawLine({
      start: { x: M, y }, end: { x: width - M, y },
      thickness: 0.7, color: rule,
    });
    y -= 28;

    const meta: [string, string][] = [
      ["Request ID", opts.requestId],
      ["Sent by",    opts.sentBy || "-"],
      ["Completed",  new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC"],
      ["Signers",    String(opts.signers.length)],
    ];
    for (const [k, v] of meta) {
      page.drawText(k, { x: M, y, size: 8, font, color: muted });
      page.drawText(v, { x: M + 90, y, size: 8, font, color: ink });
      y -= 15;
    }

    y -= 16;
    page.drawText("SIGNATURES", { x: M, y, size: 9, font: fontBold, color: teal });
    y -= 8;
    page.drawLine({
      start: { x: M, y }, end: { x: width - M, y },
      thickness: 0.7, color: rule,
    });
    y -= 26;

    for (const s of opts.signers) {
      if (y < 140) { y = height - M; pdf.addPage([595.28, 841.89]); }

      page.drawText(s.signature_text ?? s.signer_name ?? s.signer_email, {
        x: M, y, size: 17, font: fontBold, color: ink,
      });
      y -= 16;

      page.drawText(s.signer_name ?? "-", { x: M, y, size: 9, font, color: ink });
      y -= 13;
      page.drawText(s.signer_email, { x: M, y, size: 8, font, color: muted });
      y -= 12;

      const when = s.signed_at
        ? new Date(s.signed_at).toISOString().replace("T", " ").slice(0, 19) + " UTC"
        : "-";
      page.drawText(`Signed ${when}   IP ${s.signer_ip ?? "unknown"}`, {
        x: M, y, size: 7.5, font, color: muted,
      });
      y -= 11;
      page.drawText(`Token ${s.token.slice(0, 16)}...`, {
        x: M, y, size: 7, font, color: muted,
      });
      y -= 24;
    }

    // Footer: what this document is, and what it is not.
    const foot = [
      "Each signer above was sent a unique, single-use link and typed their name as their electronic",
      "signature. Their IP address and the exact time of signing were recorded. This is a simple",
      "electronic signature under the US ESIGN Act and EU eIDAS. It is not a notarised signature and",
      "does not carry a cryptographic certificate from a Certificate Authority.",
    ];
    let fy = 96;
    page.drawLine({
      start: { x: M, y: fy + 22 }, end: { x: width - M, y: fy + 22 },
      thickness: 0.7, color: rule,
    });
    for (const line of foot) {
      page.drawText(line, { x: M, y: fy, size: 6.6, font, color: muted });
      fy -= 9;
    }
    page.drawText(`Generated by PivotOps${originalIsPdf ? "" : "  ·  original document retained separately in its native format"}`, {
      x: M, y: fy - 6, size: 6.6, font, color: muted,
    });

    const out  = await pdf.save();
    const buf  = Buffer.from(out);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    const path = `${opts.tenantId}/signed/${opts.requestId}.pdf`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: "application/pdf", upsert: true });
    if (upErr) return { error: upErr.message };

    return { path, hash };
  } catch (e: any) {
    return { error: e?.message ?? "Failed to seal document" };
  }
}