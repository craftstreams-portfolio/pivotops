import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, EMAIL_SENDERS } from "@/lib/email";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
function authClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Send the signing links for a deferred request, once fields are placed. */
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await authClient().auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdmin();
    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { requestId } = await req.json();
    if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });

    const { data: reqRow } = await admin
      .from("signature_requests")
      .select("id, tenant_id, doc_name, sent_by, message")
      .eq("id", requestId)
      .single();
    if (!reqRow || reqRow.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Request not found in your tenant." }, { status: 404 });
    }

    const { data: sigs } = await admin
      .from("signatures")
      .select("signer_name, signer_email, token")
      .eq("request_id", requestId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app";
    let emailed = 0;

    for (const s of sigs ?? []) {
      const signUrl = `${baseUrl}/sign/${s.token}`;
      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#06070D">Signature requested: ${reqRow.doc_name ?? "Document"}</h2>
          <p>Hello${s.signer_name ? " " + s.signer_name : ""},</p>
          <p><strong>${reqRow.sent_by ?? "An organization"}</strong> has requested your signature on
             <strong>${reqRow.doc_name ?? "a document"}</strong>.</p>
          ${reqRow.message ? `<p style="color:#555">"${reqRow.message}"</p>` : ""}
          <p><a href="${signUrl}" style="display:inline-block;background:#00BFA6;color:#06070D;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">Review &amp; Sign</a></p>
          <p style="font-size:12px;color:#888">Or paste this link: ${signUrl}</p>
          <p style="font-size:11px;color:#aaa">Simple electronic signature under the US ESIGN Act and EU eIDAS. Not notarised.</p>
        </div>`;
      const res = await sendEmail({
        to: s.signer_email,
        subject: `Signature requested: ${reqRow.doc_name ?? "Document"}`,
        html,
        from: EMAIL_SENDERS.notifications,
      });
      if (res?.ok) emailed++;
    }

    return NextResponse.json({ success: true, emailed, parties: (sigs ?? []).length });
  } catch (e: any) {
    console.error("[signature/dispatch]", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}