import { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildMetadata({
  title: "Security",
  description: "How PivotOps protects your data: multi-tenant isolation, encryption, access control, and application security.",
  path: "/legal/security",
});

export default function SecurityPage() {
  const updated = "7 July 2026";
  return (
    <div className="bg-zinc-950 text-white min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/80 mb-3">Trust & Security</p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Security at PivotOps</h1>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
            <span>Last updated: {updated}</span>
          </div>
        </div>

        <div className="space-y-10 text-zinc-300 leading-relaxed">

          <section>
            <p className="text-zinc-400 text-base">
              PivotOps handles sensitive information — candidate records, compliance documents, and workforce data. Security is built into the foundation of the platform, not bolted on afterward. This page describes the controls and practices we use to protect your data, your candidates, and your business.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Data isolation (multi-tenancy)</h2>
            <p>
              PivotOps is a multi-tenant platform, and every organization&apos;s data is logically isolated from every other. We enforce this at the database level using Row-Level Security policies, so a request can only ever reach data belonging to the authenticated organization. Every query is scoped to the caller&apos;s tenant on the server — never based on values supplied by the browser.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Authentication &amp; access control</h2>
            <p>
              User sessions are cryptographically verified on every request. Access is role-based — organization owners, recruiters, and candidates each have distinct, enforced permission boundaries, and users cannot reach areas outside their role. Sensitive operations are authorized server-side, and administrative functions are protected by separate, dedicated credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Encryption</h2>
            <p>
              All traffic to and from PivotOps is encrypted in transit over HTTPS, with HTTP Strict Transport Security (HSTS) enforced. Data at rest is encrypted through our infrastructure providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Infrastructure</h2>
            <p>
              PivotOps is built on enterprise-grade, SOC 2-compliant infrastructure providers (Supabase and Vercel) for hosting and data storage. The underlying platform inherits robust physical security, network protection, and operational controls maintained by providers whose security posture is independently audited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Application security</h2>
            <p className="mb-3">Our application layer includes multiple defensive controls:</p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>Rate limiting on public and authenticated endpoints to prevent abuse</li>
              <li>Strict input validation on all incoming requests</li>
              <li>Security headers including Content Security Policy, HSTS, and content-type protection</li>
              <li>Audit logging of sensitive actions for accountability and traceability</li>
              <li>Ongoing dependency monitoring and prompt patching of known vulnerabilities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Compliance &amp; data handling</h2>
            <p>
              Compliance tracking is a core part of PivotOps. Candidate credentials and documents are stored securely, access is controlled and logged, and organizations retain oversight of their own data. We handle personal data with care and in line with applicable data protection principles. For details on how data is collected and used, see our{" "}
              <a href="/legal/privacy" className="text-emerald-400 hover:underline">Privacy Policy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Responsible disclosure</h2>
            <p>
              We welcome reports from security researchers. If you believe you have found a vulnerability in PivotOps, please contact us at{" "}
              <a href="mailto:inquiries@pivotops.app" className="text-emerald-400 hover:underline">inquiries@pivotops.app</a>{" "}
              and we will respond promptly. We ask that you give us a reasonable opportunity to address the issue before any public disclosure.
            </p>
          </section>

          <section className="pt-6 border-t border-zinc-800">
            <p className="text-sm text-zinc-500">
              Have questions about our security practices, or need documentation for a vendor security review? Reach out to{" "}
              <a href="mailto:inquiries@pivotops.app" className="text-emerald-400 hover:underline">inquiries@pivotops.app</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}