import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/app/components/Analytics";

export const metadata: Metadata = {
  title: "PivotOps — Autonomous Workforce OS",
  description: "Automate hiring, onboarding, compliance, and team coordination in one system.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}