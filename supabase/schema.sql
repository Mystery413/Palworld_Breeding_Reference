-- Palworld Breeding Reference -> Supabase schema
-- Run this file once in Supabase SQL Editor, then import CSV files in the
-- numbered order described in supabase/README.md.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Public game reference data (readable by the app, writable by service role)
-- ---------------------------------------------------------------------------

create table if not exists public.pals (
  pal_id text primary key,
  game_version text not null,
  dex text not null,
  name_en text not null,
  name_zh text not null,
  combo_count integer not null default 0 check (combo_count >= 0),
  gender_specific_combo_count integer not null default 0 check (gender_specific_combo_count >= 0),
  hp numeric,
  attack numeric,
  defense numeric,
  work_speed numeric,
  rarity integer,
  breeding_power integer,
  male_rate numeric check (male_rate is null or male_rate between 0 and 100),
  image_url text,
  source_url text,
  updated_at timestamptz not null default now()
);

create index if not exists pals_dex_idx on public.pals (dex);
create index if not exists pals_name_en_idx on public.pals (lower(name_en));
create index if not exists pals_name_zh_idx on public.pals (name_zh);

create table if not exists public.pal_work_suitabilities (
  pal_id text not null references public.pals(pal_id) on delete cascade,
  work_type text not null,
  work_level smallint not null check (work_level between 0 and 10),
  primary key (pal_id, work_type)
);

create table if not exists public.pal_elements (
  pal_id text not null references public.pals(pal_id) on delete cascade,
  element text not null,
  primary key (pal_id, element)
);

create table if not exists public.pal_habitats (
  pal_id text primary key references public.pals(pal_id) on delete cascade,
  catchable boolean not null default false,
  min_level integer,
  max_level integer,
  wild_min_level integer,
  wild_max_level integer,
  common_wild_min_level integer,
  common_wild_max_level integer,
  boss_min_level integer,
  boss_max_level integer,
  day_count integer not null default 0,
  night_count integer not null default 0,
  world_tree_day_count integer not null default 0,
  world_tree_night_count integer not null default 0,
  summary text,
  map_source_url text
);

create table if not exists public.pal_habitat_locations (
  location_id bigint generated always as identity primary key,
  pal_id text not null references public.pals(pal_id) on delete cascade,
  world text not null check (world in ('palpagos', 'worldTree')),
  x numeric not null,
  y numeric not null,
  time_of_day text not null check (time_of_day in ('day', 'night', 'both')),
  level integer,
  is_boss boolean not null default false
);

create index if not exists pal_habitat_locations_pal_idx on public.pal_habitat_locations (pal_id);

create table if not exists public.breeding_combos (
  combo_id bigint generated always as identity primary key,
  parent_a_pal_id text not null references public.pals(pal_id) on delete cascade,
  parent_b_pal_id text not null references public.pals(pal_id) on delete cascade,
  child_pal_id text not null references public.pals(pal_id) on delete cascade,
  parent_a_gender text not null check (parent_a_gender in ('WILDCARD', 'MALE', 'FEMALE')),
  parent_b_gender text not null check (parent_b_gender in ('WILDCARD', 'MALE', 'FEMALE')),
  unique (parent_a_pal_id, parent_b_pal_id, child_pal_id, parent_a_gender, parent_b_gender)
);

create index if not exists breeding_combos_child_idx on public.breeding_combos (child_pal_id);
create index if not exists breeding_combos_parent_a_idx on public.breeding_combos (parent_a_pal_id);
create index if not exists breeding_combos_parent_b_idx on public.breeding_combos (parent_b_pal_id);

create table if not exists public.passives (
  asset_id text primary key,
  name_zh text not null,
  rank smallint,
  is_elite boolean generated always as (coalesce(rank, 0) >= 4) stored,
  updated_at timestamptz not null default now()
);

create index if not exists passives_name_zh_idx on public.passives (name_zh);
create index if not exists passives_elite_idx on public.passives (is_elite) where is_elite;

create table if not exists public.pal_asset_aliases (
  asset_id text primary key,
  pal_id text not null references public.pals(pal_id) on delete cascade
);

create index if not exists pal_asset_aliases_pal_idx on public.pal_asset_aliases (pal_id);

-- ---------------------------------------------------------------------------
-- Per-user save imports and planner state
-- ---------------------------------------------------------------------------

create table if not exists public.user_worlds (
  world_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '我的世界',
  source_file_name text,
  source_file_modified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, user_id)
);

create index if not exists user_worlds_user_idx on public.user_worlds (user_id);

