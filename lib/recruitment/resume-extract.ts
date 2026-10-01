// Server-only resume text extraction. Fetches the uploaded resume from its
// storage URL and pulls plain text from PDF (unpdf) or DOCX (mammoth).
// Returns { text, ok } -- ok=false on any failure so the caller can fall back
// to cover-letter-only scoring and flag for manual review.

export interface ResumeExtractResult {
  text: string;
  ok:   boolean;
  error?: string;
}

export async function extractResumeText(resumeUrl: string | null | undefined): Promise<ResumeExtractResult> {
  if (!resumeUrl) return { text: "", ok: false, error: "no resume url" };

  try {
    const res = await fetch(resumeUrl);
    if (!res.ok) return { text: "", ok: false, error: `fetch ${res.status}` };
    const buf = new Uint8Array(await res.arrayBuffer());

    const lower = resumeUrl.toLowerCase();
    const isPdf  = lower.includes(".pdf");
    const isDocx = lower.includes(".docx") || lower.includes(".doc");

    if (isPdf) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      const merged = Array.isArray(text) ? text.join("\n") : (text ?? "");
      if (!merged.trim()) return { text: "", ok: false, error: "empty pdf text" };
      return { text: merged, ok: true };
    }

    if (isDocx) {
      const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
      const { value } = await (mammoth as any).extractRawText({ buffer: Buffer.from(buf) });
      if (!value?.trim()) return { text: "", ok: false, error: "empty docx text" };
      return { text: value, ok: true };
    }

    return { text: "", ok: false, error: "unsupported file type" };
  } catch (e) {
    return { text: "", ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}