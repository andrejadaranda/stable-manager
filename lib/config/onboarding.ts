// =============================================================
// DIGITAL ONBOARDING FEATURE FLAG
//
// While ONBOARDING_ENABLED is false, the whole client digital-onboarding
// flow is hidden:
//   - the "Send onboarding invitation" button disappears from the client
//     profile;
//   - the public /onboarding/[token] route returns 404;
//   - the submit server action refuses.
//
// Nothing is removed: the code and the DB columns (migrations 90-91) stay
// intact. Flip this to true and redeploy to bring the feature back exactly
// as it was. Parked 2026-06-24 while deciding whether client onboarding
// belongs inside Longrein (generalised, stable-configurable) or on the
// club's own site (tjk.lt).
// =============================================================
export const ONBOARDING_ENABLED = false;
