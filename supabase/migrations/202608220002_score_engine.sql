create or replace function private.rpc_error(
  p_code text,
  p_message text,
  p_details jsonb default null
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'ok', false,
      'error', jsonb_strip_nulls(
        jsonb_build_object(
          'code', p_code,
          'message', p_message,
          'details', p_details
        )
      )
    )
  );
$$;

create or replace function private.complete_client_action(
  p_client_action_id uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.client_actions
  set result = p_result,
      completed_at = clock_timestamp()
  where client_action_id = p_client_action_id;

  return p_result;
end;
$$;

create or replace function public.get_staff_join_options(p_staff_join_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_camp public.camps%rowtype;
  v_members jsonb;
begin
  if (select auth.uid()) is null then
    return private.rpc_error('AUTH_REQUIRED', 'กรุณาเปิดลิงก์ค่ายอีกครั้ง');
  end if;

  select camp.*
  into v_camp
  from public.camps camp
  where camp.staff_join_code = p_staff_join_code;

  if not found then
    return private.rpc_error('INVALID_JOIN_LINK', 'ไม่พบลิงก์ค่ายนี้');
  end if;

  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;

  if v_camp.status <> 'active' then
    return private.rpc_error('CAMP_NOT_ACTIVE', 'ค่ายนี้ยังไม่เปิดใช้งาน');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'display_name', member.display_name,
        'sort_order', member.sort_order
      )
      order by member.sort_order, member.display_name, member.id
    ),
    '[]'::jsonb
  )
  into v_members
  from public.camp_members member
  where member.camp_id = v_camp.id
    and member.role = 'staff'
    and member.active;

  return jsonb_build_object(
    'ok', true,
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.name,
      'location_name', v_camp.location_name,
      'camp_date', v_camp.camp_date,
      'status', v_camp.status
    ),
    'staff', v_members
  );
end;
$$;

create or replace function public.join_staff_camp(
  p_staff_join_code text,
  p_member_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_camp public.camps%rowtype;
  v_member public.camp_members%rowtype;
  v_session_id uuid;
begin
  if v_auth_user_id is null then
    return private.rpc_error('AUTH_REQUIRED', 'กรุณาเปิดลิงก์ค่ายอีกครั้ง');
  end if;

  select camp.*
  into v_camp
  from public.camps camp
  where camp.staff_join_code = p_staff_join_code
  for share;

  if not found then
    return private.rpc_error('INVALID_JOIN_LINK', 'ไม่พบลิงก์ค่ายนี้');
  end if;

  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;

  if v_camp.status <> 'active' then
    return private.rpc_error('CAMP_NOT_ACTIVE', 'ค่ายนี้ยังไม่เปิดใช้งาน');
  end if;

  select member.*
  into v_member
  from public.camp_members member
  where member.id = p_member_id
    and member.camp_id = v_camp.id
    and member.role = 'staff'
    and member.active;

  if not found then
    return private.rpc_error('STAFF_NOT_AVAILABLE', 'ไม่พบชื่อ Staff ที่เลือก');
  end if;

  update public.access_sessions
  set revoked_at = clock_timestamp(),
      revoked_reason = 'Staff identity switched'
  where auth_user_id = v_auth_user_id
    and camp_id = v_camp.id
    and surface = 'staff'
    and revoked_at is null;

  insert into public.access_sessions (
    auth_user_id,
    surface,
    camp_id,
    member_id,
    code_version
  ) values (
    v_auth_user_id,
    'staff',
    v_camp.id,
    v_member.id,
    v_camp.staff_code_version
  )
  returning id into v_session_id;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'camp_id', v_camp.id,
    'member_id', v_member.id,
    'display_name', v_member.display_name
  );
end;
$$;

