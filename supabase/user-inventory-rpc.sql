-- Public shared save users. Run once in Supabase SQL Editor.
-- Deliberately allows anon/authenticated visitors to read and modify all users.

create extension if not exists pgcrypto;

create table if not exists public.shared_save_users (
  user_id uuid primary key default gen_random_uuid(),
  name text not null default '我的用户',
  source_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_user_pals (
  user_pal_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.shared_save_users(user_id) on delete cascade,
  source_instance_id text,
  pal_id text not null references public.pals(pal_id),
  sex text not null check (sex in ('M', 'F')),
  nickname text not null default '',
  hp_iv smallint check (hp_iv is null or hp_iv between 0 and 100),
  attack_iv smallint check (attack_iv is null or attack_iv between 0 and 100),
  defense_iv smallint check (defense_iv is null or defense_iv between 0 and 100),
  imported_at timestamptz not null default now(),
  unique nulls not distinct (user_id, source_instance_id)
);

create index if not exists shared_user_pals_user_idx on public.shared_user_pals(user_id);

create table if not exists public.shared_user_pal_passives (
  user_pal_id uuid not null references public.shared_user_pals(user_pal_id) on delete cascade,
  passive_asset_id text not null references public.passives(asset_id),
  slot_index smallint check (slot_index is null or slot_index between 0 and 3),
  primary key (user_pal_id, passive_asset_id)
);

alter table public.shared_save_users enable row level security;
alter table public.shared_user_pals enable row level security;
alter table public.shared_user_pal_passives enable row level security;

drop policy if exists "Public full access" on public.shared_save_users;
create policy "Public full access" on public.shared_save_users for all to anon, authenticated using (true) with check (true);
drop policy if exists "Public full access" on public.shared_user_pals;
create policy "Public full access" on public.shared_user_pals for all to anon, authenticated using (true) with check (true);
drop policy if exists "Public full access" on public.shared_user_pal_passives;
create policy "Public full access" on public.shared_user_pal_passives for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.shared_save_users to anon, authenticated;
grant select, insert, update, delete on public.shared_user_pals to anon, authenticated;
grant select, insert, update, delete on public.shared_user_pal_passives to anon, authenticated;

create or replace view public.shared_user_inventory
with (security_invoker = true)
as
select
  up.user_pal_id,
  up.user_id,
  up.source_instance_id,
  up.pal_id,
  up.sex,
  up.nickname,
  up.hp_iv,
  up.attack_iv,
  up.defense_iv,
  coalesce(array_agg(ps.name_zh order by upp.slot_index)
    filter (where ps.asset_id is not null), '{}') as passive_names_zh,
  up.imported_at
from public.shared_user_pals up
left join public.shared_user_pal_passives upp on upp.user_pal_id = up.user_pal_id
left join public.passives ps on ps.asset_id = upp.passive_asset_id
group by up.user_pal_id;

grant select on public.shared_user_inventory to anon, authenticated;

create or replace function public.replace_shared_user_inventory(
  p_user_id uuid,
  p_user_name text,
  p_source_file_name text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  active_user_id uuid := p_user_id;
  item jsonb;
  new_user_pal_id uuid;
  passive_name text;
  passive_id text;
  passive_index integer;
begin
  if active_user_id is null then
    insert into public.shared_save_users (name, source_file_name)
    values (coalesce(nullif(trim(p_user_name), ''), '我的用户'), p_source_file_name)
    returning user_id into active_user_id;
  else
    update public.shared_save_users
      set name = coalesce(nullif(trim(p_user_name), ''), name),
          source_file_name = coalesce(p_source_file_name, source_file_name),
          updated_at = now()
      where user_id = active_user_id;
    if not found then raise exception 'Shared user not found'; end if;
  end if;

  delete from public.shared_user_pals where user_id = active_user_id;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.shared_user_pals (
      user_id, source_instance_id, pal_id, sex, nickname,
      hp_iv, attack_iv, defense_iv
    ) values (
      active_user_id,
      nullif(item->>'id', ''),
      item->>'pal_id',
      case when item->>'sex' = 'M' then 'M' else 'F' end,
      coalesce(item->>'nickname', ''),
      nullif(item->>'hp', '')::smallint,
      nullif(item->>'attack', '')::smallint,
      nullif(item->>'defense', '')::smallint
    ) returning user_pal_id into new_user_pal_id;

    passive_index := 0;
    for passive_name in select value #>> '{}' from jsonb_array_elements(coalesce(item->'passives', '[]'::jsonb)) loop
      select asset_id into passive_id from public.passives where name_zh = passive_name limit 1;
      if passive_id is not null then
        insert into public.shared_user_pal_passives (user_pal_id, passive_asset_id, slot_index)
        values (new_user_pal_id, passive_id, least(passive_index, 3))
        on conflict do nothing;
      end if;
      passive_index := passive_index + 1;
    end loop;
  end loop;

  update public.shared_save_users set updated_at = now() where user_id = active_user_id;
  return active_user_id;
end;
$$;

revoke all on function public.replace_shared_user_inventory(uuid, text, text, jsonb) from public;
grant execute on function public.replace_shared_user_inventory(uuid, text, text, jsonb) to anon, authenticated;
