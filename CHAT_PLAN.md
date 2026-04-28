# Chat Module — Strict Technical Plan

Status: design complete. Phase 1 (DB+RLS) and Phase 2 (services) implemented in this round. Phases 3–5 deferred.

This document is the contract. Anything not in scope here is **deferred**.

---

## 1. Database tables

Three new tables, all carrying `stable_id` for tenant isolation.

### `chat_threads`

| column      | type                                             | notes                                                   |
|-------------|--------------------------------------------------|---------------------------------------------------------|
| id          | uuid pk                                          | `default gen_random_uuid()`                             |
| stable_id   | uuid not null → `stables(id) on delete cascade`  | tenant key                                              |
| type        | `chat_thread_type` enum                          | `'stable_general' | 'direct'`                           |
| title       | text                                             | only for `stable_general`; null for `direct`            |
| created_by  | uuid → `profiles(id) on delete set null`         |                                                         |
| created_at  | timestamptz default now()                        |                                                         |
| updated_at  | timestamptz default now()                        | bumped by trigger when a new message is inserted        |

Constraints / indexes:

- `unique (stable_id) where type = 'stable_general'` — exactly one general thread per stable.
- index on `(stable_id, type, updated_at desc)` — drives the conversation list sort.

### `chat_participants`

| column        | type                                                    | notes                                                     |
|---------------|---------------------------------------------------------|-----------------------------------------------------------|
| id            | uuid pk                                                 |                                                           |
| stable_id     | uuid not null → `stables(id) on delete cascade`         | defense-in-depth                                          |
| thread_id     | uuid not null → `chat_threads(id) on delete cascade`    |                                                           |
| profile_id    | uuid not null → `profiles(id) on delete cascade`        |                                                           |
| role_at_join  | `user_role` not null                                    | snapshot for audit; **permission checks read live role**  |
| last_read_at  | timestamptz                                             | drives unread badge                                       |
| created_at    | timestamptz default now()                               |                                                           |

Constraints / indexes:

- `unique (thread_id, profile_id)` — a user appears in a thread at most once.
- index on `(profile_id, thread_id)` — drives "my threads" lookup.
- index on `(stable_id, profile_id)`.

Same-stable trigger: `participant.stable_id == thread.stable_id == profile.stable_id`.

For `type = 'stable_general'`, participant rows are **optional** — membership is implicit (every member of the stable can read/write the general thread via RLS). Rows are only inserted lazily for `last_read_at` tracking via `mark_thread_read()`.

For `type = 'direct'`, participant rows are **required** — they gate visibility.

### `chat_messages`

| column            | type                                                    | notes                                          |
|-------------------|---------------------------------------------------------|------------------------------------------------|
| id                | uuid pk                                                 |                                                |
| stable_id         | uuid not null → `stables(id) on delete cascade`         |                                                |
| thread_id         | uuid not null → `chat_threads(id) on delete cascade`    |                                                |
| sender_profile_id | uuid not null → `profiles(id) on delete restrict`       |                                                |
| body              | text not null                                           | `check (length(body) between 1 and 4000)`      |
| created_at        | timestamptz default now()                               |                                                |
| edited_at         | timestamptz                                             | reserved; no UPDATE policy in MVP              |
| deleted_at        | timestamptz                                             | reserved; no DELETE policy in MVP              |

Constraints / indexes:

- index on `(thread_id, created_at desc)` — message list pagination.
- index on `(stable_id, created_at desc)` — admin/audit queries.

Same-stable trigger: `message.stable_id == thread.stable_id == sender.stable_id`.

Trigger: after-insert touches `chat_threads.updated_at = now()` for the parent.

### Auto-creation of the general thread

Extending `provision_stable` (in `06_auth.sql`) is risky — we don't touch existing migrations. Instead, an `after insert` trigger on `stables` creates the single `stable_general` thread. For pre-existing stables, the migration backfills one row per stable.

### What we do **not** add

- `user_presence` table. Presence (Phase 5) lives entirely in Supabase Realtime Presence (in-memory). No DB row.

---

## 2. RLS policies

`enable + force` row level security on all three new tables. Default deny.

### Visibility helper (key trick to avoid recursive RLS)

```sql
chat_visible_thread_ids() returns setof uuid
  language sql stable security definer set search_path = public
```

Returns:

- the `stable_general` thread for `current_stable_id()`, plus
- every `chat_threads.id` for which the caller has a `chat_participants` row.