create or replace function public.get_camp_snapshot(p_camp_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_camp public.camps%rowtype;
  v_groups jsonb;
  v_buttons jsonb;
  v_activities jsonb;
  v_transactions jsonb := '[]'::jsonb;
begin
  if not (
    private.has_active_staff_session(p_camp_id)
    or private.has_active_admin_session(p_camp_id)
    or private.has_closed_staff_notice(p_camp_id)
  ) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ดูข้อมูลค่ายนี้');
  end if;

  select camp.*
  into v_camp
  from public.camps camp
  where camp.id = p_camp_id;

  if not found then
    return private.rpc_error('CAMP_NOT_FOUND', 'ไม่พบค่ายนี้');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', team.id,
        'color_key', team.color_key,
        'color_name', team.color_name,
        'color_hex', team.color_hex,
        'custom_name', team.custom_name,
        'current_score', team.current_score,
        'score_reached_at', team.score_reached_at,
        'sort_order', team.sort_order
      )
      order by team.sort_order, team.id
    ),
    '[]'::jsonb
  )
  into v_groups
  from public.groups team
  where team.camp_id = p_camp_id
    and team.active;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', button.id,
        'label', button.label,
        'amount', button.amount,
        'sort_order', button.sort_order
      )
      order by button.sort_order, button.id
    ),
    '[]'::jsonb
  )
  into v_buttons
  from public.score_buttons button
  where button.camp_id = p_camp_id
    and button.enabled;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', activity.id,
        'name', activity.name,
        'sort_order', activity.sort_order,
        'rounds', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', activity_round.id,
                'label', activity_round.label,
                'sort_order', activity_round.sort_order
              )
              order by activity_round.sort_order, activity_round.id
            )
            from public.activity_rounds activity_round
            where activity_round.activity_id = activity.id
              and activity_round.active
          ),
          '[]'::jsonb
        )
      )
      order by activity.sort_order, activity.id
    ),
    '[]'::jsonb
  )
  into v_activities
  from public.activities activity
  where activity.camp_id = p_camp_id
    and activity.active;

  if private.can_view_history(p_camp_id) then
    select coalesce(
      jsonb_agg(to_jsonb(history) order by history.created_at desc, history.id desc),
      '[]'::jsonb
    )
    into v_transactions
    from (
      select
        tx.id,
        tx.group_id,
        tx.member_id,
        tx.activity_id,
        tx.round_id,
        tx.amount,
        tx.transaction_type,
        tx.group_color_name_snapshot,
        tx.group_color_hex_snapshot,
        tx.group_custom_name_snapshot,
        tx.actor_name_snapshot,
        tx.activity_name_snapshot,
        tx.round_label_snapshot,
        tx.reverses_transaction_id,
        tx.adjusts_transaction_id,
        tx.reason,
        tx.created_at
      from public.transactions tx
      where tx.camp_id = p_camp_id
      order by tx.created_at desc, tx.id desc
      limit 50
    ) history;
  end if;

  return jsonb_build_object(
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.name,
      'location_name', v_camp.location_name,
      'camp_date', v_camp.camp_date,
      'status', v_camp.status,
      'total_budget', v_camp.total_budget,
      'distributed_amount', v_camp.distributed_amount,
      'remaining_budget', v_camp.total_budget - v_camp.distributed_amount,
      'warning_amount', v_camp.warning_amount,
      'warning_percent', v_camp.warning_percent,
      'warning_active', private.budget_warning_is_active(
        v_camp.total_budget,
        v_camp.distributed_amount,
        v_camp.warning_amount,
        v_camp.warning_percent
      ),
      'leaderboard_visible', v_camp.leaderboard_visible,
      'closed_at', v_camp.closed_at
    ),
    'groups', v_groups,
    'score_buttons', v_buttons,
    'activities', v_activities,
    'recent_transactions', v_transactions
  );
end;
$$;

