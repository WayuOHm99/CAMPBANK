create or replace function public.quick_undo(
  p_camp_id uuid,
  p_transaction_id uuid,
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
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_action public.client_actions%rowtype;
  v_action_rows integer;
  v_camp public.camps%rowtype;
  v_member public.camp_members%rowtype;
  v_original public.transactions%rowtype;
  v_group public.groups%rowtype;
  v_amount integer;
  v_now timestamptz;
  v_transaction_id uuid;
  v_result jsonb;
begin
  if v_auth_user_id is null or p_client_action_id is null then
    return private.rpc_error('ACCESS_DENIED', 'กรุณาเข้าใช้งานค่ายอีกครั้ง');
  end if;

  if not (
    private.has_active_staff_session(p_camp_id)
    or private.has_active_admin_session(p_camp_id)
    or private.has_closed_staff_notice(p_camp_id)
  ) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ย้อนกลับรายการนี้');
  end if;

  v_payload := jsonb_build_object(
    'camp_id', p_camp_id,
    'transaction_id', p_transaction_id
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
    'quick_undo',
    v_payload_hash
  )
  on conflict (client_action_id) do nothing;
  get diagnostics v_action_rows = row_count;

  if v_action_rows = 0 then
    select action.* into v_existing_action
    from public.client_actions action
    where action.client_action_id = p_client_action_id;

    if v_existing_action.auth_user_id <> v_auth_user_id
      or v_existing_action.camp_id <> p_camp_id
      or v_existing_action.action <> 'quick_undo'
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

  if not found or v_camp.status <> 'active' then
    v_result := private.rpc_error(
      case when v_camp.status = 'closed' then 'CAMP_CLOSED' else 'CAMP_NOT_ACTIVE' end,
      case when v_camp.status = 'closed' then 'ค่ายนี้ปิดแล้ว' else 'ค่ายนี้ยังไม่เปิดใช้งาน' end
    );
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  select member.* into v_member
  from public.access_sessions access
  join public.camp_members member on member.id = access.member_id
  where access.auth_user_id = v_auth_user_id
    and access.surface = 'staff'
    and access.camp_id = v_camp.id
    and access.revoked_at is null
    and (access.expires_at is null or access.expires_at > clock_timestamp())
    and access.code_version = v_camp.staff_code_version
    and member.camp_id = v_camp.id
    and member.role = 'staff'
    and member.active
  order by access.created_at desc
  limit 1
  for share of access, member;

  if not found then
    select member.* into v_member
    from public.access_sessions access
    join public.admin_accounts account on account.id = access.admin_account_id
    join public.camp_members member
      on member.camp_id = v_camp.id
      and member.admin_account_id = account.id
      and member.role = 'admin'
    where access.auth_user_id = v_auth_user_id
      and access.surface = 'admin'
      and access.revoked_at is null
      and access.expires_at > clock_timestamp()
      and account.active
      and not account.must_change_pin
      and member.active
    order by access.created_at desc
    limit 1
    for share of access, account, member;
  end if;

  if not found then
    v_result := private.rpc_error('ACCESS_DENIED', 'สิทธิ์ใช้งานหมดอายุแล้ว');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  select tx.* into v_original
  from public.transactions tx
  where tx.camp_id = p_camp_id
    and tx.member_id = v_member.id
    and tx.transaction_type in ('award', 'deduction')
  order by tx.created_at desc, tx.id desc
  limit 1;

  if not found or v_original.id <> p_transaction_id then
    v_result := private.rpc_error('UNDO_NOT_LATEST', 'ย้อนกลับได้เฉพาะรายการล่าสุดของคุณ');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;
  if v_original.created_at < clock_timestamp() - interval '15 seconds' then
    v_result := private.rpc_error('UNDO_EXPIRED', 'หมดเวลาย้อนกลับรายการนี้แล้ว');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;
  if exists (
    select 1 from public.transactions tx
    where tx.reverses_transaction_id = v_original.id
      and tx.transaction_type = 'quick_undo'
  ) then
    v_result := private.rpc_error('ALREADY_UNDONE', 'รายการนี้ถูกย้อนกลับแล้ว');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;
  if not private.camp_integrity_is_valid(p_camp_id) then
    v_result := private.rpc_error('INTEGRITY_FAILURE', 'พบความผิดปกติของคะแนน กรุณาติดต่อ Admin');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  select team.* into v_group
  from public.groups team
  where team.id = v_original.group_id and team.camp_id = p_camp_id and team.active
  for update;

  if not found then
    v_result := private.rpc_error('GROUP_NOT_AVAILABLE', 'ไม่พบกลุ่มของรายการเดิม');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  v_amount := -v_original.amount;

  if v_amount > 0
    and v_amount::bigint
      > (v_camp.total_budget - v_camp.distributed_amount)::bigint
  then
    v_result := private.rpc_error(
      'INSUFFICIENT_BUDGET',
      'งบคงเหลือไม่เพียงพอสำหรับการย้อนกลับรายการนี้'
    );
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  if v_amount < 0
    and v_group.current_score::bigint + v_amount::bigint < 0
  then
    v_result := private.rpc_error(
      'INSUFFICIENT_GROUP_SCORE',
      'คะแนนของกลุ่มไม่เพียงพอสำหรับการย้อนกลับรายการนี้'
    );
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  v_now := clock_timestamp();
  v_transaction_id := gen_random_uuid();
  insert into public.transactions (
    id,
    camp_id,
    group_id,
    member_id,
    activity_id,
    round_id,
    score_button_id,
    amount,
    transaction_type,
    client_action_id,
    reverses_transaction_id,
    reason,
    group_color_name_snapshot,
    group_color_hex_snapshot,
    group_custom_name_snapshot,
    actor_name_snapshot,
    activity_name_snapshot,
    round_label_snapshot,
    created_at
  ) values (
    v_transaction_id,
    p_camp_id,
    v_original.group_id,
    v_member.id,
    v_original.activity_id,
    v_original.round_id,
    v_original.score_button_id,
    v_amount,
    'quick_undo',
    p_client_action_id,
    v_original.id,
    'Quick undo by original staff',
    v_original.group_color_name_snapshot,
    v_original.group_color_hex_snapshot,
    v_original.group_custom_name_snapshot,
    v_member.display_name,
    v_original.activity_name_snapshot,
    v_original.round_label_snapshot,
    v_now
  );

  update public.groups
  set current_score = current_score + v_amount,
      score_reached_at = v_now
  where id = v_group.id
  returning * into v_group;

  update public.camps
  set distributed_amount = distributed_amount + v_amount
  where id = v_camp.id
  returning * into v_camp;

  if not private.camp_integrity_is_valid(p_camp_id) then
    raise exception using errcode = '23514', message = 'Camp integrity failed after Quick Undo';
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'transaction', jsonb_build_object(
      'id', v_transaction_id,
      'amount', v_amount,
      'transaction_type', 'quick_undo',
      'reverses_transaction_id', v_original.id,
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
      'remaining_budget', v_camp.total_budget - v_camp.distributed_amount,
      'warning_active', private.budget_warning_is_active(
        v_camp.total_budget,
        v_camp.distributed_amount,
        v_camp.warning_amount,
        v_camp.warning_percent
      )
    )
  );

  return private.complete_client_action(p_client_action_id, v_result);
