create or replace function public.get_transaction_history(
  p_camp_id uuid,
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_group_id uuid default null,
  p_member_id uuid default null,
  p_activity_id uuid default null,
  p_transaction_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_count integer;
  v_next_cursor jsonb;
begin
  if not private.can_view_history(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ดูประวัติค่ายนี้');
  end if;
  if p_limit not between 1 and 50 then
    return private.rpc_error('INVALID_PAGE_SIZE', 'โหลดได้ครั้งละไม่เกิน 50 รายการ');
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    return private.rpc_error('INVALID_CURSOR', 'ตัวชี้หน้าประวัติไม่ครบ');
  end if;
  if p_transaction_type is not null
    and p_transaction_type not in ('award', 'deduction', 'quick_undo', 'adjustment')
  then
    return private.rpc_error('INVALID_FILTER', 'ประเภทประวัติไม่ถูกต้อง');
  end if;

  with page as (
    select
      tx.id,
      tx.camp_id,
      tx.group_id,
      tx.member_id,
      tx.activity_id,
      tx.round_id,
      tx.amount,
      tx.transaction_type,
      tx.reverses_transaction_id,
      tx.adjusts_transaction_id,
      tx.reason,
      tx.group_color_name_snapshot,
      tx.group_color_hex_snapshot,
      tx.group_custom_name_snapshot,
      tx.actor_name_snapshot,
      tx.activity_name_snapshot,
      tx.round_label_snapshot,
      tx.created_at
    from public.transactions tx
    where tx.camp_id = p_camp_id
      and (p_group_id is null or tx.group_id = p_group_id)
      and (p_member_id is null or tx.member_id = p_member_id)
      and (p_activity_id is null or tx.activity_id = p_activity_id)
      and (p_transaction_type is null or tx.transaction_type = p_transaction_type)
      and (
        p_before_created_at is null
        or (tx.created_at, tx.id) < (p_before_created_at, p_before_id)
      )
    order by tx.created_at desc, tx.id desc
    limit p_limit
  )
  select
    coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc), '[]'::jsonb),
    count(*)::integer
  into v_items, v_count
  from page;

  if v_count = p_limit then
    v_next_cursor := jsonb_build_object(
      'created_at', v_items->(v_count - 1)->>'created_at',
      'id', v_items->(v_count - 1)->>'id'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'items', v_items,
    'next_cursor', v_next_cursor
  );
end;
$$;

