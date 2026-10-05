import { renderOgImage, OG_SIZE } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Privacy Policy";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderOgImage("Privacy Policy", undefined);
}