end;
$$;

create or replace function public.update_camp_budget(
  p_camp_id uuid,
  p_total_budget integer,
  p_warning_amount integer,
  p_warning_percent smallint,
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
  v_before jsonb;
  v_warning_active boolean;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ไขงบ');
  end if;

  select camp.* into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;

  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ไขงบ');
  end if;
  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;
  if p_total_budget is null or p_total_budget < v_camp.distributed_amount then
    return private.rpc_error(
      'INVALID_BUDGET',
      'งบใหม่ต้องไม่น้อยกว่าคะแนนที่แจกแล้ว',
      jsonb_build_object('distributed_amount', v_camp.distributed_amount)
    );
  end if;
  if p_warning_amount is not null and p_warning_amount < 0 then
    return private.rpc_error('INVALID_WARNING', 'จำนวนเงินเตือนต้องไม่ติดลบ');
  end if;
  if p_warning_percent is not null and p_warning_percent not between 0 and 100 then
    return private.rpc_error('INVALID_WARNING', 'เปอร์เซ็นต์เตือนต้องอยู่ระหว่าง 0–100');
  end if;
  if p_total_budget <> v_camp.total_budget
    and (p_reason is null or char_length(btrim(p_reason)) < 3)
  then
    return private.rpc_error('REASON_REQUIRED', 'กรุณาระบุเหตุผลการแก้งบ');
  end if;
  if not private.camp_integrity_is_valid(p_camp_id) then
    return private.rpc_error('INTEGRITY_FAILURE', 'พบความผิดปกติของคะแนน กรุณาตรวจสอบก่อนแก้งบ');
  end if;

  v_before := jsonb_build_object(
    'total_budget', v_camp.total_budget,
    'warning_amount', v_camp.warning_amount,
    'warning_percent', v_camp.warning_percent
  );

  update public.camps
  set
    total_budget = p_total_budget,
    warning_amount = p_warning_amount,
    warning_percent = p_warning_percent
  where id = p_camp_id
  returning * into v_camp;

  if not private.camp_integrity_is_valid(p_camp_id) then
    raise exception using errcode = '23514', message = 'Camp integrity failed after Budget update';
  end if;

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
    'budget_changed',
    'camp',
    p_camp_id,
    v_before,
    jsonb_build_object(
      'total_budget', v_camp.total_budget,
      'warning_amount', v_camp.warning_amount,
      'warning_percent', v_camp.warning_percent
    ),
    nullif(btrim(p_reason), '')
  );

  v_warning_active := private.budget_warning_is_active(
    v_camp.total_budget,
    v_camp.distributed_amount,
    v_camp.warning_amount,
    v_camp.warning_percent
  );

  return jsonb_build_object(
    'ok', true,
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'total_budget', v_camp.total_budget,
      'distributed_amount', v_camp.distributed_amount,
      'remaining_budget', v_camp.total_budget - v_camp.distributed_amount,
      'warning_amount', v_camp.warning_amount,
      'warning_percent', v_camp.warning_percent,
      'warning_active', v_warning_active
    )
  );