Because it's `SECURITY DEFINER`, it bypasses RLS on `chat_participants` and `chat_threads`, sidestepping recursive policy evaluation. It only ever uses `current_stable_id()` and `current_user_id()`, so there's no way to force it to return another stable's threads.

### `chat_threads`

| policy                          | for      | predicate                                                                                              |
|---------------------------------|----------|--------------------------------------------------------------------------------------------------------|
| `chat_threads_read`             | SELECT   | `id in (select chat_visible_thread_ids())`                                                             |
| `chat_threads_update_general`   | UPDATE   | owner only, only `title`/`updated_at`, only `stable_general` for own stable                            |

**No INSERT policy.** Inserts happen only via:
- `start_direct_thread()` RPC (SECURITY DEFINER), or
- the `after insert on stables` trigger that creates the general thread.

**No DELETE policy.** Threads are not deletable in MVP.

### `chat_participants`

| policy                              | for      | predicate                                                                                                       |
|-------------------------------------|----------|-----------------------------------------------------------------------------------------------------------------|
| `chat_participants_read`            | SELECT   | `thread_id in (select chat_visible_thread_ids())`                                                               |
| `chat_participants_update_self`     | UPDATE   | `profile_id = current_user_id()` — caller can update only their own row, only `last_read_at` (enforced by RPC)  |

**No INSERT policy.** Direct-thread participants are written by `start_direct_thread()` (SECURITY DEFINER). General-thread participant rows are upserted by `mark_thread_read()` (SECURITY DEFINER).

**No DELETE policy.**

### `chat_messages`

| policy                       | for      | predicate                                                                                                          |
|------------------------------|----------|--------------------------------------------------------------------------------------------------------------------|
| `chat_messages_read`         | SELECT   | `thread_id in (select chat_visible_thread_ids())` AND `deleted_at is null`                                         |
| `chat_messages_insert`       | INSERT   | `stable_id = current_stable_id()` AND `sender_profile_id = current_user_id()` AND `thread_id in (select chat_visible_thread_ids())` AND `edited_at is null` AND `deleted_at is null` |

**No UPDATE policy.** No edit in MVP.
**No DELETE policy.** No delete in MVP. Deletes would be via a future RPC that sets `deleted_at`.

### Realtime publication

Only `chat_messages` is added to `supabase_realtime`:

```sql
alter publication supabase_realtime add table chat_messages;
```

This is the table the UI subscribes to. Threads/participants are fetched via service-layer reads after a message arrives (we re-list threads to update the conversation panel sort/unread).

---

## 3. Chat permission logic by role

The pair rules from the spec, expressed as ordered (caller_role, target_role) pairs, allowed for direct-message creation:

```
(owner,    employee)   ✅
(employee, owner)      ✅
(employee, client)     ✅
(client,   employee)   ✅
(owner,    client)     ❌  — client cannot DM owner; owner cannot DM client
(client,   owner)      ❌
(client,   client)     ❌
(employee, employee)   ❌  (spec lists no employee↔employee — strict deny)
(owner,    owner)      ❌  (single owner per stable expected; defense-in-depth)
```

Encoded in `chat_can_dm(target_profile_id) returns boolean` (`SECURITY DEFINER STABLE`). It also enforces same-stable.

Used by:

- `start_direct_thread()` RPC — gatekeeper for new direct threads.
- `getAvailableChatContacts()` service — returns the list of profiles the caller is allowed to start a DM with (filters by `chat_can_dm`).

For the **stable general** thread:

- Read: any member of the stable (owner, employee, client) — enforced by RLS via `chat_visible_thread_ids()`.
- Write: same — anyone can post.

---

## 4. How the general stable chat works

- Created automatically via `after insert on stables` trigger (and backfilled for existing stables in the migration).
- Exactly one per stable (`unique (stable_id) where type='stable_general'`).
- Visibility is implicit — no `chat_participants` row required to read or post. RLS uses `current_stable_id()` + the visibility helper.
- Read tracking (`last_read_at`) lazily upserts a `chat_participants` row when the user calls `markThreadRead(threadId)`.
- Only the owner can rename it (UPDATE policy).

---

## 5. How direct chats work

- Created exclusively through `start_direct_thread(p_target_profile_id)` RPC. The RPC:
  1. Calls `chat_can_dm(p_target_profile_id)` → throws `CHAT_FORBIDDEN` if not allowed.
  2. Looks up an existing direct thread between exactly the two profiles in the same stable (deduplication). Returns it if found.
  3. Otherwise inserts the thread + two participant rows in one transaction.
