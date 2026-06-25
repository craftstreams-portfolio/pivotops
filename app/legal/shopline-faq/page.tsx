export const metadata = {
  title: "FAQ — PivotOps for SHOPLINE",
  description: "Frequently asked questions about installing and using PivotOps with your SHOPLINE store.",
};

const faqs = [
  {
    q: "What does PivotOps do for my SHOPLINE store?",
    a: "PivotOps manages your workforce using your live store activity. It reads your order volume to recommend staffing and shift coverage, and syncs your store staff into onboarding and compliance tracking \u2014 so your team size matches real demand.",
  },
  {
    q: "How do I install and connect PivotOps?",
    a: "Install PivotOps from the SHOPLINE App Store. You will be taken to a secure SHOPLINE authorization page where you approve the read permissions PivotOps needs. After you approve, you are redirected into PivotOps to finish setting up your workspace.",
  },
  {
    q: "What permissions does PivotOps request, and why?",
    a: "PivotOps requests read access to your orders (to calculate staffing needs from demand) and to your store staff/users (to sync them into onboarding and compliance). We request only what is needed to provide these features and never request write access we do not use.",
  },
  {
    q: "Does PivotOps access my customers' personal data?",
    a: "No. PivotOps is a workforce-operations tool. We do not collect your store customers' personal data by default and we do not place tracking technologies on their devices. We use order volume and staff data only.",
  },
  {
    q: "How is my data protected?",
    a: "Data is encrypted in transit, isolated per merchant at the database level, and all SHOPLINE webhooks are cryptographically signed and verified. See our Privacy Policy for full details on collection, use, storage, and retention.",
  },
  {
    q: "What happens to my data if I uninstall PivotOps?",
    a: "When you uninstall, PivotOps revokes its stored access token and stops processing your store data. Following SHOPLINE's shop-redaction webhook, we delete data associated with the store connection. Workforce data you created in your PivotOps account is removed when you delete your PivotOps account.",
  },
  {
    q: "How is PivotOps priced?",
    a: "PivotOps offers Starter, Professional, and Enterprise plans, billed monthly or annually (annual saves 10%). Each plan unlocks more recruiter seats and features such as compliance and analytics. You can view current pricing inside the app and change or cancel your plan at any time from Settings \u2192 Billing.",
  },
  {
    q: "How do I cancel my subscription and what is the refund policy?",
    a: "You can cancel anytime from Settings \u2192 Billing; access continues until the end of your current billing period. Refunds are handled per our Refund Policy, available in the app and on our website.",
  },
  {
    q: "How do I get support?",
    a: "Email us at support@pivotops.app. We respond to setup and integration questions and provide guidance on connecting PivotOps with your SHOPLINE store.",
  },
];

export default function ShoplineFaqPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-800">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-zinc-900">Frequently Asked Questions</h1>
        <p className="text-zinc-500 mt-2">PivotOps for SHOPLINE</p>

        <div className="mt-10 space-y-8">
          {faqs.map((f, i) => (
            <div key={i} className="border-b border-zinc-200 pb-6">
              <h2 className="text-lg font-semibold text-zinc-900">{f.q}</h2>
              <p className="mt-2 leading-relaxed text-zinc-700">{f.a}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-zinc-500">
          Still need help? Email{" "}
          <a href="mailto:support@pivotops.app" className="text-indigo-600 underline">support@pivotops.app</a>.
        </p>
      </div>
    </main>
  );
}