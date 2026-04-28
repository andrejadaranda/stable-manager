# RLS Smoke Test — Sessions

10-minute manual test. Run **before** showing the product to a real customer. Catches the one mistake that ends a SaaS: a tenant seeing another tenant's data.

## Setup (one time)

In your Supabase project, create three test users via the Auth dashboard:

| Email | Password | Will become |
|---|---|---|
| `owner-a@test.local` | (any) | Owner of Stable A |
| `client-a@test.local` | (any) | Client at Stable A |
| `owner-b@test.local` | (any) | Owner of Stable B |

Then in the SQL Editor, set up two stables and link the users:

```sql
-- Stable A
insert into stables (name) values ('Test Stable A') returning id;
-- copy the id, call it $A

insert into profiles (auth_user_id, stable_id, role, full_name)
values
  ((select id from auth.users where email = 'owner-a@test.local'),  '$A', 'owner',  'Owner A'),
  ((select id from auth.users where email = 'client-a@test.local'), '$A', 'client', 'Client A');

-- Make Client A an actual client row + link
insert into clients (stable_id, profile_id, full_name)
values ('$A',
  (select id from profiles where auth_user_id = (select id from auth.users where email = 'client-a@test.local')),
  'Client A');

-- A horse for Stable A
insert into horses (stable_id, name) values ('$A', 'Test Horse A');

-- Stable B
insert into stables (name) values ('Test Stable B') returning id;
-- copy the id, call it $B

insert into profiles (auth_user_id, stable_id, role, full_name)
values
  ((select id from auth.users where email = 'owner-b@test.local'), '$B', 'owner', 'Owner B');

insert into horses (stable_id, name) values ('$B', 'Test Horse B');
```

## Test cases

### 1. Tenant isolation
1. Sign in as `owner-a@test.local` → `/dashboard/horses`. Expect: see "Test Horse A". Do NOT see "Test Horse B".
2. Sign in as `owner-b@test.local` → `/dashboard/horses`. Expect: see "Test Horse B". Do NOT see "Test Horse A".

**Fails ⇒ RLS broken on horses.** Check `04_policies.sql`.

### 2. Sessions writable by staff
1. Sign in as `owner-a@test.local` → `/dashboard/sessions`.
2. Pick "Test Horse A", set rider = "Client A", duration = 30, type = flat. Submit.
3. Expect: row appears in the recent feed.

**Fails with RLS error ⇒** check `13_sessions_policies.sql`, especially `sessions_write_staff`.

### 3. Client sees own session
1. Sign in as `client-a@test.local` → `/dashboard/my-sessions`.
2. Expect: see exactly one session, the one Owner A just logged.

**Fails ⇒** check `sessions_read_own_client` policy. Also confirm `clients.profile_id` is set so `current_client_id()` resolves.

### 4. Client does NOT see other clients' sessions
1. Still signed in as `client-a@test.local`.
2. Open the URL `/dashboard/sessions` directly. Expect: redirect to `/dashboard` (clients are blocked by `requirePageRole("owner","employee")`).

**Fails (page renders) ⇒** the page-level role gate is missing.

### 5. Cross-tenant write attempt
1. Sign in as `owner-b@test.local`.
2. Open Supabase Studio → Table Editor → `sessions` → Insert row. Set `stable_id` to **Stable A's id** (you wrote it down above), `horse_id` to Horse A's id.
3. Expect: insert fails with policy violation OR same-stable trigger error.

**Fails (insert succeeds) ⇒** RLS bypassed somewhere, OR the same-stable validation trigger isn't installed.

### 6. Heatmap RLS
1. Sign in as `owner-a@test.local`. Hit `/dashboard` (after the heatmap is wired in P2).
2. Expect: heatmap shows Test Horse A only — never Test Horse B.

## Cleanup

```sql
delete from stables where name in ('Test Stable A','Test Stable B'); -- cascades
delete from auth.users where email in (
  'owner-a@test.local','client-a@test.local','owner-b@test.local'
);
```

## Pass criteria

All six tests must pass before launch. There is no "good enough" on tenant isolation.
