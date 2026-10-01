import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token  = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  const secret = process.env.ADMIN_SECRET_TOKEN;
  if (!secret || !token || token !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}