create or replace function public.apply_score_transaction(
  p_camp_id uuid,
  p_group_id uuid,
  p_score_button_id uuid,
  p_activity_id uuid,
  p_round_id uuid,
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
  v_group public.groups%rowtype;
  v_member public.camp_members%rowtype;
  v_button public.score_buttons%rowtype;
  v_activity public.activities%rowtype;
  v_round public.activity_rounds%rowtype;
  v_now timestamptz;
  v_transaction_id uuid;
  v_result jsonb;
begin
  if v_auth_user_id is null then
    return private.rpc_error('AUTH_REQUIRED', 'กรุณาเข้าใช้งานค่ายอีกครั้ง');
  end if;

  if p_client_action_id is null then
    return private.rpc_error('INVALID_ACTION_ID', 'ไม่พบรหัสรายการจากอุปกรณ์');
  end if;

  if not (
    private.has_active_staff_session(p_camp_id)
    or private.has_active_admin_session(p_camp_id)
    or private.has_closed_staff_notice(p_camp_id)
  ) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ให้คะแนนในค่ายนี้');
  end if;

  v_payload := jsonb_build_object(
    'camp_id', p_camp_id,
    'group_id', p_group_id,
    'score_button_id', p_score_button_id,
    'activity_id', p_activity_id,
    'round_id', p_round_id
  );
  v_payload_hash := extensions.digest(
    convert_to(v_payload::text, 'UTF8'),
    'sha256'
  );

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
    'apply_score_transaction',
    v_payload_hash
  )
  on conflict (client_action_id) do nothing;

  get diagnostics v_action_rows = row_count;

  if v_action_rows = 0 then
    select action.*
    into v_existing_action
    from public.client_actions action
    where action.client_action_id = p_client_action_id;

    if v_existing_action.auth_user_id <> v_auth_user_id
      or v_existing_action.camp_id <> p_camp_id
      or v_existing_action.action <> 'apply_score_transaction'
      or v_existing_action.payload_hash <> v_payload_hash then
      return private.rpc_error(
        'IDEMPOTENCY_CONFLICT',
        'คำขอซ้ำมีข้อมูลไม่ตรงกับรายการเดิม'
      );
    end if;

    if v_existing_action.result is null then
      return private.rpc_error(
        'ACTION_IN_PROGRESS',
        'รายการนี้กำลังประมวลผล กรุณาลองใหม่ด้วยรหัสเดิม'
      );
    end if;

    return v_existing_action.result;
  end if;

  select camp.*
  into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;

  if not found then
    v_result := private.rpc_error('CAMP_NOT_FOUND', 'ไม่พบค่ายนี้');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  if v_camp.status <> 'active' then
    v_result := case
      when v_camp.status = 'closed'
        then private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว')
      else private.rpc_error('CAMP_NOT_ACTIVE', 'ค่ายนี้ยังไม่เปิดให้คะแนน')
    end;
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  select member.*
  into v_member
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
    select member.*
    into v_member
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
      and member.active
    order by access.created_at desc
    limit 1
    for share of access, account, member;
  end if;

  if not found then
    v_result := private.rpc_error('ACCESS_DENIED', 'สิทธิ์ใช้งานค่ายหมดอายุแล้ว');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  if not private.camp_integrity_is_valid(v_camp.id) then
    v_result := private.rpc_error(
      'INTEGRITY_FAILURE',
      'พบความผิดปกติของคะแนน กรุณาติดต่อ Admin'
    );
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  select team.*
  into v_group
  from public.groups team
  where team.id = p_group_id
    and team.camp_id = v_camp.id
    and team.active
  for update;

  if not found then
    v_result := private.rpc_error('GROUP_NOT_AVAILABLE', 'ไม่พบกลุ่มที่เลือก');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  select button.*
  into v_button
  from public.score_buttons button
  where button.id = p_score_button_id
    and button.camp_id = v_camp.id
    and button.enabled;

  if not found then
    v_result := private.rpc_error('SCORE_BUTTON_NOT_AVAILABLE', 'ปุ่มคะแนนนี้ปิดใช้งานแล้ว');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  if v_button.amount > 0
    and v_button.amount::bigint
      > (v_camp.total_budget - v_camp.distributed_amount)::bigint
  then
    v_result := private.rpc_error(
      'INSUFFICIENT_BUDGET',
      'งบคงเหลือไม่เพียงพอสำหรับคะแนนนี้'
    );
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  if v_button.amount < 0
    and v_group.current_score::bigint + v_button.amount::bigint < 0
  then
    v_result := private.rpc_error(
      'INSUFFICIENT_GROUP_SCORE',
      'คะแนนของกลุ่มไม่เพียงพอสำหรับการลดคะแนนนี้'
    );
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  if p_activity_id is not null then
    select activity.*
    into v_activity
    from public.activities activity
    where activity.id = p_activity_id
      and activity.camp_id = v_camp.id
      and activity.active;

    if not found then
      v_result := private.rpc_error('ACTIVITY_NOT_AVAILABLE', 'กิจกรรมนี้ปิดใช้งานแล้ว');
      return private.complete_client_action(p_client_action_id, v_result);
    end if;
  elsif p_round_id is not null then
    v_result := private.rpc_error('ROUND_REQUIRES_ACTIVITY', 'กรุณาเลือกกิจกรรมก่อนเลือกรอบ');
    return private.complete_client_action(p_client_action_id, v_result);
  end if;

  if p_round_id is not null then
    select activity_round.*
    into v_round
    from public.activity_rounds activity_round
    where activity_round.id = p_round_id
      and activity_round.activity_id = p_activity_id
      and activity_round.active;

    if not found then
      v_result := private.rpc_error('ROUND_NOT_AVAILABLE', 'รอบนี้ไม่อยู่ในกิจกรรมที่เลือก');
      return private.complete_client_action(p_client_action_id, v_result);
    end if;
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
    group_color_name_snapshot,
    group_color_hex_snapshot,
    group_custom_name_snapshot,
    actor_name_snapshot,
    activity_name_snapshot,
    round_label_snapshot,
    created_at
  ) values (
    v_transaction_id,
    v_camp.id,
    v_group.id,
    v_member.id,
    p_activity_id,
    p_round_id,
    v_button.id,
    v_button.amount,
    case when v_button.amount > 0 then 'award' else 'deduction' end,
    p_client_action_id,
    v_group.color_name,
    v_group.color_hex,
    v_group.custom_name,
    v_member.display_name,
    v_activity.name,
    v_round.label,
    v_now
  );

  update public.groups
  set current_score = current_score + v_button.amount,
      score_reached_at = v_now
  where id = v_group.id
  returning * into v_group;

  update public.camps
  set distributed_amount = distributed_amount + v_button.amount
  where id = v_camp.id
  returning * into v_camp;

  if not private.camp_integrity_is_valid(v_camp.id) then
    raise exception using
      errcode = '23514',
      message = 'Camp Score integrity invariant failed after Score Transaction';
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'transaction', jsonb_build_object(
      'id', v_transaction_id,
      'amount', v_button.amount,
      'transaction_type', case when v_button.amount > 0 then 'award' else 'deduction' end,
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

revoke all on function public.get_staff_join_options(text) from public, anon;
revoke all on function public.join_staff_camp(text, uuid) from public, anon;
revoke all on function public.apply_score_transaction(uuid, uuid, uuid, uuid, uuid, uuid)
  from public, anon;
revoke all on function public.get_camp_snapshot(uuid) from public, anon;

grant execute on function public.get_staff_join_options(text) to authenticated;
grant execute on function public.join_staff_camp(text, uuid) to authenticated;
grant execute on function public.apply_score_transaction(uuid, uuid, uuid, uuid, uuid, uuid)
  to authenticated;
grant execute on function public.get_camp_snapshot(uuid) to authenticated;
