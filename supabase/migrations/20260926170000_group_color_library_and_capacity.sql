-- Searchable Group color library (60 presets) and a 30-Group Camp limit.

alter table public.color_presets
  add column name_en text,
  add column family text;

update public.color_presets preset
set name_en = v.name_en, family = v.family
from (values
  ('yellow', 'Yellow', 'yellow'),
  ('blue', 'Blue', 'blue'),
  ('red', 'Red', 'red'),
  ('green', 'Green', 'green'),
  ('purple', 'Purple', 'purple'),
  ('orange', 'Orange', 'orange'),
  ('sky', 'Sky blue', 'blue'),
  ('pink', 'Pink', 'pink'),
  ('teal', 'Teal', 'cyan'),
  ('brown', 'Brown', 'brown'),
  ('navy', 'Navy', 'blue'),
  ('lime', 'Lime', 'green'),
  ('magenta', 'Magenta', 'pink'),
  ('cyan', 'Cyan', 'cyan'),
  ('maroon', 'Maroon', 'red'),
  ('olive', 'Olive', 'green'),
  ('gray', 'Gray', 'neutral'),
  ('black', 'Black', 'neutral'),
  ('gold', 'Gold', 'yellow'),
  ('indigo', 'Indigo', 'purple')
) v(key, name_en, family)
where preset.key = v.key;

insert into public.color_presets (key, name_th, name_en, family, hex, text_color, sort_order) values
  ('wine', 'แดงไวน์', 'Wine', 'red', '#6D1A2B', '#FFFFFF', 21),
  ('brick', 'แดงอิฐ', 'Brick', 'red', '#B5482A', '#FFFFFF', 22),
  ('scarlet-neon', 'แดงสะท้อนแสง', 'Neon red', 'red', '#FF3B3B', '#17211B', 23),
  ('salmon', 'โอรส', 'Salmon', 'orange', '#F08A6C', '#17211B', 24),
  ('peach', 'พีช', 'Peach', 'orange', '#FDBA8C', '#17211B', 25),
  ('copper', 'ทองแดง', 'Copper', 'orange', '#B87333', '#17211B', 26),
  ('orange-neon', 'ส้มสะท้อนแสง', 'Neon orange', 'orange', '#FF7A00', '#17211B', 27),
  ('apricot', 'แอปริคอต', 'Apricot', 'orange', '#F7A541', '#17211B', 28),
  ('lemon', 'เหลืองมะนาว', 'Lemon', 'yellow', '#FDE047', '#17211B', 29),
  ('mustard', 'เหลืองมัสตาร์ด', 'Mustard', 'yellow', '#D4A017', '#17211B', 30),
  ('cream', 'ครีม', 'Cream', 'yellow', '#FFF1C1', '#17211B', 31),
  ('yellow-neon', 'เหลืองสะท้อนแสง', 'Neon yellow', 'yellow', '#E6FF00', '#17211B', 32),
  ('army', 'เขียวขี้ม้า', 'Army green', 'green', '#4B5320', '#FFFFFF', 33),
  ('emerald', 'เขียวมรกต', 'Emerald', 'green', '#10B981', '#17211B', 34),
  ('mint', 'เขียวมิ้นต์', 'Mint', 'green', '#6EE7B7', '#17211B', 35),
  ('bottle', 'เขียวขวด', 'Bottle green', 'green', '#0B4F3C', '#FFFFFF', 36),
  ('jade', 'เขียวหยก', 'Jade', 'green', '#00A86B', '#17211B', 37),
  ('green-neon', 'เขียวสะท้อนแสง', 'Neon green', 'green', '#39FF14', '#17211B', 38),
  ('pistachio', 'เขียวพิสตาชิโอ', 'Pistachio', 'green', '#A3C585', '#17211B', 39),
  ('duckhead', 'เขียวหัวเป็ด', 'Peacock teal', 'cyan', '#005F6A', '#FFFFFF', 40),
  ('turquoise', 'เทอร์ควอยซ์', 'Turquoise', 'cyan', '#2DD4BF', '#17211B', 41),
  ('aqua', 'ฟ้าน้ำทะเล', 'Aqua', 'cyan', '#22D3EE', '#17211B', 42),
  ('baby-blue', 'ฟ้าอ่อน', 'Baby blue', 'blue', '#93C5FD', '#17211B', 43),
  ('denim', 'ยีนส์', 'Denim', 'blue', '#3B5B92', '#FFFFFF', 44),
  ('periwinkle', 'ฟ้าอมม่วง', 'Periwinkle', 'blue', '#8B9CF7', '#17211B', 45),
  ('midnight', 'น้ำเงินเข้ม', 'Midnight blue', 'blue', '#172554', '#FFFFFF', 46),
  ('lavender', 'ม่วงลาเวนเดอร์', 'Lavender', 'purple', '#C4B5FD', '#17211B', 47),
  ('mangosteen', 'ม่วงมังคุด', 'Mangosteen', 'purple', '#4A1942', '#FFFFFF', 48),
  ('orchid', 'ม่วงกล้วยไม้', 'Orchid', 'purple', '#DA70D6', '#17211B', 49),
  ('grape', 'ม่วงองุ่น', 'Grape', 'purple', '#6D28D9', '#FFFFFF', 50),
  ('baby-pink', 'ชมพูอ่อน', 'Baby pink', 'pink', '#F9A8D4', '#17211B', 51),
  ('pink-neon', 'ชมพูสะท้อนแสง', 'Neon pink', 'pink', '#FF1493', '#17211B', 52),
  ('dusty-pink', 'ชมพูกะปิ', 'Dusty pink', 'pink', '#C9828B', '#17211B', 53),
  ('chocolate', 'ช็อกโกแลต', 'Chocolate', 'brown', '#5C3A21', '#FFFFFF', 54),
  ('beige', 'เบจ', 'Beige', 'brown', '#E8D8B8', '#17211B', 55),
  ('khaki', 'กากี', 'Khaki', 'brown', '#A89A6B', '#17211B', 56),
  ('coffee-milk', 'น้ำตาลกาแฟนม', 'Latte', 'brown', '#9C7A5B', '#17211B', 57),
  ('white', 'ขาว', 'White', 'neutral', '#FFFFFF', '#17211B', 58),
  ('silver', 'เงิน', 'Silver', 'neutral', '#C0C0C0', '#17211B', 59),
  ('charcoal', 'เทาถ่าน', 'Charcoal', 'neutral', '#2F3437', '#FFFFFF', 60)
