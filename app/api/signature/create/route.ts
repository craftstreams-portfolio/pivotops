import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, EMAIL_SENDERS } from "@/lib/email";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function authClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function POST(req: NextRequest) {
  try {
    // Auth: verify the caller and resolve their tenant
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: userErr } = await authClient().auth.getUser(token);
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdmin();
    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "No tenant for user" }, { status: 403 });

    const { data: tenantRow } = await admin.from("tenants").select("org_name").eq("id", tenantId).maybeSingle();
    const orgName = tenantRow?.org_name || "Your organization";

    const body = await req.json();
    const { adminDocFileId, docName, recipients, message, defer } = body as {
      adminDocFileId: string;
      docName?: string;
      recipients: { name?: string; email: string }[];
      message?: string;
      defer?: boolean;   // when true, create the request + signers but hold the emails
    };

    if (!adminDocFileId || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Missing document or recipients." }, { status: 400 });
    }
    const clean = recipients.filter(r => r.email && /\S+@\S+\.\S+/.test(r.email));
    if (clean.length === 0) return NextResponse.json({ error: "No valid recipient emails." }, { status: 400 });

    // Verify the document belongs to this tenant
    const { data: file } = await admin.from("admin_doc_files").select("id, name, tenant_id, file_url").eq("id", adminDocFileId).single();
    if (!file || file.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Document not found in your tenant." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: reqRow, error: reqErr } = await admin.from("signature_requests").insert({
      tenant_id: tenantId,
      admin_doc_file_id: adminDocFileId,
      doc_name: docName ?? file.name ?? "Document",
      sent_by: orgName,
      message: message ?? null,
      status: "pending",
      created_at: now,
    }).select().single();
    if (reqErr || !reqRow) return NextResponse.json({ error: "Failed to create request: " + (reqErr?.message ?? "") }, { status: 500 });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app";
    const rows = clean.map((r, i) => ({
      request_id: reqRow.id,
      tenant_id: tenantId,
      signer_name: r.name ?? null,
      signer_email: r.email,
      token: crypto.randomUUID(),
      signed: false,
      sign_order: i,
      created_at: now,
    }));
    const { data: sigRows, error: sigErr } = await admin.from("signatures").insert(rows).select("id, signer_name, signer_email, token");
    if (sigErr) return NextResponse.json({ error: "Failed to create signatures: " + sigErr.message }, { status: 500 });

    // Deferred: caller will place fields, then hit /api/signature/dispatch to send.
    if (defer) {
      return NextResponse.json({ success: true, requestId: reqRow.id, deferred: true, signers: sigRows ?? [] });
    }

    // Email each party a signing link
    let emailed = 0;
    for (const row of rows) {
      const signUrl = `${baseUrl}/sign/${row.token}`;
      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#06070D">Signature requested: ${file.name ?? "Document"}</h2>
          <p>Hello${row.signer_name ? " " + row.signer_name : ""},</p>
          <p><strong>${orgName}</strong> has requested your signature on <strong>${file.name ?? "a document"}</strong>.</p>
          ${message ? `<p style="color:#555">"${message}"</p>` : ""}
          <p><a href="${signUrl}" style="display:inline-block;background:#00BFA6;color:#06070D;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">Review & Sign</a></p>
          <p style="font-size:12px;color:#888">Or paste this link: ${signUrl}</p>
          <p style="font-size:11px;color:#aaa">This is a simple electronic signature request. It is not a certified or notarized signature.</p>
        </div>`;
      const res = await sendEmail({ to: row.signer_email, subject: `Signature requested: ${file.name ?? "Document"}`, html, from: EMAIL_SENDERS.notifications });
      if (res?.ok) emailed++;
    }

    return NextResponse.json({ success: true, requestId: reqRow.id, parties: rows.length, emailed });
  } catch (e: any) {
    console.error("[signature/create]", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}