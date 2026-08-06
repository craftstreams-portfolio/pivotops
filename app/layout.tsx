import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/app/components/Analytics";
import { buildMetadata } from "@/lib/seo/config";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "PivotOps — Autonomous Workforce OS",
    description: "Automate hiring, onboarding, compliance, and team coordination in one system.",
    path: "/",
  }),
  // Fields not covered by buildMetadata's page-level shape, set once here
  // at the root so every page inherits them.
  applicationName: "PivotOps",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PivotOps",
  },
  formatDetection: { telephone: false },
  generator: "Next.js",
  category: "Business Software",
};

export const viewport = {
  themeColor: "#06070D",
  width: "device-width",
  initialScale: 1,
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