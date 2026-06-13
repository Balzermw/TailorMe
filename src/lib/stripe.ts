import "server-only";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "@/lib/config";

/** Server-side Stripe client, or null when no secret key is configured. */
export const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" })
  : null;