- The RPC is `SECURITY DEFINER` so it can write to tables that have no INSERT policy. It only ever uses `current_user_id()` and `current_stable_id()`, never trusting client-supplied stable IDs.
- After creation, both participants see the thread via `chat_visible_thread_ids()` and can post via the `chat_messages_insert` policy.

---

## 6. How messages are stored

- Single row per message in `chat_messages`. `body` is `text` with a length CHECK (1–4000 chars).
- `created_at` is the canonical sort key. Pagination uses `(created_at desc, id desc)` keyset.
- `edited_at` and `deleted_at` are reserved for future migrations; no UI/policy uses them in MVP.
- After-insert trigger touches `chat_threads.updated_at` so the conversation list sorts correctly.

---

## 7. How realtime updates work

**Architecture**: Supabase Realtime → Postgres Changes on the `chat_messages` table.

**Required setup**:

1. Migration adds `chat_messages` to the `supabase_realtime` publication:
   ```sql
   alter publication supabase_realtime add table chat_messages;
   ```
2. RLS is enabled on `chat_messages` and a SELECT policy exists (it does — `chat_messages_read`). Realtime evaluates RLS per-row before delivery to each subscriber, so cross-stable leaks are impossible.
3. Replica identity stays at the default (PRIMARY KEY) — we only need INSERT broadcasts, not UPDATE/DELETE.
4. **Supabase Dashboard**: no manual UI step is required if (1) and (2) are managed in SQL (they are). To verify post-deploy: Database → Replication → ensure `chat_messages` is listed under the `supabase_realtime` publication.
5. Library version: `@supabase/supabase-js@^2.45` — already in `package.json`. Realtime v2 with per-row RLS authorization is the supported behavior.

**Client subscription pattern (Phase 3 / 4)**:

```ts
// inside a Client Component, mounted only after server-rendered initial data
const supabase = createSupabaseBrowserClient();
const channel = supabase
  .channel(`chat:thread:${threadId}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
    (payload) => appendMessage(payload.new),
  )
  .subscribe();
