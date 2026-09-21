"use client";

import Image from "next/image";

export type XavierExpression = "friendly" | "thinking" | "analyzing" | "celebrating";

const XAVIER_FACES: Record<XavierExpression, string> = {
  friendly:    "/brand/xavier/xavier-friendly.png",
  thinking:    "/brand/xavier/xavier-thinking.png",
  analyzing:   "/brand/xavier/xavier-analyzing.png",
  celebrating: "/brand/xavier/xavier-celebrating.png",
};

const TEAL = "#00BFA6";

export default function XavierAvatar({
  size = 80,
  expression = "friendly",
  pulse = false,
  showStatus = true,
  ring = true,
}: {
  size?: number;
  expression?: XavierExpression;
  pulse?: boolean;
  showStatus?: boolean;
  ring?: boolean;
}) {
  const src = XAVIER_FACES[expression] ?? XAVIER_FACES.friendly;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {pulse && (
        <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: TEAL }} />
      )}
      <div
        className="w-full h-full rounded-full overflow-hidden"
        style={ring ? { boxShadow: `0 0 0 2px ${TEAL}, 0 8px 24px rgba(0,191,166,0.25)` } : undefined}
      >
        <Image src={src} alt="Xavier" width={size} height={size} className="w-full h-full object-cover" priority={size >= 64} />
      </div>
      {showStatus && (
        <div
          className="absolute bottom-0.5 right-0.5 rounded-full border-2"
          style={{ width: size * 0.16, height: size * 0.16, background: TEAL, borderColor: "#080810" }}
        />
      )}
    </div>
  );
}