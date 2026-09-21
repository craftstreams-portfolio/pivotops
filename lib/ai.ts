export async function runAIInterview(candidate: any) {
  // 🔥 Replace later with OpenAI / Claude
  const score = Math.floor(Math.random() * 20) + 80;

  let decision = "REJECT";
  if (score >= 85) decision = "STRONG_HIRE";
  else if (score >= 75) decision = "REVIEW";

  return {
    score,
    decision,
    summary: "Candidate shows strong communication and domain understanding.",
  };
}