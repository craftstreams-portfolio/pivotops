import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, EMAIL_SENDERS } from "@/lib/email";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

// GET: fetch the signing context by token (document + whether already signed)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const admin = getAdmin();
  const { data: sig } = await admin.from("signatures").select("*").eq("token", token).single();
  if (!sig) return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  const { data: reqRow } = await admin.from("signature_requests").select("*").eq("id", sig.request_id).single();
  if (!reqRow) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const { data: file } = await admin.from("admin_doc_files").select("name, file_url, file_name").eq("id", reqRow.admin_doc_file_id).single();
  return NextResponse.json({
    docName: reqRow.doc_name ?? file?.name ?? "Document",
    fileUrl: file?.file_url ?? null,
    message: reqRow.message ?? null,
    sentBy: reqRow.sent_by ?? "",
    signerName: sig.signer_name ?? "",
    signerEmail: sig.signer_email,
    alreadySigned: sig.signed,
    signedAt: sig.signed_at,
    requestStatus: reqRow.status,
  });
}

// POST: record a signature
export async function POST(req: NextRequest) {
  try {
    const { token, signatureText } = await req.json();
    if (!token || !signatureText?.trim()) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

    const admin = getAdmin();
    const { data: sig } = await admin.from("signatures").select("*").eq("token", token).single();
    if (!sig) return NextResponse.json({ error: "Invalid link." }, { status: 404 });
    if (sig.signed) return NextResponse.json({ error: "Already signed.", alreadySigned: true }, { status: 409 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
    const now = new Date().toISOString();

    const { error: updErr } = await admin.from("signatures").update({
      signed: true, signature_text: signatureText.trim(), signed_at: now, signer_ip: ip,
    }).eq("token", token);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // Check if ALL parties on this request have now signed
    const { data: allSigs } = await admin.from("signatures").select("signed, signer_email, signer_name").eq("request_id", sig.request_id);
    const remaining = (allSigs ?? []).filter(s => !s.signed).length;

    if (remaining === 0) {
      // All signed -> mark request completed, email everyone the completed copy
      await admin.from("signature_requests").update({ status: "completed", completed_at: now }).eq("id", sig.request_id);
      const { data: reqRow } = await admin.from("signature_requests").select("*").eq("id", sig.request_id).single();
      const { data: file } = await admin.from("admin_doc_files").select("name, file_url").eq("id", reqRow?.admin_doc_file_id).single();
      for (const party of (allSigs ?? [])) {
        const html = `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#06070D">All signatures collected: ${reqRow?.doc_name ?? "Document"}</h2>
            <p>Hello${party.signer_name ? " " + party.signer_name : ""},</p>
            <p>All parties have signed <strong>${reqRow?.doc_name ?? "the document"}</strong>. A copy is available below.</p>
            ${file?.file_url ? `<p><a href="${file.file_url}" style="display:inline-block;background:#00BFA6;color:#06070D;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">View Document</a></p>` : ""}
            <p style="font-size:11px;color:#aaa">This document was signed using PivotOps simple electronic signatures. Not a certified or notarized signature.</p>
          </div>`;
        await sendEmail({ to: party.signer_email, subject: `Completed: ${reqRow?.doc_name ?? "Document"}`, html, from: EMAIL_SENDERS.notifications });
      }
    }

    return NextResponse.json({ success: true, allSigned: remaining === 0, remaining });
  } catch (e: any) {
    console.error("[signature/sign]", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}