import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import {
  buildMetadata,
  organizationJsonLd,
  websiteJsonLd,
  softwareApplicationJsonLd,
} from "@/lib/seo/config";

export const metadata: Metadata = buildMetadata({
  title: "PivotOps — Autonomous Workforce OS",
  description:
    "Automate hiring, onboarding, compliance, and team coordination in one system. PivotOps replaces fragmented staffing tools with a single AI-powered workforce operations platform.",
  path: "/",
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }}
      />
      <HomeClient />
    </>
  );
}