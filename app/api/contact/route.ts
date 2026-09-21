import { NextRequest, NextResponse } from "next/server";
import { sendEmail, EMAIL_SENDERS } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message, company } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }
    // Basic email shape check
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const safe = (s: string) => String(s ?? "").slice(0, 5000);
    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
        <h2 style="font-size: 18px; margin: 0 0 12px;">New contact form submission</h2>
        <p style="margin: 4px 0;"><strong>Name:</strong> ${safe(name)}</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${safe(email)}</p>
        ${company ? `<p style="margin: 4px 0;"><strong>Company:</strong> ${safe(company)}</p>` : ""}
        ${subject ? `<p style="margin: 4px 0;"><strong>Subject:</strong> ${safe(subject)}</p>` : ""}
        <p style="margin: 12px 0 4px;"><strong>Message:</strong></p>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #3f3f46;">${safe(message)}</p>
      </div>
    `;

    const result = await sendEmail({
      to:      "craftstreams@gmail.com",
      subject: `Contact form: ${subject || "New message"} — from ${name}`,
      html,
      from:    EMAIL_SENDERS.support,
      replyTo: email,
    });

    if (!result.ok) {
      console.error("[contact] send failed", result.error);
      return NextResponse.json({ error: "Failed to send message. Please email support@pivotops.app." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}