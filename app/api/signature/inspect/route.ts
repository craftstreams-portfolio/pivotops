import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { storagePath } from "@/lib/signature/seal";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Inspect an uploaded document: is it a PDF, how many pages, what page sizes,
 * and does it carry AcroForm fields we can fill programmatically?
 * The Admin Docs Console calls this before showing the field-mapping UI.
 */
export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 });

  const admin = getAdmin();
  const { data: file } = await admin
    .from("admin_doc_files")
    .select("id, name, file_url")
    .eq("id", fileId)
    .single();

  if (!file?.file_url) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from("admin-documents")
    .download(storagePath(file.file_url));

  if (dlErr || !blob) {
    return NextResponse.json({ error: "Could not read the file." }, { status: 500 });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isPdf =
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

  if (!isPdf) {
    return NextResponse.json({
      isPdf: false,
      pages: [],
      acroFields: [],
      note: "Not a PDF. Signatures will be recorded on a Certificate of Completion; the original file is retained unchanged.",
    });
  }

  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const pages = pdf.getPages().map((p, i) => {
      const { width, height } = p.getSize();
      return { index: i, width, height };
    });

    let acroFields: { name: string; type: string }[] = [];
    try {
      acroFields = pdf.getForm().getFields().map((f) => ({
        name: f.getName(),
        type: f.constructor.name.replace(/^PDF/, ""),
      }));
    } catch {
      acroFields = [];
    }

    return NextResponse.json({
      isPdf: true,
      pageCount: pages.length,
      pages,
      acroFields,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Could not parse the PDF." },
      { status: 500 }
    );
  }
}