"use client";

import { useState, type ReactNode } from "react";

/**
 * lib/ui/IconTooltip.tsx
 *
 * Small styled hover label for icon-only buttons. Native `title` attributes
 * are slow to appear and styled inconsistently across browsers - this shows
 * instantly, matches the app's dark theme, and positions below the icon.
 */
export function IconTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className="pointer-events-none absolute top-full mt-1.5 z-50 whitespace-nowrap
                     rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1
                     text-[11px] font-medium text-zinc-200 shadow-lg"
          role="tooltip"
        >
          {label}
        </div>
      )}
    </div>
  );
}