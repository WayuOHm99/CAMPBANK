create or replace function private.current_admin_session()
returns table (
  admin_account_id uuid,
  display_name text,
  must_change_pin boolean,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    account.id,
    account.display_name,
    account.must_change_pin,
    access.expires_at
  from public.access_sessions access
  join public.admin_accounts account on account.id = access.admin_account_id
  where access.auth_user_id = (select auth.uid())
    and access.surface = 'admin'
    and access.revoked_at is null
    and access.expires_at > clock_timestamp()
    and account.active
  order by access.created_at desc
  limit 1;
$$;

create or replace function private.has_active_admin_session(p_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_sessions access
    join public.admin_accounts account on account.id = access.admin_account_id
    join public.camp_members member
      on member.camp_id = p_camp_id
      and member.admin_account_id = account.id
      and member.role = 'admin'
    where access.auth_user_id = (select auth.uid())
      and access.surface = 'admin'
      and access.revoked_at is null
      and access.expires_at > clock_timestamp()
      and account.active
      and not account.must_change_pin
      and member.active
  );
$$;

create or replace function private.random_human_code(
  p_prefix text,
  p_random_length integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text := coalesce(p_prefix, '');
begin
  if p_random_length < 1 or p_random_length > 64 then
    raise exception using errcode = '22023', message = 'invalid code length';
  end if;

  v_bytes := extensions.gen_random_bytes(p_random_length);
  for v_index in 0..p_random_length - 1 loop
    v_code := v_code || substr(
      v_alphabet,
      (get_byte(v_bytes, v_index) % char_length(v_alphabet)) + 1,
      1
    );
  end loop;

  return v_code;
end;
$$;

create or replace function public.get_admin_login_options()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'admins',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', account.id,
          'display_name', account.display_name
        )
        order by account.display_name
      ),
      '[]'::jsonb
    )
  )
  from public.admin_accounts account
  where account.active;
$$;

create or replace function public.login_admin(
  p_admin_account_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_account public.admin_accounts%rowtype;
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_failed_attempts integer;
  v_locked_until timestamptz;
  v_revoked_count integer := 0;
begin
  if v_auth_user_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'ACCESS_DENIED',
        'message', 'ไม่สามารถเข้าสู่ระบบได้'
      )
    );
  end if;

  select *
  into v_account
  from public.admin_accounts account
  where account.id = p_admin_account_id
  for update;

  if not found or not v_account.active then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'INVALID_CREDENTIALS',
        'message', 'ชื่อหรือ PIN ไม่ถูกต้อง'
      )
    );
  end if;

  if v_account.locked_until is not null and v_account.locked_until > v_now then
    insert into public.audit_logs (
      actor_admin_account_id,
      action,
      entity_type,
      entity_id,
      after_data
    ) values (
      v_account.id,
      'admin_login_locked',
      'admin_account',
      v_account.id,
      jsonb_build_object('locked', true)
    );

    return jsonb_build_object(
      'ok', false,
      'locked_until', v_account.locked_until,
      'error', jsonb_build_object(
        'code', 'ACCOUNT_LOCKED',
        'message', 'ลองใหม่อีกครั้งภายหลัง'
      )
    );
  end if;

  if p_pin is null
    or p_pin !~ '^[0-9]{4}$'
    or extensions.crypt(p_pin, v_account.pin_hash) <> v_account.pin_hash
  then
    v_failed_attempts := v_account.failed_pin_attempts + 1;
    v_locked_until := case
      when v_failed_attempts >= 5 then v_now + interval '15 minutes'
      else null
    end;

    update public.admin_accounts
    set
      failed_pin_attempts = v_failed_attempts,
      last_failed_at = v_now,
      locked_until = v_locked_until
    where id = v_account.id;

    insert into public.audit_logs (
      actor_admin_account_id,
      action,
      entity_type,
      entity_id,
      after_data
    ) values (
      v_account.id,
      case when v_locked_until is null then 'admin_login_failed' else 'admin_login_locked' end,
      'admin_account',
      v_account.id,
      jsonb_build_object(
        'failed_attempts', v_failed_attempts,
        'locked', v_locked_until is not null
      )
    );

    return jsonb_build_object(
      'ok', false,
      'locked_until', v_locked_until,
      'error', jsonb_build_object(
        'code', case when v_locked_until is null then 'INVALID_CREDENTIALS' else 'ACCOUNT_LOCKED' end,
        'message', case when v_locked_until is null then 'ชื่อหรือ PIN ไม่ถูกต้อง' else 'ลองใหม่อีกครั้งภายหลัง' end
      )
    );
  end if;

  update public.access_sessions
  set
    revoked_at = v_now,
    revoked_reason = 'Identity changed on this browser'
  where auth_user_id = v_auth_user_id
    and revoked_at is null;
  get diagnostics v_revoked_count = row_count;

  update public.admin_accounts
  set
    failed_pin_attempts = 0,
    last_failed_at = null,
    locked_until = null
  where id = v_account.id;

  v_expires_at := v_now + interval '12 hours';
  insert into public.access_sessions (
    auth_user_id,
    surface,
    admin_account_id,
    expires_at
  ) values (
    v_auth_user_id,
    'admin',
    v_account.id,
    v_expires_at
  );

  if v_revoked_count > 0 then
    insert into public.audit_logs (
      actor_admin_account_id,
      action,
      entity_type,
      entity_id,
      after_data
    ) values (
      v_account.id,
      'access_sessions_revoked',
      'access_session',
      null,
      jsonb_build_object('count', v_revoked_count, 'reason', 'identity_changed')
    );
  end if;

  insert into public.audit_logs (
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    v_account.id,
    'admin_login_success',
    'admin_account',
    v_account.id,
    jsonb_build_object('expires_at', v_expires_at)
  );

  return jsonb_build_object(
    'ok', true,
    'expires_at', v_expires_at,
    'admin', jsonb_build_object(
      'id', v_account.id,
      'display_name', v_account.display_name,
      'must_change_pin', v_account.must_change_pin
    )
  );
