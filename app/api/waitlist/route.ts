import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, EMAIL_SENDERS } from "@/lib/email";
import { baseLayout, h1, p, btn, infoBox } from "@/lib/email/layout";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { fullName, email, company, teamSize } = await req.json();

    if (!fullName?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    // Save to waitlist
    const { error } = await sb.from("waitlist").insert({
      full_name:  fullName.trim(),
      email:      email.trim().toLowerCase(),
      company:    company?.trim() || null,
      team_size:  teamSize || null,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "You are already on the waitlist." }, { status: 409 });
      }
      throw new Error(error.message);
    }

    // Send confirmation email
    const html = baseLayout({
      title:   "You're on the PivotOps waitlist",
      preview: "We'll be in touch very soon.",
      accentColor: "#10b981",
      content: `
        ${h1("You're on the list")}
        ${p(`Hi ${fullName.trim()}, thank you for your interest in PivotOps.`)}
        ${p("We are currently in private beta and onboarding new teams carefully. We will reach out personally to set up your workspace as soon as we are ready for you.")}
        ${infoBox([
          { label: "Name",      value: fullName.trim() },
          { label: "Company",   value: company?.trim() || "—" },
          { label: "Team size", value: teamSize || "—" },
        ])}
        ${p("In the meantime, if you have any questions or want to move faster, reply directly to this email or reach out at support@pivotops.app.")}
        ${btn("Learn more about PivotOps", "https://www.pivotops.app")}
      `,
    });

    await sendEmail({
      to:      email.trim().toLowerCase(),
      subject: "You're on the PivotOps waitlist",
      html,
      from:    EMAIL_SENDERS.notifications,
      replyTo: "support@pivotops.app",
    });

    // Notify Steve via email
    await sendEmail({
      to:      "steveake01@gmail.com",
      subject: `New waitlist signup: ${fullName.trim()} — ${company?.trim() || "No company"}`,
      html:    baseLayout({
        title: "New waitlist signup",
        content: `
          ${h1("New waitlist signup")}
          ${infoBox([
            { label: "Name",      value: fullName.trim() },
            { label: "Email",     value: email.trim() },
            { label: "Company",   value: company?.trim() || "—" },
            { label: "Team size", value: teamSize || "—" },
          ])}
        `,
      }),
      from: EMAIL_SENDERS.notifications,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Waitlist]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}