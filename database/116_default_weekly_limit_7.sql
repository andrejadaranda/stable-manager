-- 116_default_weekly_limit_7.sql
-- Welfare-first default: a newly added horse is capped at 7 lessons per week
-- out of the box (owners can raise/lower per horse afterwards). Was 14.
-- App-side create defaults updated to match (services/horses.ts,
-- app/dashboard/horses/actions.ts, create-horse-form.tsx).
-- Existing horses are left untouched. Applied to live DB dluxzjphpokzkrwmmibe.
alter table horses alter column weekly_lesson_limit set default 7;
