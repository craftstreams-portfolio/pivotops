export const metadata = {
  title: "Privacy Policy — PivotOps for SHOPLINE",
  description: "How PivotOps collects, uses, and protects data when integrated with a SHOPLINE store.",
};

export default function ShoplinePrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-800">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-zinc-900">Privacy Policy — PivotOps for SHOPLINE</h1>
        <p className="text-sm text-zinc-500 mt-2">Last updated: 25 June 2026</p>

        <p className="mt-6 leading-relaxed">
          This Privacy Policy explains how PivotOps (operated by Craftstreams, &ldquo;PivotOps&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, stores, and protects information when a
          SHOPLINE merchant installs and uses the PivotOps application (&ldquo;the App&rdquo;). It applies
          to data accessed through SHOPLINE&rsquo;s APIs and to data merchants provide directly to PivotOps.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-10">1. Information we collect through SHOPLINE&rsquo;s APIs</h2>
        <p className="mt-3 leading-relaxed">
          With the merchant&rsquo;s explicit authorization granted during installation, the App may access:
        </p>
        <ul className="list-disc ml-6 mt-3 space-y-1.5">
          <li><strong>Order data</strong> &mdash; order counts, dates, and fulfillment-related volume used to generate staffing and scheduling recommendations.</li>
          <li><strong>Store staff / user accounts</strong> &mdash; staff names and roles used to sync into PivotOps onboarding and compliance tracking.</li>
          <li><strong>Store profile</strong> &mdash; store domain, store ID, and merchant ID used to identify and secure the connection.</li>
        </ul>
        <p className="mt-3 leading-relaxed">
          We request only the read permissions necessary to provide these features and do not request access
          beyond that scope.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-10">2. Information we collect from merchants</h2>
        <p className="mt-3 leading-relaxed">
          When a merchant creates a PivotOps account, we collect contact details (name, email), workspace
          configuration, and the workforce data the merchant chooses to manage in PivotOps (such as staff
          records, schedules, onboarding documents, and compliance credentials).
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-10">3. Information from a merchant&rsquo;s customers</h2>
        <p className="mt-3 leading-relaxed">
          PivotOps is a workforce-operations tool. We do not place cookies or tracking technologies on the
          devices of a merchant&rsquo;s store customers, and we do not collect store-customer personal data by
          default. If a SHOPLINE GDPR data-request or redaction webhook references a customer, we process it as
          described in Section 7.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-10">4. How we use information</h2>
        <p className="mt-3 leading-relaxed">
          We use the information solely to provide and improve the App&rsquo;s services: generating staffing and
          scheduling recommendations from store activity, syncing staff into onboarding and compliance, securing
          the connection, and providing customer support. We do not sell, rent, or trade data, and we do not use
          it for advertising or for purposes unrelated to the App&rsquo;s workforce-management function.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-10">5. Data retention</h2>
        <p className="mt-3 leading-relaxed">
          We retain store data only while the App is installed and for as long as needed to provide the service.
          When a merchant uninstalls the App, we revoke the stored access token and stop processing store data.
          Following SHOPLINE&rsquo;s shop-redaction webhook (sent after uninstall), we delete data associated with
          the store connection. Workforce data the merchant created in their PivotOps account is retained under
          the merchant&rsquo;s PivotOps account terms and is deleted when the merchant deletes their PivotOps account.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-10">6. Data location and security</h2>
        <p className="mt-3 leading-relaxed">
          Data is stored with our infrastructure providers (Supabase and Vercel) and may be processed outside the
          merchant&rsquo;s country, including outside the European Economic Area. We apply industry-standard
          safeguards including encryption in transit, access controls, tenant isolation enforced at the database
          level, and signed/verified webhooks. PivotOps does not currently operate an establishment in Europe.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-10">7. GDPR &amp; data subject requests</h2>
        <p className="mt-3 leading-relaxed">
          Regardless of where a merchant&rsquo;s customers are located, we honor SHOPLINE&rsquo;s mandatory data
          webhooks. On a customer data-request, we log and fulfill any data we hold that matches. On a customer
          redaction request, we delete matching records. On a shop redaction request, we delete data associated
          with the store connection. We respond to these requests within the periods required by applicable law.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-10">8. Contact us</h2>
        <p className="mt-3 leading-relaxed">
          If you have questions about this policy or wish to exercise a data right, contact us at{" "}
          <a href="mailto:privacy@pivotops.app" className="text-indigo-600 underline">privacy@pivotops.app</a>.
        </p>

        <p className="mt-10 text-sm text-zinc-500">PivotOps · Craftstreams · www.pivotops.app</p>
      </div>
    </main>
  );
}