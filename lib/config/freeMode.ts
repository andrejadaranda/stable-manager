// =============================================================
// EARLY-ACCESS FREE MODE
//
// While FREE_MODE is true, all of Longrein is free: no subscription /
// trial gate, every feature unlocked for every stable and client. This
// is the deliberate go-to-market choice for the pre-traction phase —
// remove all friction, get the first stables on board, introduce pricing
// once there are paying-ready customers.
//
// To re-enable billing later: flip this to false and redeploy. All the
// billing code (Stripe, trial, rider-pro tiers) is left intact and simply
// becomes active again — nothing was removed.
//
// 2026-08-29: billing switched back ON (FREE_MODE = false). Every stable that
// existed at that moment was grandfathered to a lifetime-free comp (local
// subscriptions.status='active', period_end 2099, no Stripe row — so it never
// counts toward Stripe MRR). New stables created after this go through the
// normal 14-day trial + subscription gate. No founding offer.
// =============================================================
export const FREE_MODE = false;
