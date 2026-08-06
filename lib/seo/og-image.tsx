import { ImageResponse } from "next/og";

/**
 * lib/seo/og-image.tsx
 *
 * Shared renderer for dynamic Open Graph preview images. Each route's
 * opengraph-image.tsx file calls this with its own title/subtitle rather
 * than duplicating the layout eight times. Uses next/og's ImageResponse
 * (Satori under the hood) - a constrained JSX/CSS subset, flexbox only,
 * system font fallback (no custom font loading, keeps this reliable).
 */

export const OG_SIZE = { width: 1200, height: 630 };

export function renderOgImage(title: string, subtitle?: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#06070D",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Triangle mark, top-left - simple two-stroke geometry matching
            the real PivotLogo, silver/chrome approximated with a flat
            light gray since Satori does not render gradients on strokes
            reliably. */}
        <svg width="64" height="56" viewBox="0 0 100 87" fill="none">
          <path d="M50 3L97 84H3L50 3Z" fill="none" stroke="#D0D0D0" strokeWidth="6" strokeLinejoin="round" />
          <path d="M50 24L80 75H20L50 24Z" fill="none" stroke="#8A8F9A" strokeWidth="3.5" strokeLinejoin="round" />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.15,
              maxWidth: "980px",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 26, color: "#00BFA6", fontWeight: 500 }}>
              {subtitle}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 20, color: "#8A8F9A", letterSpacing: 2, textTransform: "uppercase" }}>
            PivotOps · Autonomous Workforce OS
          </div>
          <div style={{ fontSize: 20, color: "#5A606B" }}>
            www.pivotops.app
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}