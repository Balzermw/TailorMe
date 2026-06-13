// Credit packs + the human-review add-on. Shared by the buy-credits UI and
// the Stripe checkout route so amounts (computed server-side from id) and
// granted credits always agree. Mirrors PRICING in components/landing/data.ts.

export interface Pack {
  id: "starter" | "jobhunt" | "allin";
  name: string;
  credits: number;
  amountCents: number;
  per: string;
}

export const PACKS: Record<Pack["id"], Pack> = {
  starter: {
    id: "starter",
    name: "Starter",
    credits: 5,
    amountCents: 1900,
    per: "$3.80 each",
  },
  jobhunt: {
    id: "jobhunt",
    name: "Job hunt",
    credits: 15,
    amountCents: 4900,
    per: "$3.27 each",
  },
  allin: {
    id: "allin",
    name: "All in",
    credits: 40,
    amountCents: 9900,
    per: "$2.48 each",
  },
};

export const MICHAEL_ADDON_CENTS = 4900;

export function getPack(id: string): Pack | null {
  return (PACKS as Record<string, Pack>)[id] ?? null;
}

/** Map a pack display name (from PRICING) to its id. */
export function packIdByName(name: string): Pack["id"] {
  const found = Object.values(PACKS).find((p) => p.name === name);
  return found?.id ?? "jobhunt";
}
