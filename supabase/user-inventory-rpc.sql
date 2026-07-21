-- Run once in Supabase SQL Editor after supabase/schema.sql.
-- This atomically replaces one signed-in user's save profile inventory.

create or replace function public.replace_user_world_inventory(
  p_world_id uuid,
  p_world_name text,
  p_source_file_name text,
  p_items jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  active_user_id uuid := auth.uid();
  active_world_id uuid := p_world_id;
  item jsonb;
  new_user_pal_id uuid;
  passive_name text;
  passive_id text;
  passive_index integer;
begin
  if active_user_id is null then
    raise exception 'Authentication required';
  end if;

  if active_world_id is null then
    insert into public.user_worlds (user_id, name, source_file_name)
    values (active_user_id, coalesce(nullif(trim(p_world_name), ''), '我的存档'), p_source_file_name)
    returning world_id into active_world_id;
  else
    update public.user_worlds
      set name = coalesce(nullif(trim(p_world_name), ''), name),
          source_file_name = coalesce(p_source_file_name, source_file_name),
          updated_at = now()
      where world_id = active_world_id and user_id = active_user_id;
    if not found then raise exception 'Save profile not found'; end if;
  end if;

  delete from public.user_pals
    where world_id = active_world_id and user_id = active_user_id;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.user_pals (
      user_id, world_id, source_instance_id, pal_id, sex, nickname,
      hp_iv, attack_iv, defense_iv
    ) values (
      active_user_id,
      active_world_id,
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
        insert into public.user_pal_passives (user_pal_id, user_id, passive_asset_id, slot_index)
        values (new_user_pal_id, active_user_id, passive_id, least(passive_index, 3))
        on conflict do nothing;
      end if;
      passive_index := passive_index + 1;
    end loop;
  end loop;

  update public.user_worlds set updated_at = now()
    where world_id = active_world_id and user_id = active_user_id;
  return active_world_id;
end;
$$;

revoke all on function public.replace_user_world_inventory(uuid, text, text, jsonb) from public, anon;
grant execute on function public.replace_user_world_inventory(uuid, text, text, jsonb) to authenticated;
