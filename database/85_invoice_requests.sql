-- =============================================================
-- 85_invoice_requests.sql
-- Clients can ask their stable to issue an invoice (and say what for).
-- Staff see pending requests on finance > invoices and fulfil them by
-- generating a real invoice (or dismiss them).
-- =============================================================
create table if not exists invoice_requests (
  id          uuid primary key default gen_random_uuid(),
  stable_id   uuid not null references stables(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  note        text,
  status      text not null default 'pending'
                check (status in ('pending', 'fulfilled', 'dismissed')),
  fulfilled_invoice_id uuid references invoices(id) on delete set null,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint invoice_request_note_len check (note is null or length(note) <= 1000)
);

create index if not exists idx_invoice_requests_stable_status
  on invoice_requests(stable_id, status, created_at desc);

create trigger trg_invoice_requests_updated
  before update on invoice_requests
  for each row execute function set_updated_at();

alter table invoice_requests enable row level security;
alter table invoice_requests force row level security;

create policy invoice_requests_client_insert on invoice_requests
  for insert
  with check (
    current_user_role() = 'client'
    and stable_id = current_stable_id()
    and client_id = current_client_id()
  );

create policy invoice_requests_client_read on invoice_requests
  for select
  using (
    current_user_role() = 'client'
    and client_id = current_client_id()
  );

create policy invoice_requests_client_delete_pending on invoice_requests
  for delete
  using (
    current_user_role() = 'client'
    and client_id = current_client_id()
    and status = 'pending'
  );

create policy invoice_requests_staff_read on invoice_requests
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );

create policy invoice_requests_staff_update on invoice_requests
  for update
  using (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  )
  with check (stable_id = current_stable_id());

grant select, insert, update, delete on invoice_requests to authenticated;
