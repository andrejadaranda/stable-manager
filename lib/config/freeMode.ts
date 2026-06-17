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
// =============================================================
export const FREE_MODE = true;
