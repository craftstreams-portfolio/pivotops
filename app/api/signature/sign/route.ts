import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, EMAIL_SENDERS } from "@/lib/email";
import { sealSignedDocument } from "@/lib/signature/seal";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

// admin-documents is a PRIVATE bucket, so getPublicUrl 404s. Generate a signed URL instead.
async function signedAdminUrl(admin: ReturnType<typeof getAdmin>, storedUrl: string | null): Promise<string | null> {
  if (!storedUrl) return null;
  // Extract the object path after "admin-documents/"
  const marker = "/admin-documents/";
  const idx = storedUrl.indexOf(marker);
  const path = idx >= 0 ? storedUrl.substring(idx + marker.length) : storedUrl;
  const { data, error } = await admin.storage.from("admin-documents").createSignedUrl(decodeURIComponent(path), 60 * 60 * 24 * 7); // 7-day link
  if (error || !data) return null;
  return data.signedUrl;
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
  const viewUrl = await signedAdminUrl(admin, file?.file_url ?? null);
  const { data: myFields } = await admin
    .from("signature_fields")
    .select("id, kind, label, required, page_index, x, y, w, h, source")
    .eq("request_id", sig.request_id)
    .eq("signature_id", sig.id)
    .order("page_index", { ascending: true });

  return NextResponse.json({
    fields: myFields ?? [],
    docName: reqRow.doc_name ?? file?.name ?? "Document",
    fileUrl: viewUrl,
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
    const { token, signatureText, fieldValues } = await req.json();
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

    // Persist what the signer typed into each of their fields. Signature/initials/date
    // fields are derived at seal time from the signature record, so only free-text
    // fields need an explicit value here.
    if (fieldValues && typeof fieldValues === "object") {
      for (const [fieldId, val] of Object.entries(fieldValues as Record<string, string>)) {
        if (typeof val !== "string") continue;
        await admin.from("signature_fields")
          .update({ value: val.trim() })
          .eq("id", fieldId)
          .eq("signature_id", sig.id);   // a signer can only fill their own fields
      }
    }

    // Check if ALL parties on this request have now signed
    const { data: allSigs } = await admin.from("signatures").select("id, signed, signer_email, signer_name, signature_text, signed_at, signer_ip, token").eq("request_id", sig.request_id);
    const remaining = (allSigs ?? []).filter(s => !s.signed).length;

    if (remaining === 0) {
      // All signed -> mark request completed, email everyone the completed copy
      await admin.from("signature_requests").update({ status: "completed", completed_at: now }).eq("id", sig.request_id);
      const { data: reqRow } = await admin.from("signature_requests").select("*").eq("id", sig.request_id).single();
      const { data: file } = await admin.from("admin_doc_files").select("name, file_url").eq("id", reqRow?.admin_doc_file_id).single();

      // Seal: append a Certificate of Completion (every signer, time, IP) to the
      // document, flatten it, and hash it. Previously we emailed the ORIGINAL,
      // unsigned file — the consent was recorded but the artifact showed nothing.
      let signedDocUrl: string | null = null;
      const { data: fieldRows } = await admin
        .from("signature_fields")
        .select("*")
        .eq("request_id", sig.request_id);

      const sealed = await sealSignedDocument(admin, {
        requestId: sig.request_id,
        tenantId:  sig.tenant_id,
        docName:   reqRow?.doc_name ?? file?.name ?? "Document",
        sentBy:    reqRow?.sent_by ?? "",
        fileUrl:   file?.file_url ?? null,
        signers:   (allSigs ?? []) as any,
        fields:    (fieldRows ?? []) as any,
      });

      if ("error" in sealed) {
        console.error("[signature/sign] seal failed:", sealed.error);
        signedDocUrl = await signedAdminUrl(admin, file?.file_url ?? null); // fall back to the original
      } else {
        await admin.from("signature_requests").update({
          signed_file_path: sealed.path,
          signed_file_hash: sealed.hash,
          sealed_at:        now,
        }).eq("id", sig.request_id);

        const { data: link } = await admin.storage
          .from("admin-documents")
          .createSignedUrl(sealed.path, 60 * 60 * 24 * 7);
        signedDocUrl = link?.signedUrl ?? null;
      }
      for (const party of (allSigs ?? [])) {
        const html = `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#06070D">All signatures collected: ${reqRow?.doc_name ?? "Document"}</h2>
            <p>Hello${party.signer_name ? " " + party.signer_name : ""},</p>
            <p>All parties have signed <strong>${reqRow?.doc_name ?? "the document"}</strong>. A copy is available below.</p>
            ${signedDocUrl ? `<p><a href="${signedDocUrl}" style="display:inline-block;background:#00BFA6;color:#06070D;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">View Document</a></p>` : ""}
            <p style="font-size:11px;color:#aaa">Signed with PivotOps electronic signatures. The attached copy includes a Certificate of Completion recording each signer, the time they signed and their IP address. This is a simple electronic signature under the US ESIGN Act and EU eIDAS; it is not notarised.</p>
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