create or replace function public.admin_adjust_score(
  p_camp_id uuid,
  p_group_id uuid,
  p_amount integer,
  p_reason text,
  p_adjusts_transaction_id uuid,
  p_client_action_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_session record;
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_action public.client_actions%rowtype;
  v_action_rows integer;
  v_camp public.camps%rowtype;
  v_group public.groups%rowtype;
  v_member public.camp_members%rowtype;
  v_now timestamptz;
  v_transaction_id uuid;
  v_result jsonb;
begin
  select * into v_session from private.current_admin_session();
  if v_auth_user_id is null or not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ปรับคะแนน');
  end if;
  if p_client_action_id is null then
    return private.rpc_error('INVALID_ACTION_ID', 'ไม่พบรหัสรายการจากอุปกรณ์');
  end if;
  if p_amount is null or p_amount = 0 then
    return private.rpc_error('INVALID_AMOUNT', 'จำนวนปรับคะแนนต้องไม่เป็น 0');
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    return private.rpc_error('REASON_REQUIRED', 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร');
  end if;
  if not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ปรับคะแนนในค่ายนี้');
  end if;

  v_payload := jsonb_build_object(
    'camp_id', p_camp_id,
    'group_id', p_group_id,
    'amount', p_amount,
    'reason', btrim(p_reason),
    'adjusts_transaction_id', p_adjusts_transaction_id
  );
  v_payload_hash := extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256');

  insert into public.client_actions (
    client_action_id,
    auth_user_id,
    camp_id,
    action,
    payload_hash
  ) values (
    p_client_action_id,
    v_auth_user_id,
    p_camp_id,
    'admin_adjust_score',
    v_payload_hash
  ) on conflict (client_action_id) do nothing;
  get diagnostics v_action_rows = row_count;

  if v_action_rows = 0 then
    select action.* into v_existing_action
    from public.client_actions action
    where action.client_action_id = p_client_action_id;
    if v_existing_action.auth_user_id <> v_auth_user_id
      or v_existing_action.camp_id <> p_camp_id
      or v_existing_action.action <> 'admin_adjust_score'
      or v_existing_action.payload_hash <> v_payload_hash
    then
      return private.rpc_error('IDEMPOTENCY_CONFLICT', 'คำขอซ้ำไม่ตรงกับรายการเดิม');
    end if;
    if v_existing_action.result is null then
      return private.rpc_error('ACTION_IN_PROGRESS', 'รายการนี้กำลังประมวลผล');
    end if;
    return v_existing_action.result;
  end if;

  select camp.* into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;
  if not found then
    v_result := private.rpc_error('CAMP_NOT_FOUND', 'ไม่พบค่ายนี้');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;
  if v_camp.status = 'draft' then
    v_result := private.rpc_error('CAMP_NOT_ACTIVE', 'ค่ายนี้ยังไม่เปิดใช้งาน');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;
  if not private.camp_integrity_is_valid(p_camp_id) then
    v_result := private.rpc_error('INTEGRITY_FAILURE', 'พบความผิดปกติของคะแนน กรุณาตรวจสอบก่อน');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  select member.* into v_member
  from public.camp_members member
  where member.camp_id = p_camp_id
    and member.admin_account_id = v_session.admin_account_id
    and member.role = 'admin'
    and member.active
  for share;
  if not found then
    v_result := private.rpc_error('ACCESS_DENIED', 'สิทธิ์ Admin ของค่ายนี้ไม่พร้อมใช้งาน');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  select team.* into v_group
  from public.groups team
  where team.id = p_group_id and team.camp_id = p_camp_id and team.active
  for update;
  if not found then
    v_result := private.rpc_error('GROUP_NOT_AVAILABLE', 'ไม่พบกลุ่มที่เลือก');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  if p_adjusts_transaction_id is not null then
    perform 1
    from public.transactions tx
    where tx.id = p_adjusts_transaction_id
      and tx.camp_id = p_camp_id
      and tx.group_id = p_group_id;
    if not found then
      v_result := private.rpc_error('INVALID_ADJUSTMENT_LINK', 'รายการเดิมไม่อยู่ในกลุ่มนี้');
      return private.complete_client_action(p_client_action_id, v_result);
    end if;
  end if;

  if p_amount > 0 and v_camp.total_budget - v_camp.distributed_amount < p_amount then
    v_result := private.rpc_error('INSUFFICIENT_BUDGET', 'งบค่ายไม่เพียงพอ');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;
  if p_amount < 0 and v_group.current_score + p_amount < 0 then
    v_result := private.rpc_error('INSUFFICIENT_GROUP_SCORE', 'คะแนนกลุ่มไม่พอสำหรับการปรับ');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  v_now := clock_timestamp();
  v_transaction_id := gen_random_uuid();
  insert into public.transactions (
    id,
    camp_id,
    group_id,
    member_id,
    amount,
    transaction_type,
    client_action_id,
    adjusts_transaction_id,
    reason,
    group_color_name_snapshot,
    group_color_hex_snapshot,
    group_custom_name_snapshot,
    actor_name_snapshot,
    created_at
  ) values (
    v_transaction_id,
    p_camp_id,
    p_group_id,
    v_member.id,
    p_amount,
    'adjustment',
    p_client_action_id,
    p_adjusts_transaction_id,
    btrim(p_reason),
    v_group.color_name,
    v_group.color_hex,
    v_group.custom_name,
    v_member.display_name,
    v_now
  );

  update public.groups
  set current_score = current_score + p_amount,
      score_reached_at = v_now
  where id = p_group_id
  returning * into v_group;
  update public.camps
  set distributed_amount = distributed_amount + p_amount
  where id = p_camp_id
  returning * into v_camp;

  if not private.camp_integrity_is_valid(p_camp_id) then
    raise exception using errcode = '23514', message = 'Camp integrity failed after Adjustment';
  end if;

  insert into public.audit_logs (
    camp_id,
    actor_admin_account_id,
    actor_member_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  ) values (
    p_camp_id,
    v_session.admin_account_id,
    v_member.id,
    'score_adjusted',
    'transaction',
    v_transaction_id,
    jsonb_build_object(
      'group_id', p_group_id,
      'amount', p_amount,
      'adjusts_transaction_id', p_adjusts_transaction_id
    ),
    btrim(p_reason)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'transaction', jsonb_build_object(
      'id', v_transaction_id,
      'amount', p_amount,
      'transaction_type', 'adjustment',
      'adjusts_transaction_id', p_adjusts_transaction_id,
      'created_at', v_now
    ),
    'group', jsonb_build_object(
      'id', v_group.id,
      'current_score', v_group.current_score,
      'score_reached_at', v_group.score_reached_at
    ),
    'camp', jsonb_build_object(
      'total_budget', v_camp.total_budget,
      'distributed_amount', v_camp.distributed_amount,
      'remaining_budget', v_camp.total_budget - v_camp.distributed_amount
    )
  );
  return private.complete_client_action(p_client_action_id, v_result);
end;
$$;

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
  if p_custom_name is null or char_length(btrim(p_custom_name)) not between 1 and 80 then
    return private.rpc_error('INVALID_GROUP_NAME', 'กรุณาระบุชื่อกลุ่ม');
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

create or replace function public.add_staff_member(
  p_camp_id uuid,
  p_display_name text
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
  v_member public.camp_members%rowtype;
  v_sort_order smallint;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เพิ่ม Staff');
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 80 then
    return private.rpc_error('INVALID_STAFF_NAME', 'กรุณาระบุชื่อ Staff');
  end if;

  select camp.* into v_camp from public.camps camp where camp.id = p_camp_id for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เพิ่ม Staff');
  end if;
  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;
  if exists (
    select 1 from public.camp_members member
    where member.camp_id = p_camp_id
      and lower(btrim(member.display_name)) = lower(btrim(p_display_name))
  ) then
    return private.rpc_error('MEMBER_NAME_EXISTS', 'ชื่อนี้มีอยู่ใน Camp แล้ว');
  end if;

  select coalesce(max(member.sort_order), 0) + 1
  into v_sort_order
  from public.camp_members member
  where member.camp_id = p_camp_id and member.role = 'staff';

  insert into public.camp_members (camp_id, display_name, role, active, sort_order)
  values (p_camp_id, btrim(p_display_name), 'staff', true, v_sort_order)
  returning * into v_member;

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
    'staff_added',
    'camp_member',
    v_member.id,
    jsonb_build_object('display_name', v_member.display_name, 'role', 'staff', 'active', true)
  );

  return jsonb_build_object(
    'ok', true,
    'member', jsonb_build_object(
      'id', v_member.id,
      'display_name', v_member.display_name,
      'role', v_member.role,
      'active', v_member.active,
      'sort_order', v_member.sort_order
    )
  );
end;
$$;

create or replace function public.set_camp_member_active(
  p_camp_id uuid,
  p_member_id uuid,
  p_active boolean
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
  v_member public.camp_members%rowtype;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้สมาชิก');
  end if;
  select camp.* into v_camp from public.camps camp where camp.id = p_camp_id for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้สมาชิก');
  end if;
  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;

  select member.* into v_member
  from public.camp_members member
  where member.id = p_member_id and member.camp_id = p_camp_id
  for update;
  if not found then
    return private.rpc_error('MEMBER_NOT_FOUND', 'ไม่พบสมาชิกนี้');
  end if;
  if not p_active and v_member.role = 'admin' and (
    select count(*) from public.camp_members member
    where member.camp_id = p_camp_id and member.role = 'admin' and member.active
  ) <= 1 then
    return private.rpc_error('LAST_ADMIN', 'ไม่สามารถปิด Admin คนสุดท้ายของ Camp');
  end if;

  update public.camp_members
  set active = p_active
  where id = p_member_id
  returning * into v_member;

  if not p_active then
    update public.access_sessions
    set revoked_at = clock_timestamp(), revoked_reason = 'Member disabled'
    where revoked_at is null
      and (
        member_id = p_member_id
        or (v_member.admin_account_id is not null and admin_account_id = v_member.admin_account_id)
      );
  end if;

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
    'camp_member_status_changed',
    'camp_member',
    p_member_id,
    jsonb_build_object('active', not p_active),
    jsonb_build_object('active', p_active, 'role', v_member.role)
  );

  return jsonb_build_object(
    'ok', true,
    'member', jsonb_build_object(
      'id', v_member.id,
      'display_name', v_member.display_name,
      'role', v_member.role,
      'active', v_member.active
    )
  );
end;
$$;

create or replace function public.get_audit_log(
  p_camp_id uuid,
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_count integer;
  v_next_cursor jsonb;
begin
  if not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ดู Audit Log');
  end if;
  if p_limit not between 1 and 50 then
    return private.rpc_error('INVALID_PAGE_SIZE', 'โหลดได้ครั้งละไม่เกิน 50 รายการ');
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    return private.rpc_error('INVALID_CURSOR', 'ตัวชี้หน้า Audit ไม่ครบ');
  end if;

  with page as (
    select
      audit.id,
      audit.camp_id,
      audit.actor_admin_account_id,
      audit.actor_member_id,
      coalesce(account.display_name, member.display_name, 'System') actor_name,
      audit.action,
      audit.entity_type,
      audit.entity_id,
      audit.before_data,
      audit.after_data,
      audit.reason,
      audit.created_at
    from public.audit_logs audit
    left join public.admin_accounts account on account.id = audit.actor_admin_account_id
    left join public.camp_members member on member.id = audit.actor_member_id
    where audit.camp_id = p_camp_id
      and (
        p_before_created_at is null
        or (audit.created_at, audit.id) < (p_before_created_at, p_before_id)
      )
    order by audit.created_at desc, audit.id desc
    limit p_limit
  )
  select
    coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc), '[]'::jsonb),
    count(*)::integer
  into v_items, v_count
  from page;

  if v_count = p_limit then
    v_next_cursor := jsonb_build_object(
      'created_at', v_items->(v_count - 1)->>'created_at',
      'id', v_items->(v_count - 1)->>'id'
    );
  end if;

  return jsonb_build_object('ok', true, 'items', v_items, 'next_cursor', v_next_cursor);
end;
$$;

create or replace function public.close_camp(
  p_camp_id uuid,
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
  v_now timestamptz := clock_timestamp();
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ปิดค่าย');
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    return private.rpc_error('REASON_REQUIRED', 'กรุณาระบุเหตุผลการปิดค่าย');
  end if;

  select camp.* into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ปิดค่าย');
  end if;
  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;
  if v_camp.status <> 'active' then
    return private.rpc_error('CAMP_NOT_ACTIVE', 'ปิดได้เฉพาะ Camp ที่ Active');
  end if;
  if not private.camp_integrity_is_valid(p_camp_id) then
    return private.rpc_error('INTEGRITY_FAILURE', 'พบความผิดปกติของคะแนน กรุณาตรวจสอบก่อนปิดค่าย');
  end if;

  update public.camps
  set status = 'closed', closed_at = v_now
  where id = p_camp_id
  returning * into v_camp;

  update public.access_sessions
  set revoked_at = v_now, revoked_reason = 'Camp closed'
  where camp_id = p_camp_id and surface = 'staff' and revoked_at is null;

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
    'camp_closed',
    'camp',
    p_camp_id,
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'closed', 'closed_at', v_now),
    btrim(p_reason)
  );

  return jsonb_build_object(
    'ok', true,
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'status', v_camp.status,
      'closed_at', v_camp.closed_at
    )
  );
end;
$$;

grant execute on function public.get_transaction_history(
  uuid, integer, timestamptz, uuid, uuid, uuid, uuid, text
) to authenticated;
grant execute on function public.admin_adjust_score(uuid, uuid, integer, text, uuid, uuid)
  to authenticated;
grant execute on function public.update_group_identity(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.add_staff_member(uuid, text) to authenticated;
grant execute on function public.set_camp_member_active(uuid, uuid, boolean) to authenticated;
grant execute on function public.get_audit_log(uuid, integer, timestamptz, uuid)
  to authenticated;
grant execute on function public.close_camp(uuid, text) to authenticated;