end;
$$;

create or replace function public.change_admin_pin(
  p_current_pin text,
  p_new_pin text
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
  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACCESS_DENIED', 'message', 'กรุณาเข้าสู่ระบบใหม่')
    );
  end if;

  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_NEW_PIN', 'message', 'PIN ใหม่ต้องเป็นตัวเลข 4 หลัก')
    );
  end if;

  select *
  into v_account
  from public.admin_accounts account
  where account.id = v_session.admin_account_id
    and account.active
  for update;

  if not found
    or p_current_pin is null
    or extensions.crypt(p_current_pin, v_account.pin_hash) <> v_account.pin_hash
  then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_CREDENTIALS', 'message', 'PIN ปัจจุบันไม่ถูกต้อง')
    );
  end if;

  if extensions.crypt(p_new_pin, v_account.pin_hash) = v_account.pin_hash then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'PIN_REUSE', 'message', 'กรุณาใช้ PIN ใหม่')
    );
  end if;

  update public.admin_accounts
  set
    pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
    must_change_pin = false,
    failed_pin_attempts = 0,
    last_failed_at = null,
    locked_until = null
  where id = v_account.id;

  insert into public.audit_logs (
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    v_account.id,
    'admin_pin_changed',
    'admin_account',
    v_account.id,
    jsonb_build_object('must_change_pin', v_account.must_change_pin),
    jsonb_build_object('must_change_pin', false)
  );

  return jsonb_build_object(
    'ok', true,
    'admin', jsonb_build_object(
      'id', v_account.id,
      'display_name', v_account.display_name,
      'must_change_pin', false
    )
  );
end;
$$;

create or replace function public.get_current_admin_session()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session record;
begin
  select * into v_session from private.current_admin_session();
  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACCESS_DENIED', 'message', 'กรุณาเข้าสู่ระบบ')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'expires_at', v_session.expires_at,
    'admin', jsonb_build_object(
      'id', v_session.admin_account_id,
      'display_name', v_session.display_name,
      'must_change_pin', v_session.must_change_pin
    )
  );
