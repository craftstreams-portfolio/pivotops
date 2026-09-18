import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy - PivotOps for Shopify",
  description: "How PivotOps collects, uses, and protects data when integrated with a Shopify store.",
  path: "/legal/shopify-privacy",
});

export default function ShopifyPrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-800">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-zinc-900">Privacy Policy - PivotOps for Shopify</h1>
        <p className="text-sm text-zinc-500 mt-2">Last updated: 12 August 2026</p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-10">Who we are</h2>
        <p className="mt-2 leading-relaxed">
          PivotOps is a workforce operations platform operated by Craftstreams Nigeria Limited.
          This policy explains what data the PivotOps app accesses when installed on a Shopify
          store, why we access it, and how it is handled.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-8">What we access</h2>
        <p className="mt-2 leading-relaxed">
          PivotOps requests the <strong>read_locations</strong> scope only. We read your store&apos;s
          location records to support multi-location workforce scheduling and staffing coverage
          inside PivotOps.
        </p>
        <p className="mt-3 leading-relaxed">
          PivotOps is a workforce-operations tool. We do not request access to your store
          customers&apos; personal data, we do not read order contents or customer records, and we do
          not place cookies or tracking technologies on your storefront or on your customers&apos;
          devices.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-8">What we store</h2>
        <ul className="mt-2 space-y-2 list-disc pl-5 leading-relaxed">
          <li><strong>Store identifier</strong> - your myshopify.com domain, used to link the installation to your PivotOps workspace.</li>
          <li><strong>Access token</strong> - the OAuth token issued by Shopify at install, stored securely in an access-controlled database and used only to make authorized API calls on your behalf.</li>
          <li><strong>Location data</strong> - store location records retrieved under the read_locations scope.</li>
          <li><strong>Your PivotOps account data</strong> - the workspace, user accounts, and workforce records you create inside PivotOps itself.</li>
        </ul>

        <h2 className="text-xl font-semibold text-zinc-900 mt-8">Data retention and deletion</h2>
        <p className="mt-2 leading-relaxed">
          PivotOps implements Shopify&apos;s mandatory compliance webhooks. When you uninstall the
          app, Shopify notifies us and we revoke and delete the stored access token for your
          store. On receipt of a shop data erasure request, we revoke and delete the stored access
          token and mark the installation as removed.
        </p>
        <p className="mt-3 leading-relaxed">
          Workforce data you created inside PivotOps belongs to your PivotOps account and is
          retained under your PivotOps account terms. It is not deleted automatically by
          uninstalling the Shopify app - to delete it, delete your PivotOps workspace or contact
          us at the address below.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-8">Data sharing</h2>
        <p className="mt-2 leading-relaxed">
          We do not sell your data. We share data only with infrastructure providers required to
          operate the service (hosting, database, and email delivery), each acting as a processor
          under contract.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-8">Security</h2>
        <p className="mt-2 leading-relaxed">
          PivotOps is multi-tenant with row-level isolation between workspaces. Access tokens are
          stored in an access-controlled database, all traffic is served over HTTPS, and webhook requests from Shopify are
          verified using HMAC signature validation before being processed.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-8">Your rights</h2>
        <p className="mt-2 leading-relaxed">
          You may request access to, correction of, or deletion of your data at any time by
          contacting us. We respond to verified requests within the timeframes required by
          applicable data protection law.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 mt-8">Contact</h2>
        <p className="mt-2 leading-relaxed">
          Craftstreams Nigeria Limited<br />
          Email: <a href="mailto:inquiries@pivotops.app" className="text-indigo-600 hover:underline">inquiries@pivotops.app</a><br />
          Web: <a href="https://www.pivotops.app" className="text-indigo-600 hover:underline">www.pivotops.app</a>
        </p>
      </div>
    </main>
  );
}