-- Safe performance migration for projects that already ran user-inventory-rpc.sql.
-- Run this whole file once in the Supabase SQL Editor.

create index if not exists shared_user_pals_user_imported_idx
  on public.shared_user_pals(user_id, imported_at);

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

  insert into public.shared_user_pals (
    user_id, source_instance_id, pal_id, sex, nickname,
    hp_iv, attack_iv, defense_iv
  )
  select
    active_user_id,
    nullif(item->>'id', ''),
    item->>'pal_id',
    case when item->>'sex' = 'M' then 'M' else 'F' end,
    coalesce(item->>'nickname', ''),
    nullif(item->>'hp', '')::smallint,
    nullif(item->>'attack', '')::smallint,
    nullif(item->>'defense', '')::smallint
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as source(item);

  insert into public.shared_user_pal_passives (user_pal_id, passive_asset_id, slot_index)
  select
    up.user_pal_id,
    ps.asset_id,
    least((passive.position - 1)::smallint, 3::smallint)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as source(item)
  join public.shared_user_pals up
    on up.user_id = active_user_id
   and up.source_instance_id = nullif(source.item->>'id', '')
  cross join lateral jsonb_array_elements_text(coalesce(source.item->'passives', '[]'::jsonb))
    with ordinality as passive(name, position)
  join public.passives ps on ps.name_zh = passive.name
  on conflict do nothing;

  update public.shared_save_users set updated_at = now() where user_id = active_user_id;
  return active_user_id;
end;
$$;

revoke all on function public.replace_shared_user_inventory(uuid, text, text, jsonb) from public;
grant execute on function public.replace_shared_user_inventory(uuid, text, text, jsonb) to anon, authenticated;