end;
$$;

create or replace function public.logout_admin()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_session from private.current_admin_session();
  if not found then
    return jsonb_build_object('ok', true);
  end if;

  update public.access_sessions
  set
    revoked_at = v_now,
    revoked_reason = 'Admin logout'
  where auth_user_id = (select auth.uid())
    and surface = 'admin'
    and revoked_at is null;

  insert into public.audit_logs (
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    v_session.admin_account_id,
    'admin_logout',
    'access_session',
    null,
    jsonb_build_object('revoked_at', v_now)
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_admin_camps()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_camps jsonb;
begin
  select * into v_session from private.current_admin_session();
  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACCESS_DENIED', 'message', 'กรุณาเข้าสู่ระบบ')
    );
  end if;

  if v_session.must_change_pin then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'PIN_CHANGE_REQUIRED', 'message', 'กรุณาเปลี่ยน PIN ชั่วคราวก่อน')
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', camp.id,
        'name', camp.name,
        'location_name', camp.location_name,
        'camp_date', camp.camp_date,
        'code', camp.code,
        'status', camp.status,
        'leaderboard_visible', camp.leaderboard_visible,
        'updated_at', camp.updated_at
      )
      order by camp.camp_date desc, camp.created_at desc
    ),
    '[]'::jsonb
  )
  into v_camps
  from public.camp_members member
  join public.camps camp on camp.id = member.camp_id
  where member.admin_account_id = v_session.admin_account_id
    and member.role = 'admin'
    and member.active;

  return jsonb_build_object(
    'ok', true,
    'admin', jsonb_build_object(
      'id', v_session.admin_account_id,
      'display_name', v_session.display_name
    ),
    'camps', v_camps
  );
end;
$$;

create or replace function public.create_draft_camp(
  p_name text,
  p_location_name text,
  p_camp_date date,
  p_total_budget integer
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
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACCESS_DENIED', 'message', 'ไม่มีสิทธิ์สร้างค่าย')
    );
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_NAME', 'message', 'กรุณาระบุชื่อค่าย')
    );
  end if;
  if p_total_budget is null or p_total_budget <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_BUDGET', 'message', 'งบค่ายต้องมากกว่า 0')
    );
  end if;
  for v_attempt in 1..10 loop
    v_code := private.random_human_code('EQ-', 10);
    exit when not exists (
      select 1 from public.camps camp where lower(camp.code) = lower(v_code)
    );
  end loop;
  if exists (select 1 from public.camps camp where lower(camp.code) = lower(v_code)) then
    raise exception using errcode = '55000', message = 'could not allocate a unique Camp code';
  end if;

  insert into public.camps (
    name,
    location_name,
    camp_date,
    code,
    status,
    total_budget,
    leaderboard_visible,
    created_by_admin_account_id
  ) values (
    btrim(p_name),
    nullif(btrim(p_location_name), ''),
    p_camp_date,
    v_code,
    'draft',
    p_total_budget,
    false,
    v_session.admin_account_id
  ) returning * into v_camp;

  insert into public.camp_members (
    camp_id,
    admin_account_id,
    display_name,
    role,
    sort_order
  ) values (
    v_camp.id,
    v_session.admin_account_id,
    v_session.display_name,
    'admin',
    1
  );

  insert into public.score_buttons (camp_id, label, amount, sort_order) values
    (v_camp.id, '-1,000', -1000, 1),
    (v_camp.id, '-500', -500, 2),
    (v_camp.id, '+500', 500, 3),
    (v_camp.id, '+1,000', 1000, 4);

  insert into public.audit_logs (
    camp_id,
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    v_camp.id,
    v_session.admin_account_id,
    'camp_created',
    'camp',
    v_camp.id,
    jsonb_build_object(
      'name', v_camp.name,
      'location_name', v_camp.location_name,
      'camp_date', v_camp.camp_date,
      'status', v_camp.status
    )
  );

  return jsonb_build_object(
    'ok', true,
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.name,
      'location_name', v_camp.location_name,
      'camp_date', v_camp.camp_date,
      'code', v_camp.code,
      'status', v_camp.status,
      'total_budget', v_camp.total_budget,
      'leaderboard_visible', v_camp.leaderboard_visible
    )
  );