end;
$$;

alter table public.activities
  drop constraint activities_camp_name_unique,
  add constraint activities_camp_name_unique unique (camp_id, name) deferrable initially immediate,
  drop constraint activities_camp_order_unique,
  add constraint activities_camp_order_unique unique (camp_id, sort_order) deferrable initially immediate;

alter table public.activity_rounds
  drop constraint activity_rounds_activity_label_unique,
  add constraint activity_rounds_activity_label_unique unique (activity_id, label) deferrable initially immediate,
  drop constraint activity_rounds_activity_order_unique,
  add constraint activity_rounds_activity_order_unique unique (activity_id, sort_order) deferrable initially immediate;

create or replace function public.save_activity_configuration(
  p_camp_id uuid,
  p_activities jsonb
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
  v_round_item jsonb;
  v_activity_id uuid;
  v_round_id uuid;
  v_activity_ids uuid[] := '{}'::uuid[];
  v_round_ids uuid[] := '{}'::uuid[];
  v_activity_count integer;
  v_invalid_count integer;
  v_has_transactions boolean;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้กิจกรรม');
  end if;

  select camp.* into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้กิจกรรม');
  end if;
  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;
  if p_activities is null or jsonb_typeof(p_activities) <> 'array' then
    return private.rpc_error('INVALID_ACTIVITIES', 'ข้อมูลกิจกรรมไม่ถูกต้อง');
  end if;

  v_activity_count := jsonb_array_length(p_activities);
  select count(*) into v_invalid_count
  from jsonb_array_elements(p_activities) item
  where item->>'name' is null
    or char_length(btrim(item->>'name')) not between 1 and 100
    or coalesce(item->>'sort_order', '') !~ '^[0-9]+$'
    or jsonb_typeof(coalesce(item->'rounds', '[]'::jsonb)) <> 'array';
  if v_invalid_count > 0
    or (select count(distinct (item->>'sort_order')::integer) from jsonb_array_elements(p_activities) item) <> v_activity_count
  then
    return private.rpc_error('INVALID_ACTIVITIES', 'ชื่อหรือลำดับกิจกรรมไม่ถูกต้อง');
  end if;

  v_has_transactions := exists (
    select 1 from public.transactions tx where tx.camp_id = p_camp_id
  );

  set constraints public.activities_camp_name_unique deferred;
  set constraints public.activities_camp_order_unique deferred;
  set constraints public.activity_rounds_activity_label_unique deferred;
  set constraints public.activity_rounds_activity_order_unique deferred;

  if not v_has_transactions then
    delete from public.activity_rounds activity_round
    using public.activities activity
    where activity_round.activity_id = activity.id and activity.camp_id = p_camp_id;
    delete from public.activities where camp_id = p_camp_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_activities) loop
    v_activity_id := nullif(v_item->>'id', '')::uuid;
    if v_activity_id is null then
      insert into public.activities (camp_id, name, active, sort_order)
      values (
        p_camp_id,
        btrim(v_item->>'name'),
        coalesce((v_item->>'active')::boolean, true),
        (v_item->>'sort_order')::smallint
      ) returning id into v_activity_id;
    else
      update public.activities
      set
        name = btrim(v_item->>'name'),
        active = coalesce((v_item->>'active')::boolean, true),
        sort_order = (v_item->>'sort_order')::smallint
      where id = v_activity_id and camp_id = p_camp_id;
      if not found then
        return private.rpc_error('INVALID_ACTIVITY', 'กิจกรรมไม่อยู่ใน Camp นี้');
      end if;
    end if;
    v_activity_ids := array_append(v_activity_ids, v_activity_id);

    for v_round_item in
      select value from jsonb_array_elements(coalesce(v_item->'rounds', '[]'::jsonb))
    loop
      if v_round_item->>'label' is null
        or char_length(btrim(v_round_item->>'label')) not between 1 and 80
        or coalesce(v_round_item->>'sort_order', '') !~ '^[0-9]+$'
      then
        return private.rpc_error('INVALID_ROUNDS', 'ข้อมูลรอบไม่ถูกต้อง');
      end if;

      v_round_id := nullif(v_round_item->>'id', '')::uuid;
      if v_round_id is null then
        insert into public.activity_rounds (activity_id, label, sort_order, active)
        values (
          v_activity_id,
          btrim(v_round_item->>'label'),
          (v_round_item->>'sort_order')::smallint,
          coalesce((v_round_item->>'active')::boolean, true)
        ) returning id into v_round_id;
      else
        update public.activity_rounds
        set
          label = btrim(v_round_item->>'label'),
          sort_order = (v_round_item->>'sort_order')::smallint,
          active = coalesce((v_round_item->>'active')::boolean, true)
        where id = v_round_id and activity_id = v_activity_id;
        if not found then
          return private.rpc_error('INVALID_ROUND', 'รอบไม่อยู่ในกิจกรรมนี้');
        end if;
      end if;
      v_round_ids := array_append(v_round_ids, v_round_id);
    end loop;
  end loop;

  if v_has_transactions then
    update public.activity_rounds activity_round
    set active = false
    from public.activities activity
    where activity_round.activity_id = activity.id
      and activity.camp_id = p_camp_id
      and not (activity_round.id = any(v_round_ids));

    update public.activities
    set active = false
    where camp_id = p_camp_id and not (id = any(v_activity_ids));
  end if;

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
    'activities_changed',
    'camp',
    p_camp_id,
    jsonb_build_object('activity_count', v_activity_count)
  );

  return jsonb_build_object('ok', true, 'activity_count', v_activity_count);
