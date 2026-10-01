import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

function htmlPage(title: string, message: string, detail: string, color: string) {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f4f4f5; }
    .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px;
            text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { font-size: 22px; color: #18181b; margin: 0 0 12px; }
    .detail { margin: 20px auto; padding: 16px 20px; background: #f4f4f5; border-radius: 10px;
              border-left: 4px solid ${color}; text-align: left; }
    .detail p { margin: 0; font-size: 15px; font-weight: 600; color: #18181b; }
    .detail span { font-size: 13px; color: #71717a; }
    p { font-size: 15px; color: #71717a; line-height: 1.6; margin: 0; }
    .badge { display: inline-block; margin-top: 20px; padding: 6px 16px; border-radius: 999px;
             font-size: 13px; font-weight: 600; background: #f4f4f5; color: #71717a; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <div class="detail"><p>${detail}</p></div>
    <p>${message}</p>
    <div class="badge">PivotOps</div>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return htmlPage("Invalid Link", "Please contact your recruiter for assistance.", "This link is invalid.", "#ef4444");
  }

  const admin = getAdmin();
  const { data: candidate, error } = await admin
    .from("candidates")
    .select("id, name, role, interview_scheduled_at, applied_timezone, tenant_id, interview_token")
    .eq("interview_token", token)
    .maybeSingle();

  if (error || !candidate) {
    return htmlPage("Link Not Found", "Please contact your recruiter if you need the interview details resent.", "This link has expired or is no longer valid.", "#f59e0b");
  }

  const scheduledAt = candidate.interview_scheduled_at
    ? new Date(candidate.interview_scheduled_at)
    : null;

  const tz = candidate.applied_timezone || "UTC";
  let localTime = "Time to be confirmed";
  if (scheduledAt) {
    try {
      localTime = scheduledAt.toLocaleString("en-US", { timeZone: tz, dateStyle: "full", timeStyle: "short" });
    } catch {
      localTime = scheduledAt.toISOString();
    }
  }

  return htmlPage(
    "Interview Confirmed",
    `We look forward to speaking with you, ${candidate.name ?? ""}. Please keep this time free and ensure you are available at the scheduled time.`,
    `${localTime} (${tz})`,
    "#6366f1"
  );
}