end;
$$;

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
  if v_group_count not between 8 and 20 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_GROUP_COUNT', 'message', 'ต้องมี 8–20 กลุ่ม')
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
    or char_length(btrim(item->>'custom_name')) not between 1 and 80
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

  if v_group_count not between 8 and 20
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

create or replace function public.get_admin_camp_snapshot(p_camp_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_result jsonb;
begin
  select * into v_session from private.current_admin_session();
  if not found
    or v_session.must_change_pin
    or not exists (
      select 1
      from public.camp_members member
      where member.camp_id = p_camp_id
        and member.admin_account_id = v_session.admin_account_id
        and member.role = 'admin'
        and member.active
    )
  then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACCESS_DENIED', 'message', 'ไม่มีสิทธิ์ดูค่ายนี้')
    );
  end if;

  select jsonb_build_object(
    'ok', true,
    'camp', jsonb_build_object(
      'id', camp.id,
      'name', camp.name,
      'location_name', camp.location_name,
      'camp_date', camp.camp_date,
      'code', camp.code,
      'status', camp.status,
      'leaderboard_visible', camp.leaderboard_visible,
      'staff_join_code', camp.staff_join_code,
      'public_leaderboard_code', camp.public_leaderboard_code,
      'closed_at', camp.closed_at
    ),
    'groups', (
      select coalesce(jsonb_agg(to_jsonb(team) order by team.sort_order), '[]'::jsonb)
      from public.groups team where team.camp_id = camp.id
    ),
    'members', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', member.id,
            'display_name', member.display_name,
            'role', member.role,
            'active', member.active,
            'sort_order', member.sort_order,
            'admin_account_id', member.admin_account_id
          ) order by member.role, member.sort_order, member.display_name
        ),
        '[]'::jsonb
      )
      from public.camp_members member where member.camp_id = camp.id
    ),
    'score_buttons', (
      select coalesce(jsonb_agg(to_jsonb(button) order by button.sort_order), '[]'::jsonb)
      from public.score_buttons button where button.camp_id = camp.id
    ),
    'activities', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', activity.id,
            'name', activity.name,
            'active', activity.active,
            'sort_order', activity.sort_order,
            'rounds', (
              select coalesce(jsonb_agg(to_jsonb(activity_round) order by activity_round.sort_order), '[]'::jsonb)
              from public.activity_rounds activity_round
              where activity_round.activity_id = activity.id
            )
          ) order by activity.sort_order
        ),
        '[]'::jsonb
      )
      from public.activities activity where activity.camp_id = camp.id
    ),
    'transaction_count', (
      select count(*) from public.transactions tx where tx.camp_id = camp.id
    )
  )
  into v_result
  from public.camps camp
  where camp.id = p_camp_id;

  return coalesce(
    v_result,
    jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'CAMP_NOT_FOUND', 'message', 'ไม่พบค่าย')
    )
  );
end;
$$;

revoke execute on function private.current_admin_session() from public, anon, authenticated;
revoke execute on function private.random_human_code(text, integer) from public, anon, authenticated;

grant execute on function public.get_admin_login_options() to authenticated;
grant execute on function public.login_admin(uuid, text) to authenticated;
grant execute on function public.change_admin_pin(text, text) to authenticated;
grant execute on function public.get_current_admin_session() to authenticated;
grant execute on function public.logout_admin() to authenticated;
grant execute on function public.get_admin_camps() to authenticated;
grant execute on function public.create_draft_camp(text, text, date, integer) to authenticated;
grant execute on function public.save_draft_setup(uuid, jsonb, text[]) to authenticated;
grant execute on function public.activate_camp(uuid) to authenticated;
grant execute on function public.get_admin_camp_snapshot(uuid) to authenticated;
