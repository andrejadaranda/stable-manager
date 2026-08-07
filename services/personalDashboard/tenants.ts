// Telling real Longrein customers apart from test data.
//
// WHY THIS EXISTS
// The Longrein screen reported "7 arklidės, 14 vartotojų". The truth was
// two external customers. The other five were: a `test@test.com` stable
// from the first week, two of her own throwaway signups, a seeded demo
// stable owned by `demo.owner@longrein.eu`, and her own club.
//
// A growth number that counts your own test accounts is worse than no
// growth number, because it feels like evidence. This dashboard's whole
// premise is that a comforting false number is the thing to avoid, and
// this was the biggest one on it.
//
// WHY A RULE, NOT A LIST
// An explicit list of excluded ids would be correct today and wrong the
// next time something is created for testing — and nobody remembers to
// update a list. Classification by owner email is self-maintaining: the
// next `@longrein.eu` demo account is excluded the moment it appears,
// with no code change and nothing to remember.
//
// The manual override exists for the cases a rule cannot know about (a
// friend who signed up to help test with their own real address).

export type TenantKind = "customer" | "own" | "internal";

export type ClassifiedStable = {
  id: string;
  name: string;
  createdAt: string;
  ownerEmail: string | null;
  kind: TenantKind;
};

/** Domains that are never a paying customer. */
const INTERNAL_DOMAINS = ["longrein.eu", "test.com", "example.com"];

/**
 * Classify one stable.
 *
 * `operatorEmail` is her own login; `ownStableId` is the club she
 * actually runs. Those are different things — she also created signups
 * from other addresses while testing — so both are checked.
 */
export function classifyStable(input: {
  id: string;
  name: string;
  createdAt: string;
  ownerEmail: string | null;
  operatorEmail: string;
  ownStableId: string | null;
  /** Ids she has manually marked as not-a-customer. */
  excludedIds?: string[];
}): ClassifiedStable {
  const base = {
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    ownerEmail: input.ownerEmail,
  };

  if (input.ownStableId && input.id === input.ownStableId) {
    return { ...base, kind: "own" };
  }
  if (input.excludedIds?.includes(input.id)) {
    return { ...base, kind: "internal" };
  }

  const email = (input.ownerEmail ?? "").toLowerCase().trim();
  if (!email) {
    // A stable with no owner is a broken signup, not a customer.
    return { ...base, kind: "internal" };
  }

  const [localRaw, domain = ""] = email.split("@");
  // Strip +aliases: darandaandreja+lt1@icloud.com is still her.
  const local = localRaw.split("+")[0];

  if (INTERNAL_DOMAINS.includes(domain)) return { ...base, kind: "internal" };
  if (local === "test" || local.startsWith("test.")) return { ...base, kind: "internal" };

  // Same person, any domain. She used both icloud and gmail while
  // testing, so matching the local part alone is deliberate — the
  // alternative is her own throwaway signups counting as growth.
  const operatorLocal = input.operatorEmail.toLowerCase().split("@")[0].split("+")[0];
  if (operatorLocal && local === operatorLocal) return { ...base, kind: "internal" };

  return { ...base, kind: "customer" };
}

export type TenantBreakdown = {
  /** Real, external, paying-or-could-pay stables. The growth number. */
  customers: number;
  /** Her own club. */
  own: number;
  /** Test and demo accounts. */
  internal: number;
  /** Everything, i.e. what the old card used to show. */
  total: number;
};

export function summarise(stables: ClassifiedStable[]): TenantBreakdown {
  return {
    customers: stables.filter((s) => s.kind === "customer").length,
    own: stables.filter((s) => s.kind === "own").length,
    internal: stables.filter((s) => s.kind === "internal").length,
    total: stables.length,
  };
}

/** Customers created within a window, for the growth deltas. */
export function customersCreatedBetween(
  stables: ClassifiedStable[],
  fromISO: string,
  toISO: string,
): number {
  return stables.filter(
    (s) => s.kind === "customer" && s.createdAt >= fromISO && s.createdAt < toISO,
  ).length;
}
