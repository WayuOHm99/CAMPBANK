alter table public.score_buttons
  drop constraint score_buttons_camp_order_unique,
  add constraint score_buttons_camp_order_unique
    unique (camp_id, sort_order) deferrable initially immediate;

create or replace function public.save_score_buttons(
  p_camp_id uuid,
  p_buttons jsonb
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
  v_item jsonb;
  v_button_id uuid;
  v_button_ids uuid[] := '{}'::uuid[];
  v_count integer;
  v_invalid_count integer;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ปุ่มคะแนน');
  end if;
  select camp.* into v_camp from public.camps camp where camp.id = p_camp_id for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ปุ่มคะแนน');
  end if;
  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;
  if p_buttons is null or jsonb_typeof(p_buttons) <> 'array' then
    return private.rpc_error('INVALID_BUTTONS', 'ข้อมูลปุ่มคะแนนไม่ถูกต้อง');
  end if;

  v_count := jsonb_array_length(p_buttons);
  if v_count < 1 then
    return private.rpc_error('INVALID_BUTTONS', 'ต้องมีปุ่มคะแนนอย่างน้อย 1 ปุ่ม');
  end if;
  select count(*) into v_invalid_count
  from jsonb_array_elements(p_buttons) item
  where item->>'label' is null
    or char_length(btrim(item->>'label')) not between 1 and 40
    or coalesce(item->>'amount', '') !~ '^-?[0-9]+$'
    or (item->>'amount')::numeric not between -2147483648 and 2147483647
    or (item->>'amount')::numeric = 0
    or coalesce(item->>'sort_order', '') !~ '^[0-9]+$';
  if v_invalid_count > 0
    or (select count(distinct (item->>'sort_order')::integer) from jsonb_array_elements(p_buttons) item) <> v_count
  then
    return private.rpc_error('INVALID_BUTTONS', 'ชื่อ จำนวน หรือลำดับปุ่มไม่ถูกต้อง');
  end if;

  set constraints public.score_buttons_camp_order_unique deferred;
  for v_item in select value from jsonb_array_elements(p_buttons) loop
    v_button_id := nullif(v_item->>'id', '')::uuid;
    if v_button_id is null then
      insert into public.score_buttons (
        camp_id,
        label,
        amount,
        sort_order,
        enabled
      ) values (
        p_camp_id,
        btrim(v_item->>'label'),
        (v_item->>'amount')::integer,
        (v_item->>'sort_order')::smallint,
        coalesce((v_item->>'enabled')::boolean, true)
      ) returning id into v_button_id;
    else
      update public.score_buttons
      set
        label = btrim(v_item->>'label'),
        amount = (v_item->>'amount')::integer,
        sort_order = (v_item->>'sort_order')::smallint,
        enabled = coalesce((v_item->>'enabled')::boolean, true)
      where id = v_button_id and camp_id = p_camp_id;
      if not found then
        return private.rpc_error('INVALID_BUTTON', 'ปุ่มคะแนนไม่อยู่ใน Camp นี้');
      end if;
    end if;
    v_button_ids := array_append(v_button_ids, v_button_id);
  end loop;

  delete from public.score_buttons button
  where button.camp_id = p_camp_id
    and not (button.id = any(v_button_ids))
    and not exists (
      select 1 from public.transactions tx where tx.score_button_id = button.id
    );
  update public.score_buttons button
  set enabled = false
  where button.camp_id = p_camp_id
    and not (button.id = any(v_button_ids));

  insert into public.audit_logs (
    camp_id,
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    p_camp_id,
    v_session.admin_account_id,
    'score_buttons_changed',
    'camp',
    p_camp_id,
    jsonb_build_object('button_count', v_count)
  );

  return jsonb_build_object('ok', true, 'button_count', v_count);
end;
$$;

create or replace function public.add_admin_to_camp(
  p_camp_id uuid,
  p_display_name text,
  p_temporary_pin text
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
  v_account public.admin_accounts%rowtype;
  v_member public.camp_members%rowtype;
  v_sort_order smallint;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เพิ่ม Admin');
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 80 then
    return private.rpc_error('INVALID_ADMIN_NAME', 'กรุณาระบุชื่อ Admin');
  end if;
  if p_temporary_pin is null or p_temporary_pin !~ '^[0-9]{4}$' then
    return private.rpc_error('INVALID_TEMPORARY_PIN', 'PIN ชั่วคราวต้องเป็นตัวเลข 4 หลัก');
  end if;

  select camp.* into v_camp from public.camps camp where camp.id = p_camp_id for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เพิ่ม Admin');
  end if;
  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;
  if exists (
    select 1 from public.admin_accounts account
    where lower(btrim(account.display_name)) = lower(btrim(p_display_name))
  ) then
    return private.rpc_error('ADMIN_NAME_EXISTS', 'ชื่อ Admin นี้มีในระบบแล้ว');
  end if;
  if exists (
    select 1 from public.camp_members member
    where member.camp_id = p_camp_id
      and lower(btrim(member.display_name)) = lower(btrim(p_display_name))
  ) then
    return private.rpc_error('MEMBER_NAME_EXISTS', 'ชื่อนี้มีอยู่ใน Camp แล้ว');
  end if;

  insert into public.admin_accounts (
    display_name,
    pin_hash,
    active,
    must_change_pin
  ) values (
    btrim(p_display_name),
    extensions.crypt(p_temporary_pin, extensions.gen_salt('bf', 12)),
    true,
    true
  ) returning * into v_account;

  select coalesce(max(member.sort_order), 0) + 1 into v_sort_order
  from public.camp_members member
  where member.camp_id = p_camp_id and member.role = 'admin';
  insert into public.camp_members (
    camp_id,
    admin_account_id,
    display_name,
    role,
    active,
    sort_order
  ) values (
    p_camp_id,
    v_account.id,
    v_account.display_name,
    'admin',
    true,
    v_sort_order
  ) returning * into v_member;

  insert into public.audit_logs (
    camp_id,
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    p_camp_id,
    v_session.admin_account_id,
    'admin_added',
    'admin_account',
    v_account.id,
    jsonb_build_object(
      'display_name', v_account.display_name,
      'must_change_pin', true,
      'membership_id', v_member.id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'admin', jsonb_build_object(
      'id', v_account.id,
      'display_name', v_account.display_name,
      'must_change_pin', true,
      'member_id', v_member.id
    )
  );
end;
$$;

create or replace function public.reset_admin_pin(
  p_camp_id uuid,
  p_admin_account_id uuid,
  p_temporary_pin text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_account public.admin_accounts%rowtype;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์รีเซ็ต PIN');
  end if;
  if p_temporary_pin is null or p_temporary_pin !~ '^[0-9]{4}$' then
    return private.rpc_error('INVALID_TEMPORARY_PIN', 'PIN ชั่วคราวต้องเป็นตัวเลข 4 หลัก');
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    return private.rpc_error('REASON_REQUIRED', 'กรุณาระบุเหตุผลการรีเซ็ต PIN');
  end if;
  if not exists (
    select 1 from public.camp_members member
    where member.camp_id = p_camp_id
      and member.admin_account_id = p_admin_account_id
      and member.role = 'admin'
  ) then
    return private.rpc_error('ADMIN_NOT_IN_CAMP', 'Admin ไม่ได้อยู่ใน Camp นี้');
  end if;

  select account.* into v_account
  from public.admin_accounts account
  where account.id = p_admin_account_id and account.active
  for update;
  if not found then
    return private.rpc_error('ADMIN_NOT_FOUND', 'ไม่พบ Admin นี้');
  end if;

  update public.admin_accounts
  set
    pin_hash = extensions.crypt(p_temporary_pin, extensions.gen_salt('bf', 12)),
    must_change_pin = true,
    failed_pin_attempts = 0,
    locked_until = null,
    last_failed_at = null
  where id = p_admin_account_id;

  update public.access_sessions
  set revoked_at = clock_timestamp(), revoked_reason = 'Admin PIN reset'
  where admin_account_id = p_admin_account_id and revoked_at is null;

  insert into public.audit_logs (
    camp_id,
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason
  ) values (
    p_camp_id,
    v_session.admin_account_id,
    'admin_pin_reset',
    'admin_account',
    p_admin_account_id,
    jsonb_build_object('must_change_pin', v_account.must_change_pin),
    jsonb_build_object('must_change_pin', true, 'sessions_revoked', true),
    btrim(p_reason)
  );

  return jsonb_build_object('ok', true, 'admin_account_id', p_admin_account_id);
end;
$$;

create or replace function public.rotate_camp_access_code(
  p_camp_id uuid,
  p_surface text,
  p_reason text
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
  v_code text;
  v_version integer;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เปลี่ยนลิงก์');
  end if;
  if p_surface not in ('staff', 'public') then
    return private.rpc_error('INVALID_SURFACE', 'ประเภทลิงก์ไม่ถูกต้อง');
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    return private.rpc_error('REASON_REQUIRED', 'กรุณาระบุเหตุผลการเปลี่ยนลิงก์');
  end if;

  select camp.* into v_camp from public.camps camp where camp.id = p_camp_id for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เปลี่ยนลิงก์');
  end if;
  if v_camp.status <> 'active' then
    return private.rpc_error(
      case when v_camp.status = 'closed' then 'CAMP_CLOSED' else 'CAMP_NOT_ACTIVE' end,
      case when v_camp.status = 'closed' then 'ค่ายนี้ปิดแล้ว' else 'ค่ายนี้ยังไม่เปิดใช้งาน' end
    );
  end if;

  for v_attempt in 1..10 loop
    v_code := private.random_human_code(
      case when p_surface = 'staff' then 'ST-' else 'LB-' end,
      12
    );
    exit when not exists (
      select 1 from public.camps camp
      where (p_surface = 'staff' and camp.staff_join_code = v_code)
        or (p_surface = 'public' and camp.public_leaderboard_code = v_code)
    );
  end loop;

  if p_surface = 'staff' then
    update public.camps
    set staff_join_code = v_code, staff_code_version = staff_code_version + 1
    where id = p_camp_id
    returning staff_code_version into v_version;
  else
    update public.camps
    set public_leaderboard_code = v_code, public_code_version = public_code_version + 1
    where id = p_camp_id
    returning public_code_version into v_version;
  end if;

  update public.access_sessions
  set revoked_at = clock_timestamp(), revoked_reason = 'Camp access code rotated'
  where camp_id = p_camp_id and surface = p_surface and revoked_at is null;

  insert into public.audit_logs (
    camp_id,
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  ) values (
    p_camp_id,
    v_session.admin_account_id,
    'camp_access_code_rotated',
    'camp',
    p_camp_id,
    jsonb_build_object('surface', p_surface, 'code_version', v_version),
    btrim(p_reason)
  );

  return jsonb_build_object(
    'ok', true,
    'surface', p_surface,
    'code', v_code,
    'code_version', v_version
  );
end;
$$;

grant execute on function public.save_score_buttons(uuid, jsonb) to authenticated;
grant execute on function public.add_admin_to_camp(uuid, text, text) to authenticated;
grant execute on function public.reset_admin_pin(uuid, uuid, text, text) to authenticated;
grant execute on function public.rotate_camp_access_code(uuid, text, text) to authenticated;
