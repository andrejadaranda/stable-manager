-- 101_guardian_relation.sql
-- Parents of minor riders are NOT separate clients — their contact lives ON
-- the child (like an emergency contact). This adds the relation label so the
-- child profile can show whether the stored guardian is the mother, father,
-- or other guardian. Applied to live DB dluxzjphpokzkrwmmibe 2026-07-10.

alter table clients add column if not exists guardian_relation text
  check (guardian_relation is null or guardian_relation in ('mother','father','guardian'));

comment on column clients.guardian_relation is
  'For minor riders: whether the stored guardian_name/phone is the mother, father, or other guardian. Parent is NOT a separate client — this is contact data on the child.';