create table if not exists public.user_pals (
  user_pal_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  world_id uuid not null,
  source_instance_id text,
  pal_id text not null references public.pals(pal_id),
  sex text not null check (sex in ('M', 'F')),
  nickname text not null default '',
  level integer check (level is null or level >= 1),
  hp_iv smallint check (hp_iv is null or hp_iv between 0 and 100),
  attack_iv smallint check (attack_iv is null or attack_iv between 0 and 100),
  defense_iv smallint check (defense_iv is null or defense_iv between 0 and 100),
  imported_at timestamptz not null default now(),
  unique (user_pal_id, user_id),
  unique nulls not distinct (user_id, world_id, source_instance_id),
  foreign key (world_id, user_id) references public.user_worlds(world_id, user_id) on delete cascade
);

create index if not exists user_pals_user_world_idx on public.user_pals (user_id, world_id);
create index if not exists user_pals_pal_idx on public.user_pals (pal_id);

create table if not exists public.user_pal_passives (
  user_pal_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  passive_asset_id text not null references public.passives(asset_id),
  slot_index smallint check (slot_index is null or slot_index between 0 and 3),
  primary key (user_pal_id, passive_asset_id),
  foreign key (user_pal_id, user_id) references public.user_pals(user_pal_id, user_id) on delete cascade
);

create index if not exists user_pal_passives_user_idx on public.user_pal_passives (user_id);
create index if not exists user_pal_passives_asset_idx on public.user_pal_passives (passive_asset_id);

create table if not exists public.user_planner_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  world_id uuid references public.user_worlds(world_id) on delete set null,
  desired_passive_assets text[] not null default '{}',
  profile text not null default 'combat' check (profile in ('combat', 'attack', 'worker', 'balanced')),
  exact_target_pal_id text references public.pals(pal_id),
  player_level integer not null default 20 check (player_level between 1 and 80),
  allow_capture boolean not null default true,
  max_breeding_steps integer not null default 4 check (max_breeding_steps between 1 and 12),
  elite_only boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Public reference data is readable without login. Only the service role or SQL
-- editor should write it because no insert/update/delete policies are created.
alter table public.pals enable row level security;
alter table public.pal_work_suitabilities enable row level security;
alter table public.pal_elements enable row level security;
alter table public.pal_habitats enable row level security;
alter table public.pal_habitat_locations enable row level security;
alter table public.breeding_combos enable row level security;
alter table public.passives enable row level security;
alter table public.pal_asset_aliases enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'pals', 'pal_work_suitabilities', 'pal_elements', 'pal_habitats',
    'pal_habitat_locations', 'breeding_combos', 'passives', 'pal_asset_aliases'
  ] loop
    execute format('drop policy if exists "Public read" on public.%I', table_name);
    execute format('create policy "Public read" on public.%I for select to anon, authenticated using (true)', table_name);
  end loop;
end $$;

alter table public.user_worlds enable row level security;
alter table public.user_pals enable row level security;
alter table public.user_pal_passives enable row level security;
alter table public.user_planner_settings enable row level security;

drop policy if exists "Users manage own worlds" on public.user_worlds;
create policy "Users manage own worlds" on public.user_worlds
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own pals" on public.user_pals;
create policy "Users manage own pals" on public.user_pals
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own pal passives" on public.user_pal_passives;
create policy "Users manage own pal passives" on public.user_pal_passives
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own planner settings" on public.user_planner_settings;
create policy "Users manage own planner settings" on public.user_planner_settings
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Convenient read model for the app. security_invoker keeps the underlying RLS.
create or replace view public.user_pal_inventory
with (security_invoker = true)
as
select
  up.user_pal_id,
  up.user_id,
  up.world_id,
  up.source_instance_id,
  up.pal_id,
  p.dex,
  p.name_en,
  p.name_zh,
  up.sex,
  up.nickname,
  up.level,
  up.hp_iv,
  up.attack_iv,
  up.defense_iv,
  coalesce(array_agg(upp.passive_asset_id order by upp.slot_index)
    filter (where upp.passive_asset_id is not null), '{}') as passive_asset_ids,
  coalesce(array_agg(ps.name_zh order by upp.slot_index)
    filter (where ps.asset_id is not null), '{}') as passive_names_zh,
  coalesce(bool_or(ps.is_elite), false) as has_elite_passive,
  up.imported_at
from public.user_pals up
join public.pals p on p.pal_id = up.pal_id
left join public.user_pal_passives upp on upp.user_pal_id = up.user_pal_id and upp.user_id = up.user_id
left join public.passives ps on ps.asset_id = upp.passive_asset_id
group by up.user_pal_id, p.pal_id;

grant select on public.user_pal_inventory to authenticated;

