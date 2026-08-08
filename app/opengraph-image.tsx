import { renderOgImage, OG_SIZE } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "PivotOps — Autonomous Workforce OS";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderOgImage("PivotOps — Autonomous Workforce OS", "Automate hiring, onboarding, compliance, and team coordination");
}