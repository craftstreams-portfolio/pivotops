import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — PivotOps",
  description: "Refund and cancellation policy for PivotOps by Craftstreams.",
};

export default function RefundPolicyPage() {
  const updated = "23 June 2026";
  return (
    <div className="bg-zinc-950 text-white min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/80 mb-3">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Refund Policy</h1>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
            <span>Last updated: {updated}</span>
          </div>
        </div>

        <div className="space-y-10 text-zinc-300 leading-relaxed">

          <section>
            <p className="text-zinc-400 text-base">
              This Refund Policy applies to all subscriptions purchased through PivotOps, a product of{" "}
              <strong className="text-white">Craftstreams</strong>. By subscribing to PivotOps, you agree
              to the terms of this policy.
            </p>
          </section>

          {[
            {
              n: "1", title: "Subscription Billing",
              body: `PivotOps operates on a recurring subscription model billed monthly or annually depending on the plan selected at checkout. All subscription fees are charged in advance at the start of each billing period.

Payments are processed securely by Dodo Payments, our Merchant of Record, who handles all billing, tax collection, and payment processing on our behalf.`
            },
            {
              n: "2", title: "Free Trial",
              body: `New accounts receive a 7-day free trial with no payment required. You will not be charged until your trial period ends. You may cancel at any time during the trial period without incurring any charges.`
            },
            {
              n: "3", title: "Cancellation",
              body: `You may cancel your subscription at any time through your PivotOps dashboard under Settings > Billing, or by contacting us at billing@pivotops.app.

Upon cancellation:
- Your access to PivotOps continues until the end of your current billing period
- You will not be charged for the following billing period
- No partial refunds are issued for unused days within the current billing period
- Your data is retained for 30 days after cancellation and then permanently deleted

Annual subscribers who cancel mid-term will retain access until the end of their annual period. No prorated refunds are issued for annual subscriptions.`
            },
            {
              n: "4", title: "Refund Eligibility",
              body: `We offer refunds in the following circumstances:

(a) Duplicate charges: If you have been charged more than once for the same billing period due to a technical error, you are entitled to a full refund of the duplicate charge.

(b) Billing errors: If you were charged an incorrect amount due to a system error on our part, we will refund the difference promptly.

(c) 7-day new subscriber refund: If you are a first-time subscriber and request a refund within 7 days of your first payment, and you have not made substantial use of the platform (as determined at our reasonable discretion), we may issue a full refund of that payment at our discretion.

We do not offer refunds in the following circumstances:
- Change of mind after the 7-day new subscriber window
- Failure to cancel before a renewal date
- Partial use of a billing period
- Annual subscriptions after the 7-day window
- Accounts suspended for violations of our Terms of Use`
            },
            {
              n: "5", title: "How to Request a Refund",
              body: `To request a refund, please contact us at:

Email: billing@pivotops.app
Subject: Refund Request — [Your Organisation Name]

Include your registered email address, the reason for your refund request, and the transaction reference number if available. We will respond within 3 business days.

Approved refunds are processed through Dodo Payments and typically appear on your statement within 5-10 business days depending on your payment provider.`
            },
            {
              n: "6", title: "Chargebacks",
              body: `We ask that you contact us at billing@pivotops.app before initiating a chargeback with your bank or card provider. We are committed to resolving billing disputes fairly and promptly.

Initiating a chargeback without first contacting us may result in immediate suspension of your account pending resolution of the dispute.`
            },
            {
              n: "7", title: "Plan Changes",
              body: `If you upgrade your plan mid-billing period, the price difference is applied immediately and you are charged a prorated amount for the remainder of the period.

If you downgrade your plan, the change takes effect at the start of your next billing period. No refund is issued for the difference in the current period.`
            },
            {
              n: "8", title: "Contact",
              body: `For any billing or refund questions, please contact:

Email: billing@pivotops.app
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
              © 2024-2026 Craftstreams. PivotOps is a product of Craftstreams. All rights reserved.
              This Refund Policy was last updated on {updated}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}