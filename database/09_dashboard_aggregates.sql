-- ============================================================================
-- 09_dashboard_aggregates.sql
--
-- Adds aggregate helpers used by the /dashboard home overview.
--
-- - clients_total_outstanding() : single-row scalar = sum of positive client
--   balances in the caller's stable. RLS-aware via current_stable_id().
--
-- These helpers exist to avoid N+1 RPCs from the dashboard. They are SAFE
-- to omit in a sandbox — the dashboard service falls back to 0 if the
-- function is missing, so apps boot without this migration.
--
-- Apply via Supabase Dashboard → SQL Editor.
-- ============================================================================

create or replace function clients_total_outstanding()
returns numeric
language sql
security invoker
stable
as $$
  -- For each client in the caller's stable, sum balances > 0.
  -- client_balance() is defined in 05_functions.sql:
  --   negative = client owes us; positive = client paid in advance / credit.
  -- We want "owed to stable" = sum of NEGATIVE balances, returned as positive.
  with bal as (
    select coalesce(client_balance(c.id), 0) as b
    from clients c
    where c.stable_id = current_stable_id()
      and c.active = true
  )
  select coalesce(sum(case when b < 0 then -b else 0 end), 0)::numeric
  from bal;
$$;

revoke all on function clients_total_outstanding() from public;
grant execute on function clients_total_outstanding() to authenticated;
