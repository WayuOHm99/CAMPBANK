alter table public.groups
  drop constraint groups_custom_name_length;

alter table public.groups
  add constraint groups_custom_name_length check (
    char_length(btrim(custom_name)) between 0 and 80
  );

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
  if v_group_count not between 1 and 20 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'INVALID_GROUP_COUNT', 'message', 'ต้องมี 1–20 กลุ่ม')
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

  if v_group_count not between 1 and 20
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

revoke all on function public.save_draft_setup(uuid, jsonb, text[]) from public, anon;
revoke all on function public.activate_camp(uuid) from public, anon;
grant execute on function public.save_draft_setup(uuid, jsonb, text[]) to authenticated;
grant execute on function public.activate_camp(uuid) to authenticated;

create or replace function public.update_staff_group_name(
  p_camp_id uuid,
  p_group_id uuid,
  p_custom_name text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_camp public.camps%rowtype;
  v_actor_member_id uuid;
  v_group public.groups%rowtype;
  v_name text;
  v_previous_name text;
begin
  if p_custom_name is null then
    return private.rpc_error('INVALID_GROUP_NAME', 'ชื่อกลุ่มไม่ถูกต้อง');
  end if;

  v_name := btrim(p_custom_name);
  if char_length(v_name) > 80 then
    return private.rpc_error('INVALID_GROUP_NAME', 'ชื่อกลุ่มต้องไม่เกิน 80 ตัวอักษร');
  end if;

  select camp.*
  into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;

  if not found then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ชื่อกลุ่ม');
  end if;

  select member.id
  into v_actor_member_id
  from public.access_sessions access
  join public.camp_members member
    on member.id = access.member_id
    and member.camp_id = access.camp_id
  where access.auth_user_id = (select auth.uid())
    and access.surface = 'staff'
    and access.camp_id = p_camp_id
    and access.revoked_at is null
    and (access.expires_at is null or access.expires_at > clock_timestamp())
    and access.code_version = v_camp.staff_code_version
    and member.role = 'staff'
    and member.active
    and v_camp.status = 'active';

  if not found then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ชื่อกลุ่ม');
  end if;

  select team.*
  into v_group
  from public.groups team
  where team.id = p_group_id
    and team.camp_id = p_camp_id
    and team.active
  for update;

  if not found then
    return private.rpc_error('GROUP_NOT_FOUND', 'ไม่พบกลุ่มในค่ายนี้');
  end if;

  if v_group.custom_name = v_name then
    return jsonb_build_object(
      'ok', true,
      'group', jsonb_build_object(
        'id', v_group.id,
        'color_key', v_group.color_key,
        'color_name', v_group.color_name,
        'color_hex', v_group.color_hex,
        'custom_name', v_group.custom_name
      )
    );
  end if;

  v_previous_name := v_group.custom_name;
  update public.groups
  set custom_name = v_name
  where id = v_group.id
  returning * into v_group;

  insert into public.audit_logs (
    camp_id,
    actor_member_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    p_camp_id,
    v_actor_member_id,
    'staff_group_name_changed',
    'group',
    v_group.id,
    jsonb_build_object('custom_name', v_previous_name),
    jsonb_build_object('custom_name', v_name)
  );

  return jsonb_build_object(
    'ok', true,
    'group', jsonb_build_object(
      'id', v_group.id,
      'color_key', v_group.color_key,
      'color_name', v_group.color_name,
      'color_hex', v_group.color_hex,
      'custom_name', v_group.custom_name
    )
  );
end;
$$;

revoke all on function public.update_staff_group_name(uuid, uuid, text) from public, anon;
grant execute on function public.update_staff_group_name(uuid, uuid, text) to authenticated;

alter table public.camps
  add column public_result_limit smallint not null default 3,
  add constraint camps_public_result_limit check (public_result_limit in (3, 5, 10));

create or replace function public.set_public_result_limit(
  p_camp_id uuid,
  p_limit smallint
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
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เปลี่ยนช่วงผลสาธารณะ');
  end if;

  select camp.* into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เปลี่ยนช่วงผลสาธารณะ');
  end if;

  if p_limit is null or p_limit not in (3, 5, 10) then
    return private.rpc_error(
      'INVALID_PUBLIC_RESULT_LIMIT',
      'ช่วงผลสาธารณะต้องเป็น Top 3, Top 5 หรือ Top 10'
    );
  end if;

  update public.camps
  set public_result_limit = p_limit
  where id = p_camp_id;

  if v_camp.public_result_limit is distinct from p_limit then
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
      'public_result_limit_changed',
      'camp',
      p_camp_id,
      jsonb_build_object('public_result_limit', v_camp.public_result_limit),
      jsonb_build_object('public_result_limit', p_limit)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'camp_id', p_camp_id,
    'public_result_limit', p_limit
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
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ดูค่ายนี้');
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
      'total_budget', camp.total_budget,
      'distributed_amount', camp.distributed_amount,
      'remaining_budget', camp.total_budget - camp.distributed_amount,
      'warning_amount', camp.warning_amount,
      'warning_percent', camp.warning_percent,
      'leaderboard_visible', camp.leaderboard_visible,
      'public_result_limit', camp.public_result_limit,
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

  return coalesce(v_result, private.rpc_error('CAMP_NOT_FOUND', 'ไม่พบค่าย'));
end;
$$;

create or replace function public.get_leaderboard_snapshot(p_camp_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_camp public.camps%rowtype;
  v_is_admin boolean := private.has_active_admin_session(p_camp_id);
  v_is_public boolean := private.has_active_public_session(p_camp_id);
  v_ranking jsonb;
begin
  if not v_is_admin and not v_is_public then
    return private.rpc_error('ACCESS_DENIED', 'ยังไม่เปิดแสดงอันดับ');
  end if;

  select camp.* into v_camp from public.camps camp where camp.id = p_camp_id;
  if not found then
    return private.rpc_error('CAMP_NOT_FOUND', 'ไม่พบค่ายนี้');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rank', ranking.rank,
        'id', ranking.id,
        'color_name', ranking.color_name,
        'color_hex', ranking.color_hex,
        'custom_name', ranking.custom_name,
        'current_score', ranking.current_score,
        'score_reached_at', ranking.score_reached_at,
        'sort_order', ranking.sort_order
      ) order by ranking.rank
    ),
    '[]'::jsonb
  ) into v_ranking
  from (
    select
      row_number() over (
        order by team.current_score desc, team.score_reached_at asc, team.sort_order asc
      ) rank,
      team.id,
      team.color_name,
      team.color_hex,
      team.custom_name,
      team.current_score,
      team.score_reached_at,
      team.sort_order
    from public.groups team
    where team.camp_id = p_camp_id and team.active
  ) ranking
  where v_is_admin or ranking.rank <= v_camp.public_result_limit;

  return jsonb_build_object(
    'ok', true,
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.name,
      'location_name', v_camp.location_name,
      'status', v_camp.status,
      'leaderboard_visible', v_camp.leaderboard_visible,
      'public_result_limit', v_camp.public_result_limit
    ),
    'ranking', v_ranking
  );
