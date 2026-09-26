-- Camp lifecycle tools: delete a never-activated Draft, archive a Closed Camp,
-- and duplicate any Camp's setup into a new Draft. Score history is never deleted.

alter table public.camps add column archived_at timestamptz;
alter table public.camps add constraint camps_archive_only_closed
  check (archived_at is null or status = 'closed');

-- Audit Logs stay immutable. The single exception detaches a deleted Draft's
-- setup entries from rows that no longer exist; content is never changed.
-- Only delete_draft_camp sets the transaction-local flag, and clients hold no
-- UPDATE privilege on audit_logs.
create or replace function private.reject_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'audit_logs'
    and tg_op = 'UPDATE'
    and old.camp_id is not null
    and current_setting('eqcamp.detach_draft_audit', true) = old.camp_id::text
    and new.camp_id is null
    and new.actor_member_id is null
    and (new.id, new.actor_admin_account_id, new.action, new.entity_type,
      new.entity_id, new.before_data, new.after_data, new.reason, new.created_at)
      is not distinct from
      (old.id, old.actor_admin_account_id, old.action, old.entity_type,
      old.entity_id, old.before_data, old.after_data, old.reason, old.created_at)
  then
    return new;
  end if;
  raise exception using
    errcode = '55000',
    message = format('%s records are immutable', tg_table_name);
end;
$$;

