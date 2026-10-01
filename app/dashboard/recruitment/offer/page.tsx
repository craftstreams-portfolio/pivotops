import { Suspense } from "react";
import OfferClient from "./OfferClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading offer...</div>}>
      <OfferClient />
    </Suspense>
  );
}
