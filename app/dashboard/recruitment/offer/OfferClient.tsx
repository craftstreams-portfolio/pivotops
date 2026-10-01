"use client";

import { useSearchParams } from "next/navigation";

export default function OfferClient() {
  const params = useSearchParams();

  const offerId = params.get("offerId");
  const action = params.get("action");
  const candidateId = params.get("candidateId");

  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl font-bold">Offer Response</h1>

      <p>Offer ID: {offerId}</p>
      <p>Action: {action}</p>
      <p>Candidate ID: {candidateId}</p>
    </div>
  );
}