end;
$$;

create or replace function public.set_leaderboard_visibility(
  p_camp_id uuid,
  p_visible boolean
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
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เปลี่ยนการแสดงอันดับ');
  end if;

  select camp.* into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เปลี่ยนการแสดงอันดับ');
  end if;
  if v_camp.status = 'draft' then
    return private.rpc_error('CAMP_NOT_ACTIVE', 'เปิดอันดับได้หลัง Activate Camp');
  end if;

  update public.camps
  set leaderboard_visible = p_visible
  where id = p_camp_id;

  if not p_visible then
    update public.access_sessions
    set
      revoked_at = clock_timestamp(),
      revoked_reason = 'Leaderboard hidden'
    where camp_id = p_camp_id and surface = 'public' and revoked_at is null;
  end if;

  if v_camp.leaderboard_visible is distinct from p_visible then
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
      'leaderboard_visibility_changed',
      'camp',
      p_camp_id,
      jsonb_build_object('leaderboard_visible', v_camp.leaderboard_visible),
      jsonb_build_object('leaderboard_visible', p_visible)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'camp_id', p_camp_id,
    'leaderboard_visible', p_visible
  );
end;
$$;

create or replace function public.join_public_leaderboard(p_public_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_camp public.camps%rowtype;
begin
  if v_auth_user_id is null then
    return private.rpc_error('AUTH_REQUIRED', 'กรุณาเปิดลิงก์อันดับอีกครั้ง');
  end if;

  select camp.* into v_camp
  from public.camps camp
  where camp.public_leaderboard_code = p_public_code;
  if not found then
    return private.rpc_error('INVALID_LEADERBOARD_LINK', 'ไม่พบลิงก์อันดับนี้');
  end if;
  if v_camp.status not in ('active', 'closed') or not v_camp.leaderboard_visible then
    return private.rpc_error('LEADERBOARD_HIDDEN', 'ยังไม่เปิดแสดงอันดับ');
  end if;

  update public.access_sessions
  set revoked_at = clock_timestamp(), revoked_reason = 'Public leaderboard changed'
  where auth_user_id = v_auth_user_id and surface = 'public' and revoked_at is null;

  insert into public.access_sessions (
    auth_user_id,
    surface,
    camp_id,
    code_version
  ) values (
    v_auth_user_id,
    'public',
    v_camp.id,
    v_camp.public_code_version
  );

  return jsonb_build_object('ok', true, 'camp_id', v_camp.id);
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
  ) ranking;

  return jsonb_build_object(
    'ok', true,
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.name,
      'location_name', v_camp.location_name,
      'status', v_camp.status,
      'leaderboard_visible', v_camp.leaderboard_visible
    ),
    'ranking', v_ranking
  );
end;
$$;

revoke execute on function private.budget_warning_is_active(integer, integer, integer, smallint)
  from public, anon, authenticated;

grant execute on function public.quick_undo(uuid, uuid, uuid) to authenticated;
grant execute on function public.update_camp_budget(uuid, integer, integer, smallint, text)
  to authenticated;
grant execute on function public.save_activity_configuration(uuid, jsonb) to authenticated;
grant execute on function public.set_leaderboard_visibility(uuid, boolean) to authenticated;
grant execute on function public.join_public_leaderboard(text) to authenticated;
grant execute on function public.get_leaderboard_snapshot(uuid) to authenticated;
