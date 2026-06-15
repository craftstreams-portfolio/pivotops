import "./globals.css";

import type { Metadata } from "next";


import { startWorkers } from "../lib/workers/start-workers";

// ===============================
// FONT
// ===============================

// ===============================
// SAFE WORKER BOOT
// ===============================
if (
  typeof window === "undefined" &&
  process.env.NODE_ENV !== "test"
) {
  startWorkers().catch(
    (err: unknown) => {
      console.error(
        "🔥 Worker startup failed:",
        err
      );
    }
  );
}

// ===============================
// METADATA
// ===============================
export const metadata: Metadata = {
  title: "PivotOps",

  description:
    "Enterprise Workforce OS",
};

// ===============================
// ROOT LAYOUT
// ===============================
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={
          "font-sans"
        }
      >
        {children}
      </body>
    </html>
  );
}