return () => { supabase.removeChannel(channel); };
```

The `filter` is a server-side hint, not a security boundary — RLS is the boundary.

**No service-role on the client.** The browser uses the anon JWT cookie set by `@supabase/ssr`. RLS runs against that JWT.

---

## 8. How online/offline presence works (Phase 5 — deferred)

Approach: Supabase Realtime Presence on a per-stable channel.

- Channel name: `presence:stable:{stableId}` (stableId comes from the server-rendered session, never from URL).
- Presence key: `profile_id`.
- Tracked metadata: `{ profile_id, full_name, role, online_at }`.
- All members of the stable join the same channel; the chat UI maps presence members to the conversation list / message header to render the green dot.

**Risk**: Realtime channel topics in supabase-js are not RLS-scoped by default. The mitigation is that we never send a stableId we don't trust — the page is a server component that reads the session and passes the bound `stableId` down to a Client Component. A malicious client could try to join `presence:stable:{otherStableId}`, but they would only see other malicious clients, never real data — presence carries no DB rows.

For stronger guarantees, Supabase has a "Realtime Authorization" feature (private channels with RLS-style policies on `realtime.messages`) which we can adopt later. Document this trade-off in the Phase 5 PR description.

**Decision for now**: design only. No code in this round.

---

## 9. MVP scope (what ships in this iteration)

Phase 1 (this round, DB):
- Migrations 09 / 10 / 11.
- `chat_test_plan.sql`.

Phase 2 (this round, services):
- `services/chat.ts` with: `listThreads`, `getMessages`, `sendMessage`, `startDirectThread`, `getAvailableChatContacts`, `markThreadRead`.

Phase 3 (next round, UI):
- `/dashboard/chat` route.
- Two-column layout (conversation list + message panel).
- Stable-general pinned at top, direct chats below, sorted by `updated_at desc`.
- Message input.
- Empty state.
- Mobile-friendly (single-column with back button).

Phase 4 (next round, realtime):
- Browser subscription to `chat_messages` for the open thread + invalidation of the conversation list on insert in any thread the user can see.

Phase 5 (later):
- Presence dot.

---

## 10. What must wait for later

- File attachments (images, docs).
- Voice / video.
- Message reactions / emoji.
- Threaded replies.
- Read receipts beyond unread badge.
- Edit + delete UX (DB columns reserved; policies + UI deferred).
- Push notifications / email digests of unread messages.
- Moderation (mute, block, report, audit log of deleted messages).
- Group direct chats (3+ users in one direct thread).
- Search across messages.
- Pinned messages.
- Typing indicators.
- Realtime Authorization (private channels) — see §8.

---

## 11. Security risks and mitigations

| risk                                                                                  | mitigation                                                                                                                                                       |
|---------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Cross-stable read of threads/messages via crafted `thread_id`                         | `stable_id` on every chat row + same-stable triggers + RLS predicate via `chat_visible_thread_ids()` (which uses `current_stable_id()`)                          |
| Recursive RLS on `chat_participants` policy                                           | `chat_visible_thread_ids()` is `SECURITY DEFINER` and reads `chat_participants` directly, bypassing its own policy — no recursion at policy-evaluation time      |
| Client opens a DM with the owner                                                      | `chat_can_dm()` deny pair `(client, owner)`; `start_direct_thread()` is the only INSERT path for direct threads                                                  |
| Client opens a DM with another client                                                 | `chat_can_dm()` deny pair `(client, client)`                                                                                                                     |
| Employee opens a DM with another employee                                             | `chat_can_dm()` deny pair `(employee, employee)` — strict reading of spec, easy to relax later                                                                   |
| Client crafts an INSERT into `chat_messages` with someone else's `sender_profile_id`  | `chat_messages_insert WITH CHECK` requires `sender_profile_id = current_user_id()`                                                                               |
| Client INSERTs into a thread they're not in                                           | `chat_messages_insert WITH CHECK` requires `thread_id in (select chat_visible_thread_ids())`                                                                     |
| Client inserts a participant row to gate-crash a DM                                   | No INSERT policy on `chat_participants` — only the `start_direct_thread()` RPC writes them                                                                       |
| Client renames the general chat                                                       | `chat_threads_update_general` policy restricts UPDATE to `current_user_role() = 'owner'`                                                                         |
| Realtime leaks messages from another stable                                           | Realtime v2 evaluates RLS per row before delivery; `chat_messages_read` enforces stable scoping                                                                  |
| Service role used in the browser                                                      | Only `createSupabaseBrowserClient()` is used in client components. `createSupabaseAdminClient()` lives in `lib/supabase/server.ts` and is never imported by chat |
| Massive message body / DoS via huge inserts                                           | `length(body) between 1 and 4000` CHECK constraint + service-layer length validation                                                                             |
| `chat_can_dm` returns true across stables                                             | Helper checks `target.stable_id = caller stable` before returning true                                                                                           |
| `start_direct_thread` creates duplicate threads on race                               | Dedup query inside SECURITY DEFINER block; serial enough for low write rate. If contention emerges, add `pg_advisory_xact_lock(hashtextextended(...))` later     |
| Stale `role_at_join` lets a demoted user keep elevated chat access                    | Permission checks (`chat_can_dm`, RLS predicates) read **live** `current_user_role()`; `role_at_join` is audit-only                                              |
| Presence channel impersonation (Phase 5)                                              | Documented in §8; mitigated by always sourcing `stableId` from server session, not URL                                                                           |

---

## Migration order

1. `09_chat_schema.sql` — tables, enum, indexes, triggers, publication, backfill general threads.
2. `10_chat_policies.sql` — `chat_visible_thread_ids()` helper, then RLS enable/force, then policies.
3. `11_chat_functions.sql` — `chat_can_dm()`, `start_direct_thread()`, `mark_thread_read()`. Grants.
4. `database/tests/chat_test_plan.sql` — manual security tests, run after seed.

Each file is pure SQL, idempotent where reasonable, and can be applied via `supabase db push` or `psql -f`.

## How to test manually

1. Apply migrations in order above against a Supabase project that has the existing `01–08` schema and `00_seed.sql` data.
2. Open the SQL editor in Supabase Studio and run blocks of `chat_test_plan.sql` one at a time. Each block uses `begin/rollback` so seed state is preserved.
3. Each block has an "expected" comment. A passing run matches every expected count / message exactly.
4. To smoke-test the service layer end-to-end before UI exists, write a temporary server action that imports `services/chat.ts`, then call it from a test page or a Node REPL with a real session cookie.

## Out of scope / explicitly not touched

- `01_extensions.sql` through `08_clients_skill_level.sql` — untouched.
- `services/payments.ts`, `services/expenses.ts` — untouched.
- `lib/auth/session.ts`, `lib/supabase/{client,server}.ts` — untouched. Chat uses the existing helpers.
- Stripe, billing, recurring lessons, notifications, any Phase 2 product feature.