create or replace function private.caller_admin_for_camp(p_camp_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select session.admin_account_id
  from private.current_admin_session() session
  join public.camp_members member
    on member.camp_id = p_camp_id
    and member.admin_account_id = session.admin_account_id
    and member.role = 'admin'
    and member.active
  where not session.must_change_pin
  limit 1;
$$;
revoke all on function private.caller_admin_for_camp(uuid) from public, anon, authenticated;

create function public.delete_draft_camp(p_camp_id uuid, p_confirm_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.caller_admin_for_camp(p_camp_id);
  v_camp public.camps%rowtype;
begin
  if v_admin_id is null then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ลบค่ายนี้');
  end if;
  select * into v_camp from public.camps where id = p_camp_id for update;
  if v_camp.status <> 'draft'
    or exists (select 1 from public.transactions tx where tx.camp_id = p_camp_id)
  then
    return private.rpc_error('CAMP_NOT_DRAFT', 'ลบได้เฉพาะค่าย Draft ที่ยังไม่เคยเปิดใช้งาน');
  end if;
  if p_confirm_name is null or btrim(p_confirm_name) <> v_camp.name then
    return private.rpc_error('CONFIRM_NAME_MISMATCH', 'ชื่อค่ายที่พิมพ์ยืนยันไม่ตรงกัน');
  end if;

  -- Keep the setup trail, detached from rows that are about to disappear.
  perform set_config('eqcamp.detach_draft_audit', p_camp_id::text, true);
  update public.audit_logs
  set camp_id = null, actor_member_id = null
  where camp_id = p_camp_id;
  perform set_config('eqcamp.detach_draft_audit', '', true);
  insert into public.audit_logs (actor_admin_account_id, action, entity_type, entity_id, before_data)
  values (v_admin_id, 'draft_camp_deleted', 'camp', p_camp_id,
    jsonb_build_object('name', v_camp.name, 'code', v_camp.code, 'camp_date', v_camp.camp_date));

  delete from public.score_buttons where camp_id = p_camp_id;
  delete from public.activity_rounds
  where activity_id in (select id from public.activities where camp_id = p_camp_id);
  delete from public.activities where camp_id = p_camp_id;
  delete from public.groups where camp_id = p_camp_id;
  delete from public.camp_members where camp_id = p_camp_id;
  delete from public.camps where id = p_camp_id;

  return jsonb_build_object('ok', true, 'deleted_camp_id', p_camp_id);
end;
$$;

create function public.set_camp_archived(p_camp_id uuid, p_archived boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.caller_admin_for_camp(p_camp_id);
  v_camp public.camps%rowtype;
begin
  if v_admin_id is null then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์จัดการค่ายนี้');
  end if;
  select * into v_camp from public.camps where id = p_camp_id for update;
  if v_camp.status <> 'closed' then
    return private.rpc_error('CAMP_NOT_CLOSED', 'ปิดค่ายก่อนจึงเก็บเข้าคลังได้');
  end if;
  if (v_camp.archived_at is not null) = coalesce(p_archived, false) then
    return jsonb_build_object('ok', true, 'archived_at', v_camp.archived_at);
  end if;

  update public.camps
  set archived_at = case when p_archived then clock_timestamp() end,
      updated_at = clock_timestamp()
  where id = p_camp_id
  returning * into v_camp;
  insert into public.audit_logs (camp_id, actor_admin_account_id, action, entity_type, entity_id, after_data)
  values (p_camp_id, v_admin_id,
    case when p_archived then 'camp_archived' else 'camp_unarchived' end,
    'camp', p_camp_id, jsonb_build_object('archived_at', v_camp.archived_at));

  return jsonb_build_object('ok', true, 'archived_at', v_camp.archived_at);
end;
$$;

create function public.duplicate_camp(p_camp_id uuid, p_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.caller_admin_for_camp(p_camp_id);
  v_source public.camps%rowtype;
  v_created jsonb;
  v_new_id uuid;
begin
  if v_admin_id is null then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ทำสำเนาค่ายนี้');
  end if;
  select * into v_source from public.camps where id = p_camp_id;

  -- Reuse the normal creation path for code allocation, Admin membership and audit.
  v_created := public.create_draft_camp(p_name, coalesce(v_source.location_name, ''),
    v_source.camp_date, v_source.total_budget);
  if not coalesce((v_created->>'ok')::boolean, false) then
    return v_created;
  end if;
  v_new_id := (v_created->'camp'->>'id')::uuid;

  update public.camps
  set warning_amount = v_source.warning_amount,
      warning_percent = v_source.warning_percent,
      public_result_limit = v_source.public_result_limit
  where id = v_new_id;

  insert into public.groups (camp_id, color_key, color_name, color_hex, custom_name, sort_order)
  select v_new_id, team.color_key, team.color_name, team.color_hex, team.custom_name,
    row_number() over (order by team.sort_order)
  from public.groups team
  where team.camp_id = p_camp_id and team.active;

  insert into public.camp_members (camp_id, display_name, role, sort_order)
  select v_new_id, member.display_name, 'staff',
    row_number() over (order by member.sort_order, member.display_name)
  from public.camp_members member
  where member.camp_id = p_camp_id and member.role = 'staff' and member.active;

  delete from public.score_buttons where camp_id = v_new_id;
  insert into public.score_buttons (camp_id, label, amount, sort_order, enabled, requires_confirmation)
  select v_new_id, button.label, button.amount, button.sort_order, button.enabled,
    button.requires_confirmation
  from public.score_buttons button
  where button.camp_id = p_camp_id;

  insert into public.activities (camp_id, name, active, sort_order)
  select v_new_id, activity.name, activity.active, activity.sort_order
  from public.activities activity
  where activity.camp_id = p_camp_id;

  insert into public.activity_rounds (activity_id, label, sort_order, active)
  select copy.id, round.label, round.sort_order, round.active
  from public.activities source
  join public.activities copy
    on copy.camp_id = v_new_id and copy.sort_order = source.sort_order
  join public.activity_rounds round on round.activity_id = source.id
  where source.camp_id = p_camp_id;

  insert into public.audit_logs (camp_id, actor_admin_account_id, action, entity_type, entity_id, after_data)
  values (v_new_id, v_admin_id, 'camp_duplicated', 'camp', v_new_id,
    jsonb_build_object('source_camp_id', p_camp_id, 'source_name', v_source.name));

  return v_created;
end;
$$;

revoke all on function public.delete_draft_camp(uuid, text) from public, anon;
revoke all on function public.set_camp_archived(uuid, boolean) from public, anon;
revoke all on function public.duplicate_camp(uuid, text) from public, anon;
grant execute on function public.delete_draft_camp(uuid, text) to authenticated;
grant execute on function public.set_camp_archived(uuid, boolean) to authenticated;
grant execute on function public.duplicate_camp(uuid, text) to authenticated;

-- Expose archived_at to the Admin camp list and camp snapshot.

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
    return private.rpc_error('ACCESS_DENIED', 'กรุณาเข้าสู่ระบบ');
  end if;

  if v_session.must_change_pin then
    return private.rpc_error(
      'PIN_CHANGE_REQUIRED',
      'กรุณาเปลี่ยน PIN ชั่วคราวก่อน'
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
        'total_budget', camp.total_budget,
        'distributed_amount', camp.distributed_amount,
        'remaining_budget', camp.total_budget - camp.distributed_amount,
        'leaderboard_visible', camp.leaderboard_visible,
        'updated_at', camp.updated_at,
        'archived_at', camp.archived_at
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
      'archived_at', camp.archived_at,
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