on conflict (key) do nothing;

alter table public.color_presets
  alter column name_en set not null,
  alter column family set not null,
  add constraint color_presets_family_valid check (family in ('red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'brown', 'neutral'));

-- Raise the per-Camp Group limit from 20 to 30 (functions copied from 20260824040623, limit changed only).
create or replace function public.save_draft_setup(
  p_camp_id uuid,
  p_groups jsonb,
  p_staff_names text[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_camp public.camps%rowtype;
  v_group_count integer;
  v_staff_count integer;
  v_invalid_count integer;
  v_before jsonb;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACCESS_DENIED', 'message', 'ไม่มีสิทธิ์แก้ไขค่าย')
    );
  end if;

  select * into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;

  if not found or not exists (
    select 1
    from public.camp_members member
    where member.camp_id = p_camp_id
      and member.admin_account_id = v_session.admin_account_id
      and member.role = 'admin'
      and member.active
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACCESS_DENIED', 'message', 'ไม่มีสิทธิ์แก้ไขค่าย')
    );
  end if;

  if v_camp.status <> 'draft' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'CAMP_NOT_DRAFT', 'message', 'แก้ชุดเริ่มต้นได้เฉพาะค่าย Draft')
    );
  end if;

  if exists (select 1 from public.transactions tx where tx.camp_id = p_camp_id) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'CAMP_HAS_TRANSACTIONS', 'message', 'ค่ายนี้มีรายการคะแนนแล้ว')
    );
  end if;

  if p_groups is null or jsonb_typeof(p_groups) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_GROUPS', 'message', 'ข้อมูลกลุ่มไม่ถูกต้อง')
    );
  end if;

  v_group_count := jsonb_array_length(p_groups);
  v_staff_count := coalesce(array_length(p_staff_names, 1), 0);
  if v_group_count not between 1 and 30 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_GROUP_COUNT', 'message', 'ต้องมี 1–30 กลุ่ม')
    );
  end if;
  if v_staff_count < 1 or v_staff_count > 32767 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_STAFF', 'message', 'ต้องมี Staff อย่างน้อย 1 คน')
    );
  end if;

  select count(*) into v_invalid_count
  from jsonb_array_elements(p_groups) item
  where item->>'color_key' is null
    or item->>'custom_name' is null
    or char_length(btrim(item->>'custom_name')) > 80
    or coalesce(item->>'sort_order', '') !~ '^[0-9]+$'
    or (item->>'sort_order')::integer not between 1 and v_group_count;
  if v_invalid_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_GROUPS', 'message', 'ชื่อ สี หรือลำดับกลุ่มไม่ถูกต้อง')
    );
  end if;

  select count(*) into v_invalid_count
  from (
    select item->>'color_key' color_key, (item->>'sort_order')::integer sort_order
    from jsonb_array_elements(p_groups) item
  ) configured
  left join public.color_presets preset on preset.key = configured.color_key
  where preset.key is null;
  if v_invalid_count > 0
    or (select count(distinct item->>'color_key') from jsonb_array_elements(p_groups) item) <> v_group_count
    or (select count(distinct (item->>'sort_order')::integer) from jsonb_array_elements(p_groups) item) <> v_group_count
  then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_GROUPS', 'message', 'สีหรือลำดับกลุ่มซ้ำกัน')
    );
  end if;

  select count(*) into v_invalid_count
  from unnest(p_staff_names) staff_name
  where staff_name is null or char_length(btrim(staff_name)) not between 1 and 80;
  if v_invalid_count > 0
    or (select count(distinct lower(btrim(staff_name))) from unnest(p_staff_names) staff_name) <> v_staff_count
  then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_STAFF', 'message', 'ชื่อ Staff ว่างหรือซ้ำกัน')
    );
  end if;

  v_before := jsonb_build_object(
    'group_count', (select count(*) from public.groups team where team.camp_id = p_camp_id),
    'staff_count', (
      select count(*) from public.camp_members member
      where member.camp_id = p_camp_id and member.role = 'staff'
    )
  );

  delete from public.groups where camp_id = p_camp_id;
  delete from public.camp_members where camp_id = p_camp_id and role = 'staff';

  insert into public.groups (
    camp_id,
    color_key,
    color_name,
    color_hex,
    custom_name,
    current_score,
    score_reached_at,
    active,
    sort_order
  )
  select
    p_camp_id,
    preset.key,
    preset.name_th,
    preset.hex,
    btrim(item->>'custom_name'),
    0,
    null,
    true,
    (item->>'sort_order')::smallint
  from jsonb_array_elements(p_groups) item
  join public.color_presets preset on preset.key = item->>'color_key'
  order by (item->>'sort_order')::integer;

  insert into public.camp_members (
    camp_id,
    display_name,
    role,
    active,
    sort_order
  )
  select
    p_camp_id,
    btrim(staff_name),
    'staff',
    true,
    staff_order::smallint
  from unnest(p_staff_names) with ordinality names(staff_name, staff_order);

  insert into public.audit_logs (
    camp_id,
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    p_camp_id,
    v_session.admin_account_id,
    'draft_setup_saved',
    'camp',
    p_camp_id,
    v_before,
    jsonb_build_object('group_count', v_group_count, 'staff_count', v_staff_count)
  );

  return jsonb_build_object(
    'ok', true,
    'group_count', v_group_count,
    'staff_count', v_staff_count
  );