end;
$$;

revoke all on function public.set_public_result_limit(uuid, smallint) from public, anon;
revoke all on function public.get_admin_camp_snapshot(uuid) from public, anon;
revoke all on function public.get_leaderboard_snapshot(uuid) from public, anon;
grant execute on function public.set_public_result_limit(uuid, smallint) to authenticated;
grant execute on function public.get_admin_camp_snapshot(uuid) to authenticated;
grant execute on function public.get_leaderboard_snapshot(uuid) to authenticated;

create or replace function public.update_group_identity(
  p_camp_id uuid,
  p_group_id uuid,
  p_color_key text,
  p_custom_name text
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
  v_group public.groups%rowtype;
  v_preset public.color_presets%rowtype;
  v_before jsonb;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ไขกลุ่ม');
  end if;
  if p_custom_name is null or char_length(btrim(p_custom_name)) > 80 then
    return private.rpc_error('INVALID_GROUP_NAME', 'ชื่อกลุ่มต้องไม่เกิน 80 ตัวอักษร');
  end if;

  select camp.* into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ไขกลุ่ม');
  end if;
  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;

  select team.* into v_group
  from public.groups team
  where team.id = p_group_id and team.camp_id = p_camp_id
  for update;
  if not found then
    return private.rpc_error('GROUP_NOT_FOUND', 'ไม่พบกลุ่มนี้');
  end if;

  select preset.* into v_preset
  from public.color_presets preset
  where preset.key = p_color_key;
  if not found then
    return private.rpc_error('INVALID_COLOR', 'ไม่พบสีที่เลือก');
  end if;
  if exists (
    select 1 from public.groups other
    where other.camp_id = p_camp_id
      and other.color_key = p_color_key
      and other.id <> p_group_id
  ) then
    return private.rpc_error('COLOR_ALREADY_USED', 'สีนี้ถูกใช้ใน Camp แล้ว');
  end if;

  v_before := jsonb_build_object(
    'color_key', v_group.color_key,
    'color_name', v_group.color_name,
    'color_hex', v_group.color_hex,
    'custom_name', v_group.custom_name
  );
  update public.groups
  set
    color_key = v_preset.key,
    color_name = v_preset.name_th,
    color_hex = v_preset.hex,
    custom_name = btrim(p_custom_name)
  where id = p_group_id
  returning * into v_group;

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
    'group_identity_changed',
    'group',
    p_group_id,
    v_before,
    jsonb_build_object(
      'color_key', v_group.color_key,
      'color_name', v_group.color_name,
      'color_hex', v_group.color_hex,
      'custom_name', v_group.custom_name
    )
  );

  return jsonb_build_object(
    'ok', true,
    'group', jsonb_build_object(
      'id', v_group.id,
      'color_key', v_group.color_key,
      'color_name', v_group.color_name,
      'color_hex', v_group.color_hex,
      'custom_name', v_group.custom_name
    )
  );
end;
$$;

revoke all on function public.update_group_identity(uuid, uuid, text, text) from public, anon;
grant execute on function public.update_group_identity(uuid, uuid, text, text) to authenticated;
