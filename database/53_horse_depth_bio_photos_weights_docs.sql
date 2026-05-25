-- =============================================================
-- 53_horse_depth_bio_photos_weights_docs.sql
-- Sprint 3 — horse profile depth foundation.
-- Already applied via Supabase MCP; canonical copy here.
-- =============================================================

-- Identification + lineage + physical + discipline metadata on horses
alter table horses
  add column if not exists sire_name        text,
  add column if not exists dam_name         text,
  add column if not exists microchip_id     text,
  add column if not exists passport_no      text,
  add column if not exists fei_id           text,
  add column if not exists color            text,
  add column if not exists sex              text check (
    sex is null or sex in ('mare', 'stallion', 'gelding', 'filly', 'colt')
  ),
  add column if not exists height_hands     numeric(4,1),
  add column if not exists discipline       text;

-- Multi-photo gallery (beyond horses.photo_url hero)
create table if not exists horse_photos (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  horse_id        uuid not null references horses(id)  on delete cascade,
  url             text not null,
  caption         text,
  sort_order      int  not null default 0,
  uploaded_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_horse_photos_horse on horse_photos(horse_id, sort_order);
create index if not exists idx_horse_photos_stable on horse_photos(stable_id);
alter table horse_photos enable row level security;
alter table horse_photos force  row level security;

create policy horse_photos_read on horse_photos
  for select using (stable_id = current_stable_id());

create policy horse_photos_write on horse_photos
  for all
  using (
    stable_id = current_stable_id()
    and (
      current_user_role() in ('owner', 'employee')
      or exists (
        select 1 from horses h
        where h.id = horse_photos.horse_id
          and h.owner_client_id = current_client_id()
      )
    )
  )
  with check (
    stable_id = current_stable_id()
    and (
      current_user_role() in ('owner', 'employee')
      or exists (
        select 1 from horses h
        where h.id = horse_photos.horse_id
          and h.owner_client_id = current_client_id()
      )
    )
  );

-- Weight log over time
create table if not exists horse_weights (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  horse_id        uuid not null references horses(id)  on delete cascade,
  measured_at     date not null default current_date,
  weight_kg       numeric(5,1) not null check (weight_kg > 0 and weight_kg < 2000),
  notes           text,
  recorded_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (horse_id, measured_at)
);

create index if not exists idx_horse_weights_horse_date on horse_weights(horse_id, measured_at desc);
alter table horse_weights enable row level security;
alter table horse_weights force  row level security;

create policy horse_weights_read on horse_weights
  for select using (stable_id = current_stable_id());
create policy horse_weights_write on horse_weights
  for all
  using (stable_id = current_stable_id() and current_user_role() in ('owner', 'employee'))
  with check (stable_id = current_stable_id() and current_user_role() in ('owner', 'employee'));

-- Documents (passport scans, vaccination, insurance, etc)
create table if not exists horse_documents (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  horse_id        uuid not null references horses(id)  on delete cascade,
  kind            text not null check (
    kind in ('passport', 'registration', 'vaccination', 'insurance', 'vet_record', 'other')
  ),
  title           text not null,
  url             text not null,
  file_size_kb    int,
  expires_at      date,
  uploaded_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_horse_documents_horse on horse_documents(horse_id, kind);
create index if not exists idx_horse_documents_expires
  on horse_documents(expires_at) where expires_at is not null;
alter table horse_documents enable row level security;
alter table horse_documents force  row level security;

create policy horse_documents_read on horse_documents
  for select using (stable_id = current_stable_id());
create policy horse_documents_write on horse_documents
  for all
  using (stable_id = current_stable_id() and current_user_role() in ('owner', 'employee'))
  with check (stable_id = current_stable_id() and current_user_role() in ('owner', 'employee'));
