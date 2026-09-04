alter table public.score_buttons
  add column requires_confirmation boolean not null default false;

comment on column public.score_buttons.requires_confirmation is
  'When true, field scoring surfaces must ask for explicit confirmation before applying this button.';

create or replace function public.get_camp_snapshot(p_camp_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_camp public.camps%rowtype;
  v_actor public.camp_members%rowtype;
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

  select member.*
  into v_actor
  from public.access_sessions access
  join public.camp_members member on member.id = access.member_id
  where access.auth_user_id = (select auth.uid())
    and access.surface = 'staff'
    and access.camp_id = v_camp.id
    and member.camp_id = v_camp.id
    and member.role = 'staff'
    and (
      (
        access.revoked_at is null
        and (access.expires_at is null or access.expires_at > statement_timestamp())
        and access.code_version = v_camp.staff_code_version
        and v_camp.status = 'active'
        and member.active
      )
      or (
        access.revoked_at is not null
        and access.revoked_reason = 'Camp closed'
        and v_camp.status = 'closed'
      )
    )
  order by access.created_at desc
  limit 1;

  if not found then
    select member.*
    into v_actor
    from public.access_sessions access
    join public.admin_accounts account on account.id = access.admin_account_id
    join public.camp_members member
      on member.camp_id = v_camp.id
      and member.admin_account_id = account.id
      and member.role = 'admin'
    where access.auth_user_id = (select auth.uid())
      and access.surface = 'admin'
      and access.revoked_at is null
      and access.expires_at > statement_timestamp()
      and account.active
      and member.active
    order by access.created_at desc
    limit 1;
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
        'requires_confirmation', button.requires_confirmation,
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
    'actor', case
      when v_actor.id is null then null
      else jsonb_build_object(
        'id', v_actor.id,
        'display_name', v_actor.display_name,
        'role', v_actor.role
      )
    end,
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
    or coalesce(item->>'sort_order', '') !~ '^[0-9]+$'
    or (
      item ? 'requires_confirmation'
      and jsonb_typeof(item->'requires_confirmation') <> 'boolean'
    );
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
        enabled,
        requires_confirmation
      ) values (
        p_camp_id,
        btrim(v_item->>'label'),
        (v_item->>'amount')::integer,
        (v_item->>'sort_order')::smallint,
        coalesce((v_item->>'enabled')::boolean, true),
        coalesce((v_item->>'requires_confirmation')::boolean, false)
      ) returning id into v_button_id;
    else
      update public.score_buttons
      set
        label = btrim(v_item->>'label'),
        amount = (v_item->>'amount')::integer,
        sort_order = (v_item->>'sort_order')::smallint,
        enabled = coalesce((v_item->>'enabled')::boolean, true),
        requires_confirmation = case
          when v_item ? 'requires_confirmation'
            then (v_item->>'requires_confirmation')::boolean
          else requires_confirmation
        end
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
    jsonb_build_object(
      'button_count', v_count,
      'confirmation_button_count', (
        select count(*)
        from public.score_buttons button
        where button.camp_id = p_camp_id
          and button.enabled
          and button.requires_confirmation
      )
    )
  );

  return jsonb_build_object('ok', true, 'button_count', v_count);
end;
$$;

revoke all on function public.get_camp_snapshot(uuid) from public, anon;
revoke all on function public.save_score_buttons(uuid, jsonb) from public, anon;
grant execute on function public.get_camp_snapshot(uuid) to authenticated;
grant execute on function public.save_score_buttons(uuid, jsonb) to authenticated;
