import { NextRequest, NextResponse } from "next/server";
import { getCandidateIntelligence } from "@/lib/workflow.intelligence";

export async function POST(req: NextRequest) {
  const { candidateId } = await req.json();

  if (!candidateId) {
    return NextResponse.json(
      { error: "candidateId required" },
      { status: 400 }
    );
  }

  const intelligence = await getCandidateIntelligence(candidateId);

  return NextResponse.json({
    success: true,
    candidateId,
    intelligence,
  });
}