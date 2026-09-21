import { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: "Privacy Policy for PivotOps workforce operations platform by Craftstreams.",
  path: "/legal/privacy",
});

export default function PrivacyPolicyPage() {
  const updated = "22 June 2026";
  const effective = "1 January 2026";
  return (
    <div className="bg-zinc-950 text-white min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/80 mb-3">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
            <span>Effective: {effective}</span>
            <span>Last updated: {updated}</span>
          </div>
        </div>

        <div className="space-y-10 text-zinc-300 leading-relaxed">

          <section>
            <p className="text-zinc-400 text-base">
              This Privacy Policy describes how <strong className="text-white">Craftstreams</strong> ("Company", "we", "us", or "our") collects, uses, stores, and protects information when you use the <strong className="text-white">PivotOps</strong> platform and services (the "Service"). By using the Service, you agree to the collection and use of information in accordance with this Policy.
            </p>
          </section>

          {[
            {
              n: "1", title: "Who We Are and Scope",
              body: `Craftstreams is the data controller for information collected through PivotOps. Craftstreams is established in Lagos, Nigeria. Our platform and data are hosted by our infrastructure providers (Supabase and Vercel) in the United States and other global regions.

This Policy applies to:
- Business customers and their administrators ("Customers") who subscribe to PivotOps;
- Employees and team members whose data is managed through the Service on behalf of a Customer;
- Job candidates who apply through a Customer's PivotOps-powered portal;
- Visitors to www.pivotops.app.

If you are a candidate or employee whose data is processed by a Customer, you should also review that Customer's own privacy policy, as they act as the data controller for your personal data within their use of PivotOps.`
            },
            {
              n: "2", title: "Information We Collect",
              body: `We collect the following categories of information:

Account and Business Information
- Business name, billing address, and contact details provided during registration
- Administrator name, email address, and login credentials
- Subscription tier, billing history, and payment method metadata (we do not store full card numbers)
- Communications with our support team

Workforce and Candidate Data (processed on behalf of Customers)
- Employee profiles: name, email, phone number, department, job title, location, work schedule, and clock in/out records
- Candidate information: name, email, phone, resume content, LinkedIn profile, cover letter, application responses, AI scoring data, and hiring decisions
- Compliance documents uploaded through the portal (may include identity documents, certifications, and health records depending on Customer configuration)
- SSN last-4 digits (where provided by a candidate voluntarily)
- Onboarding records and task completion data

Usage and Technical Data
- IP address, browser type, device identifiers, and operating system
- Pages visited, features used, session duration, and interaction logs
- Error logs and performance data used to maintain and improve the Service
- Cookies and similar tracking technologies (see Section 7)`
            },
            {
              n: "3", title: "How We Use Information",
              body: `We use collected information to:

Service Delivery
- Provide, operate, and maintain the Service
- Process applications, score candidates, and route decisions on behalf of Customers
- Manage employee onboarding, compliance tracking, and workforce coordination
- Send service notifications, alerts, and communication through the in-app messaging system

Billing and Administration
- Process subscription payments and manage billing
- Send invoices, receipts, and account notifications
- Respond to support requests and account inquiries

Security and Compliance
- Detect, prevent, and investigate fraud, abuse, and security incidents
- Maintain audit logs and access controls
- Comply with legal obligations, court orders, and regulatory requirements

Product Improvement
- Analyse aggregated, anonymised usage patterns to improve the platform
- Conduct internal research and development
- We do not use Customer Data or candidate data to train AI models without explicit consent

Marketing (limited)
- Send product updates and relevant communications to subscribed Customers
- You may opt out of marketing communications at any time via the unsubscribe link`
            },
            {
              n: "4", title: "Legal Basis for Processing (EEA/UK Customers)",
              body: `For customers in the European Economic Area or United Kingdom, we process personal data on the following legal bases:

- Contract performance: processing necessary to deliver the subscribed Service
- Legitimate interests: security monitoring, fraud prevention, product improvement, and customer communications where these do not override your rights
- Legal obligation: compliance with applicable laws and regulatory requirements
- Consent: where you have provided explicit consent, such as for marketing communications or optional data collection

You have the right to withdraw consent at any time without affecting the lawfulness of processing prior to withdrawal.`
            },
            {
              n: "5", title: "Data Sharing and Disclosure",
              body: `We do not sell, rent, or trade personal data. We share information only in the following circumstances:

Service Providers
We share data with third-party vendors who assist in operating the Service, including:
- Supabase Inc. — database hosting and authentication
- Resend Inc. — transactional email delivery
- Vercel Inc. — platform hosting and infrastructure

All service providers are contractually bound to process data only on our instructions and to maintain appropriate security standards.

Customers and Their Administrators
Within a Customer's account, administrators have access to data relating to their organisation's employees and candidates. We do not share data between different Customer organisations (tenants).

Legal Requirements
We may disclose information if required by law, subpoena, or government request, or where we reasonably believe disclosure is necessary to protect our rights, protect your safety or the safety of others, or investigate fraud.

Business Transfers
In the event of a merger, acquisition, or sale of all or substantially all of our assets, Customer Data may be transferred to the acquiring entity, subject to the same privacy obligations.

We will never disclose sensitive health, identity, or compliance documents to third parties outside the above circumstances.`
            },
            {
              n: "6", title: "Data Security",
              body: `We implement industry-standard technical and organisational measures to protect your data, including:

- Encryption of data in transit using TLS 1.2 or higher
- Encryption of sensitive data at rest
- Row-level security (RLS) ensuring strict tenant data isolation — no Customer can access another Customer's data
- Role-based access controls within Customer organisations
- Audit logging of all administrative actions and data access
- Regular security reviews and vulnerability assessments

Despite these measures, no method of transmission over the internet or method of electronic storage is 100% secure. We cannot guarantee absolute security, but we commit to promptly notifying affected Customers of any confirmed data breach in accordance with applicable law.

All compliance documents uploaded through the candidate portal are stored in access-controlled storage and are accessible only to authorised compliance officers within the relevant Customer organisation.`
            },
            {
              n: "7", title: "Cookies and Tracking",
              body: `We use cookies and similar technologies on www.pivotops.app to:

- Maintain your login session (strictly necessary)
- Remember your preferences
- Analyse site traffic using anonymised analytics

Essential cookies cannot be disabled as they are required for the Service to function. You may control non-essential cookies through your browser settings. A cookie preference banner is displayed on your first visit to our marketing site.

We do not use third-party advertising cookies or behavioural tracking for advertising purposes.`
            },
            {
              n: "8", title: "Data Retention",
              body: `We retain data for the following periods:

- Active Customer Data: retained for the duration of the subscription plus a 30-day grace period post-termination, during which data is available for export
- Post-export: Customer Data is deleted within 90 days of subscription termination
- Billing and financial records: retained for 7 years as required by applicable accounting and tax laws
- Security and audit logs: retained for 12 months
- Anonymised usage analytics: retained indefinitely in aggregated, non-identifiable form

Candidates who withdraw their consent for data processing or request erasure will have their personal data deleted within 30 days, except where retention is required by law or legitimate business interest (e.g., to comply with employment law record-keeping requirements).`
            },
            {
              n: "9", title: "Your Rights",
              body: `Depending on your location, you may have the following rights regarding your personal data:

- Access: request a copy of the personal data we hold about you
- Rectification: request correction of inaccurate or incomplete data
- Erasure: request deletion of your data ("right to be forgotten") where no overriding legal basis applies
- Portability: receive your data in a structured, machine-readable format
- Restriction: request that we restrict processing of your data in certain circumstances
- Objection: object to processing based on legitimate interests
- Withdrawal of consent: withdraw consent where processing is based on consent

To exercise any of these rights, please contact us at privacy@pivotops.app. We will respond within 30 days. Where you are a candidate or employee whose data is processed by a Customer, please contact that Customer directly as they are the data controller for your data within their system.

If you are located in California, you may have additional rights under the California Consumer Privacy Act (CCPA), including the right to know, delete, and opt out of the sale of personal information (we do not sell personal information).`
            },
            {
              n: "10", title: "International Data Transfers",
              body: `Craftstreams is established in Nigeria, and our data is hosted by our infrastructure providers (Supabase and Vercel) in the United States and other global regions. If you are located in the European Economic Area, the United Kingdom, or another jurisdiction with data transfer restrictions, your data may be transferred to and processed in the United States and other countries.

For EEA and UK transfers, we rely on Standard Contractual Clauses (SCCs) approved by the European Commission and the UK Information Commissioner's Office, as applicable, to ensure adequate protection of personal data.

By using the Service, you acknowledge that your data will be transferred to and processed in the United States and other countries in accordance with this Policy.`
            },
            {
              n: "11", title: "Children's Privacy",
              body: `The Service is not directed at individuals under the age of 18. We do not knowingly collect personal data from minors. If we become aware that we have inadvertently collected personal data from a child under 18, we will delete it promptly. If you believe we may have collected data from a minor, please contact us at privacy@pivotops.app.`
            },
            {
              n: "12", title: "Changes to This Policy",
              body: `We may update this Privacy Policy from time to time. We will notify Customers of material changes via email or in-app notification at least 30 days before changes take effect. The updated Policy will be posted at www.pivotops.app/legal/privacy with a revised "Last updated" date.

Your continued use of the Service after the effective date of any changes constitutes your acceptance of the updated Policy.`
            },
            {
              n: "13", title: "Contact and Data Protection Officer",
              body: `For privacy-related questions, complaints, or to exercise your data rights, please contact:

Privacy Team — Craftstreams (PivotOps)
Email: privacy@pivotops.app
General: support@pivotops.app
Website: https://www.pivotops.app

If you are located in the EEA or UK and believe we have not adequately addressed your privacy concerns, you have the right to lodge a complaint with your local supervisory authority (e.g., the UK Information Commissioner's Office or a relevant EU Data Protection Authority).`
            },
          ].map(({ n, title, body }) => (
            <section key={n} className="border-t border-zinc-800 pt-8">
              <h2 className="text-xl font-bold text-white mb-4">{n}. {title}</h2>
              {body.split("\n\n").map((para, i) => (
                <p key={i} className="text-zinc-400 leading-relaxed mb-3 last:mb-0 whitespace-pre-line">{para}</p>
              ))}
            </section>
          ))}

          <section className="border-t border-zinc-800 pt-8 mt-10">
            <p className="text-zinc-600 text-sm">
              © 2024–2026 Craftstreams. PivotOps is a product of Craftstreams. All rights reserved.
              This Privacy Policy was last updated on {updated}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}