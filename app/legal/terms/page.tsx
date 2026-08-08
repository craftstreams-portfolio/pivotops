import { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Use",
  description: "Enterprise Terms of Use for PivotOps workforce operations platform.",
  path: "/legal/terms",
});

export default function TermsOfUsePage() {
  const updated = "22 June 2026";
  const effective = "1 January 2026";
  return (
    <div className="bg-zinc-950 text-white min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/80 mb-3">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Terms of Use</h1>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
            <span>Effective: {effective}</span>
            <span>Last updated: {updated}</span>
          </div>
        </div>

        <div className="prose prose-invert prose-zinc max-w-none space-y-10 text-zinc-300 leading-relaxed">

          <section>
            <p className="text-zinc-400 text-base">
              These Terms of Use (<strong className="text-white">"Terms"</strong>) govern your access to and use of the PivotOps platform, software, services, and website (collectively, the <strong className="text-white">"Service"</strong>), operated by <strong className="text-white">Craftstreams</strong> (<strong className="text-white">"Company"</strong>, <strong className="text-white">"we"</strong>, <strong className="text-white">"us"</strong>, or <strong className="text-white">"our"</strong>). By accessing or using the Service, you (<strong className="text-white">"Customer"</strong>, <strong className="text-white">"User"</strong>, or <strong className="text-white">"you"</strong>) agree to be bound by these Terms. If you do not agree, do not access or use the Service.
            </p>
          </section>

          {[
            {
              n: "1", title: "The Service",
              body: `PivotOps is a workforce operations platform that provides recruitment automation, candidate scoring, onboarding management, compliance document tracking, employee scheduling, team communication, and related workforce management tools. The Service is intended for use by businesses and their authorised employees and administrators.

Access to the Service is provided on a subscription basis. The specific features available to you depend on your subscription tier (Starter, Professional, or Enterprise) as described in the applicable Order Form or subscription confirmation.`
            },
            {
              n: "2", title: "Account Registration and Security",
              body: `You must create an account to use the Service. You agree to: (a) provide accurate, current, and complete information during registration; (b) maintain the security and confidentiality of your login credentials; (c) promptly notify us at support@pivotops.app of any unauthorised use of your account; and (d) accept responsibility for all activities that occur under your account.

We reserve the right to suspend or terminate accounts that provide false information or that we reasonably believe have been compromised. Each account is for a single organisation (a "Tenant"). You may not share your account credentials with third parties outside your organisation or use the Service to provide services to third parties without our prior written consent.`
            },
            {
              n: "3", title: "Authorised Use and Acceptable Use Policy",
              body: `You may use the Service only for lawful business purposes and in accordance with these Terms. You agree not to:

(a) Reverse engineer, decompile, disassemble, or attempt to derive the source code of the Service;
(b) Copy, reproduce, distribute, or create derivative works based on the Service or its content without our prior written consent;
(c) Use the Service to process data in violation of applicable data protection laws;
(d) Use automated scraping, crawling, or extraction tools on the Service;
(e) Introduce malware, viruses, or any other malicious code;
(f) Attempt to gain unauthorised access to any other tenant's data or to our systems;
(g) Use the Service to harass, defame, or discriminate against any individual;
(h) Violate any applicable local, national, or international law or regulation;
(i) Resell, sublicense, or otherwise make the Service available to third parties without our written authorisation.

We reserve the right to investigate suspected violations and to suspend or terminate access where violations are found.`
            },
            {
              n: "4", title: "Subscription, Billing, and Payment",
              body: `Access to the Service requires a paid subscription. Subscription fees are billed in advance on a monthly or annual basis as selected at checkout. All fees are stated in United States Dollars (USD) unless otherwise agreed in writing.

Fees are non-refundable except as expressly set out in these Terms or required by applicable law. We reserve the right to modify pricing with thirty (30) days' notice. Continued use of the Service after a price change constitutes acceptance of the new pricing.

If payment fails, we may suspend your access until payment is resolved. Accounts overdue by more than fourteen (14) days may be terminated. You are responsible for all taxes applicable to your subscription.

Annual subscriptions are billed at a 10% discount applied to the monthly rate and are non-cancellable mid-term except as described in Section 8.`
            },
            {
              n: "5", title: "Intellectual Property",
              body: `The Service, including all software, algorithms, user interfaces, visual design, text, graphics, and other content (collectively, "PivotOps IP"), is owned by Craftstreams and protected under United States and international intellectual property laws.

Copyright © 2024–2026 Craftstreams. All rights reserved. PivotOps is a trademark of Craftstreams. You may not use our name, logos, or trademarks without our prior written consent.

You retain all intellectual property rights in any data, content, or materials you upload to the Service ("Customer Data"). By uploading Customer Data, you grant us a limited, non-exclusive, worldwide licence to process and store that data solely to provide and improve the Service.

Any feedback, suggestions, or ideas you provide regarding the Service may be used by us without restriction and without compensation to you.`
            },
            {
              n: "6", title: "Data Ownership and Customer Data",
              body: `You own your Customer Data. We do not claim ownership of any data you input into the Service. We process Customer Data only as necessary to provide the Service and as described in our Privacy Policy.

You represent and warrant that: (a) you have all necessary rights to upload and process Customer Data through the Service; (b) Customer Data does not infringe the intellectual property rights of any third party; and (c) you have obtained all necessary consents required under applicable law to process personal data of candidates, employees, and other individuals whose data you input into the Service.

Upon termination of your subscription, we will make Customer Data available for export for thirty (30) days. After that period, we may delete Customer Data in accordance with our data retention policy.`
            },
            {
              n: "7", title: "Confidentiality",
              body: `Each party agrees to maintain the confidentiality of the other party's non-public business information disclosed in connection with these Terms. "Confidential Information" includes, without limitation, pricing, business plans, technical specifications, and Customer Data.

Neither party shall disclose Confidential Information to third parties without the prior written consent of the disclosing party, except: (a) to employees or contractors who need to know such information and are bound by confidentiality obligations no less restrictive than these Terms; (b) as required by law or legal process, provided the receiving party gives prompt notice to the disclosing party where legally permissible.

Our confidentiality obligations regarding Customer Data are further governed by our Privacy Policy.`
            },
            {
              n: "8", title: "Term and Termination",
              body: `These Terms remain in effect for the duration of your subscription. Either party may terminate for material breach if the breach is not cured within thirty (30) days of written notice.

You may cancel your monthly subscription at any time. Cancellation takes effect at the end of the current billing period. Annual subscriptions may be cancelled by providing written notice; no refund is provided for the remainder of the annual term.

We may terminate or suspend access to the Service immediately without notice if we determine that you have violated these Terms, that your use poses a security risk, or as required by law.

Upon termination: (a) your right to use the Service ceases immediately; (b) you must delete any locally cached copies of Service content; and (c) Sections 5, 7, 9, 10, and 11 survive termination.`
            },
            {
              n: "9", title: "Disclaimers and Limitation of Liability",
              body: `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

WE DO NOT WARRANT THAT: (A) THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE; (B) DEFECTS WILL BE CORRECTED; (C) THE SERVICE IS FREE FROM VIRUSES OR OTHER HARMFUL COMPONENTS; OR (D) RESULTS OBTAINED FROM THE SERVICE WILL BE ACCURATE OR RELIABLE.

TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE, REGARDLESS OF THE FORM OF ACTION, SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL FEES PAID BY YOU IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM; OR (B) ONE HUNDRED US DOLLARS (USD $100).

IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF REVENUE, PROFITS, DATA, GOODWILL, OR BUSINESS INTERRUPTION, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

Some jurisdictions do not allow the exclusion of certain warranties or limitation of certain damages. To the extent such laws apply, some of the above exclusions and limitations may not apply to you.`
            },
            {
              n: "10", title: "Indemnification",
              body: `You agree to defend, indemnify, and hold harmless Craftstreams and its officers, directors, employees, contractors, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law or regulation; (d) Customer Data that infringes the rights of any third party; or (e) any claim that your use of the Service caused harm to a third party.`
            },
            {
              n: "11", title: "Governing Law and Dispute Resolution",
              body: `These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.

Any dispute arising out of or relating to these Terms or the Service shall first be submitted to good-faith negotiation between the parties. If not resolved within thirty (30) days, disputes shall be submitted to binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules. The arbitration shall be conducted in English. The arbitral award shall be final and binding.

Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent irreparable harm.

Nothing in this section prevents you from filing a complaint with applicable consumer protection or data protection authorities.`
            },
            {
              n: "12", title: "Modifications to Terms",
              body: `We reserve the right to modify these Terms at any time. We will notify you of material changes by email or via an in-app notification at least thirty (30) days before they take effect. Your continued use of the Service after the effective date of revised Terms constitutes your acceptance of the changes.

If you do not agree to the revised Terms, you must stop using the Service and cancel your subscription before the effective date.`
            },
            {
              n: "13", title: "Miscellaneous",
              body: `Entire Agreement. These Terms, together with our Privacy Policy and any applicable Order Form, constitute the entire agreement between you and Craftstreams regarding the Service and supersede all prior agreements.

Severability. If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.

Waiver. Our failure to enforce any right or provision of these Terms will not be considered a waiver of that right or provision.

Assignment. You may not assign your rights or obligations under these Terms without our prior written consent. We may assign our rights and obligations to an affiliate or successor entity.

Force Majeure. Neither party shall be liable for delays or failures in performance resulting from causes beyond their reasonable control, including natural disasters, acts of government, or infrastructure outages.

Notices. Legal notices must be sent to legal@pivotops.app by email with confirmation of delivery, or by registered mail to Craftstreams, attention Legal Department.`
            },
            {
              n: "14", title: "Contact",
              body: `For questions about these Terms, please contact us at:

Craftstreams — PivotOps
Email: legal@pivotops.app
Support: support@pivotops.app
Website: https://www.pivotops.app`
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
              These Terms were last updated on {updated}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}