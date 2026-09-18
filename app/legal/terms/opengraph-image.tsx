import { renderOgImage, OG_SIZE } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Terms of Use";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderOgImage("Terms of Use", undefined);
}