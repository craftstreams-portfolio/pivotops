import DodoPayments from "dodopayments";
import { DODO_CONFIG } from "./config";

/** Singleton Dodo Payments client (server-side only). */
export const dodo = new DodoPayments({
  bearerToken: DODO_CONFIG.apiKey,
  environment: DODO_CONFIG.environment, // "test_mode" | "live_mode"
});