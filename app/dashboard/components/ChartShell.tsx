"use client";

import { ReactNode } from "react";

type Props = {
  title?: string;
  subtitle?: string;
  height?: number;
  children: ReactNode;
};

export default function ChartShell({
  title,
  subtitle,
  height = 320,
  children,
}: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full">
      
      {/* HEADER */}
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-xl font-semibold">{title}</h2>
          )}
          {subtitle && (
            <p className="text-sm text-zinc-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* CRITICAL FIX: stable layout container */}
      <div
        style={{
          height: `${height}px`,
          width: "100%",
          minHeight: `${height}px`,
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}