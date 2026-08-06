import type { Metadata } from "next";
import ContactClient from "./ContactClient";
import { buildMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildMetadata({
  title: "Contact Us",
  description: "Questions about PivotOps, the SHOPLINE integration, billing, or support? Send us a message and we will get back to you.",
  path: "/contact",
});

export default function Page() {
  return <ContactClient />;
}