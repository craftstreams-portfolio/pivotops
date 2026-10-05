"use client";

import { ResponsiveContainer } from "recharts";
import { ReactNode } from "react";

export default function SafeResponsiveChart({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={0}
      minHeight={0}
    >
      {children}
    </ResponsiveContainer>
  );
}