end;
$$;

create or replace function public.activate_camp(p_camp_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_camp public.camps%rowtype;
  v_now timestamptz := clock_timestamp();
  v_staff_code text;
  v_public_code text;
  v_group_count integer;
  v_admin_count integer;
  v_staff_count integer;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACCESS_DENIED', 'message', 'ไม่มีสิทธิ์เปิดค่าย')
    );
  end if;

  select * into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;

  if not found or not exists (
    select 1
    from public.camp_members member
    where member.camp_id = p_camp_id
      and member.admin_account_id = v_session.admin_account_id
      and member.role = 'admin'
      and member.active
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACCESS_DENIED', 'message', 'ไม่มีสิทธิ์เปิดค่าย')
    );
  end if;

  if v_camp.status <> 'draft' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'CAMP_NOT_DRAFT', 'message', 'ค่ายนี้ไม่ได้อยู่ในสถานะ Draft')
    );
  end if;

  select count(*) into v_group_count
  from public.groups team
  where team.camp_id = p_camp_id and team.active;
  select count(*) into v_admin_count
  from public.camp_members member
  where member.camp_id = p_camp_id and member.role = 'admin' and member.active;
  select count(*) into v_staff_count
  from public.camp_members member
  where member.camp_id = p_camp_id and member.role = 'staff' and member.active;

  if v_group_count not between 1 and 30
    or v_admin_count < 1
    or v_staff_count < 1
    or not exists (
      select 1 from public.score_buttons button
      where button.camp_id = p_camp_id and button.enabled and button.amount > 0
    )
    or not exists (
      select 1 from public.score_buttons button
      where button.camp_id = p_camp_id and button.enabled and button.amount < 0
    )
    or not private.camp_integrity_is_valid(p_camp_id)
  then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACTIVATION_REQUIREMENTS', 'message', 'ข้อมูลค่ายยังไม่พร้อมเปิดใช้งาน')
    );
  end if;

  for v_attempt in 1..10 loop
    v_staff_code := private.random_human_code('ST-', 12);
    exit when not exists (
      select 1 from public.camps camp where camp.staff_join_code = v_staff_code
    );
  end loop;
  if exists (select 1 from public.camps camp where camp.staff_join_code = v_staff_code) then
    raise exception using errcode = '55000', message = 'could not allocate a unique Staff code';
  end if;

  for v_attempt in 1..10 loop
    v_public_code := private.random_human_code('LB-', 12);
    exit when not exists (
      select 1 from public.camps camp where camp.public_leaderboard_code = v_public_code
    );
  end loop;
  if exists (
    select 1 from public.camps camp where camp.public_leaderboard_code = v_public_code
  ) then
    raise exception using errcode = '55000', message = 'could not allocate a unique public code';
  end if;

  update public.groups
  set score_reached_at = v_now
  where camp_id = p_camp_id;

  update public.camps
  set
    status = 'active',
    staff_join_code = v_staff_code,
    public_leaderboard_code = v_public_code
  where id = p_camp_id
  returning * into v_camp;

  insert into public.audit_logs (
    camp_id,
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    p_camp_id,
    v_session.admin_account_id,
    'camp_activated',
    'camp',
    p_camp_id,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'active')
  );

  return jsonb_build_object(
    'ok', true,
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.name,
      'status', v_camp.status,
      'staff_join_code', v_camp.staff_join_code,
      'public_leaderboard_code', v_camp.public_leaderboard_code
    )
  );
end;
$$;

