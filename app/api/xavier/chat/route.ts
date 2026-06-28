import { NextResponse } from "next/server";

const XAVIER_SYSTEM = `You are Xavier, PivotOps AI advisor on the landing page. Help prospects understand the product and choose the right plan. Be direct, confident, and helpful. Never be salesy or pushy. Answer honestly. PivotOps automates the path from job opening to working employee: intake, AI candidate scoring 0-100, interview routing, onboarding, task routing, compliance tracking, and attendance, running as one system. Plans: Starter $1500/mo, Professional $2500/mo, Enterprise $6000/mo (annual billed yearly at a discount). When helping choose a plan: ask how many recruiters, if they need compliance tracking, if multi-location.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[xavier/chat] ANTHROPIC_API_KEY not set");
      return NextResponse.json({ error: "Chat is temporarily unavailable." }, { status: 503 });
    }

    // Basic guard: cap message count + length to prevent abuse on a public endpoint
    const trimmed = messages
      .slice(-12)
      .map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "").slice(0, 2000),
      }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: XAVIER_SYSTEM,
        messages: trimmed,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[xavier/chat] anthropic error", res.status, errText);
      return NextResponse.json({ error: "Chat failed. Please try again." }, { status: 502 });
    }

    const data = await res.json();
    const reply = Array.isArray(data?.content)
      ? data.content.map((b: any) => (b.type === "text" ? b.text : "")).join("").trim()
      : "";

    return NextResponse.json({ reply: reply || "Sorry, I could not generate a response." });
  } catch (e) {
    console.error("[xavier/chat]", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}