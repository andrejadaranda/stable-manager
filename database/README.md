# Longrein database — migration order & operator notes

Migrations are plain SQL files applied in **filename sort order** via Supabase
SQL Editor (or `supabase db push` if you're using the CLI). There is no
migration runner; the operator is the runner.

## Canonical apply order

1. `install.sql` (bundles **01 → 08**: extensions, schema, helpers, policies,
   functions, auth RPCs, calendar policies, clients skill level).
2. `08b_dashboard_aggregates.sql` — single helper function for the dashboard
   overview. Was previously `09_dashboard_aggregates.sql` and clashed with
   `09_chat_schema.sql` on filename prefix; renamed to `08b_` to remove the
   ambiguity. **Safe to skip** — the dashboard service falls back to 0 if the
   function is missing.
3. `09_chat_schema.sql` → `27_client_charges.sql` — applied one at a time in
   numeric order.
4. `APPLY_ALL_PENDING.sql` — bundles **28 → 33** (audit log, features +
   onboarded_at, emergency contacts, waitlist signups, subscription
   scaffolding, lesson series) inside a single `BEGIN … COMMIT` block. **Use
   this**, not the individual 28–33 files, when applying for the first time.
5. `34_horse_depth_and_defaults.sql`, `35_nullable_horse.sql`.
6. **`36_billing_schema_consolidation.sql`** — resolves the migration 16 + 32
   billing schema split-brain. Idempotent. **Required before any Stripe code
   is wired live.** See header comment in the file for what it does.

## Canonical billing schema (post-36)

- `stables.plan` — `stable_plan` enum (`trial | starter | pro | premium | cancelled`). Mirrors `subscriptions.plan` for fast UI reads.
- `stables.trial_ends_at` — `timestamptz`. Canonical trial-end. The gating helper reads this.
- `stables.stripe_customer_id` — `text unique`. Set on first checkout.
- `subscriptions` (1:1 with stables) — canonical billing record. Stripe webhook writes here as `service_role`.

**Removed by migration 36:** `stables.current_plan` (text), `stables.trial_end_at` (timestamptz), `stables.subscription_status` (text). Do not re-add. Do not introduce a third spelling. There is one plan column, one trial-end column, one status column (on `subscriptions`).

## Feature flags

`stables.features` (jsonb, default-all-true at migration 29). Default values
are intentionally bool-true so a partial migration doesn't blank-screen a
running stable. **The application's `DEFAULT_FEATURES` constant in
`services/features.ts` is the source of truth for "what gets enabled at
signup for a NEW stable."** See migration 37 (default-off cleanup) for the
launch-time defaults.

## Operator quick checks after applying 36

```sql
-- Should return exactly: plan | trial_ends_at | stripe_customer_id
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'stables'
   and column_name in ('plan','trial_ends_at','stripe_customer_id',
                       'current_plan','trial_end_at','subscription_status');

-- One row per stable, canonical enum spellings.
select stable_id, plan, status from subscriptions order by created_at limit 10;
```

## Prefix collision history

`09_dashboard_aggregates.sql` and `09_chat_schema.sql` shared the `09_`
prefix. On filename sort order this was ambiguous and a fresh-DB apply could
silently run them in either order. Renamed the smaller helper file to
`08b_dashboard_aggregates.sql` to enforce a deterministic, intent-aligned
order. Neither file depends on the other.
