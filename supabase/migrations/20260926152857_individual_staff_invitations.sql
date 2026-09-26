-- Individual bearer invitations; codes are never exposed in public Camp rows.
create table private.staff_invitations (
  member_id uuid primary key references public.camp_members(id) on delete cascade,
  code text not null unique default encode(extensions.gen_random_bytes(24), 'hex')
);
alter table private.staff_invitations enable row level security;
revoke all on private.staff_invitations from public, anon, authenticated;

create function private.create_staff_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'staff' then
    insert into private.staff_invitations(member_id) values (new.id)
    on conflict (member_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.create_staff_invitation() from public, anon, authenticated;
create trigger camp_member_invitation
after insert on public.camp_members
for each row execute function private.create_staff_invitation();
insert into private.staff_invitations(member_id)
select id from public.camp_members where role = 'staff';

-- Previously issued shared-link sessions must not survive the access-model change.
update public.access_sessions
set revoked_at = clock_timestamp(), revoked_reason = 'Individual Staff invitations required'
where surface = 'staff' and revoked_at is null;

create or replace function public.get_staff_join_options(p_staff_join_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_camp public.camps%rowtype;
  v_member public.camp_members%rowtype;
begin
  if (select auth.uid()) is null then
    return private.rpc_error('AUTH_REQUIRED', 'กรุณาเปิดลิงก์เชิญอีกครั้ง');
  end if;
  select member.* into v_member from public.camp_members member
  join private.staff_invitations invite on invite.member_id = member.id
  where invite.code = p_staff_join_code and member.role = 'staff' and member.active;
  if not found then
    return private.rpc_error('INVALID_JOIN_LINK', 'ลิงก์เชิญไม่ถูกต้องหรือถูกยกเลิกแล้ว กรุณาขอลิงก์ใหม่จาก Admin');
  end if;
  select * into v_camp from public.camps where id = v_member.camp_id;
  if v_camp.status <> 'active' then
    return private.rpc_error(case when v_camp.status = 'closed' then 'CAMP_CLOSED' else 'CAMP_NOT_ACTIVE' end,
      case when v_camp.status = 'closed' then 'ค่ายนี้ปิดแล้ว' else 'ค่ายนี้ยังไม่เปิดใช้งาน' end);
  end if;
  return jsonb_build_object('ok', true,
    'camp', jsonb_build_object('id', v_camp.id, 'name', v_camp.name,
      'location_name', v_camp.location_name, 'camp_date', v_camp.camp_date, 'status', v_camp.status),
    'staff', jsonb_build_array(jsonb_build_object('id', v_member.id,
      'display_name', v_member.display_name, 'sort_order', v_member.sort_order)));
end;
$$;

create or replace function public.join_staff_camp(p_staff_join_code text, p_member_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_camp public.camps%rowtype;
  v_member public.camp_members%rowtype;
  v_session_id uuid;
begin
  if v_auth_user_id is null then
    return private.rpc_error('AUTH_REQUIRED', 'กรุณาเปิดลิงก์เชิญอีกครั้ง');
  end if;
  -- Camp-first locking matches scoring, closure and invitation rotation.
  select camp.* into v_camp from public.camps camp
  join public.camp_members member on member.camp_id = camp.id
  where member.id = p_member_id for share of camp;
  if not found then
    return private.rpc_error('INVALID_JOIN_LINK', 'ลิงก์เชิญไม่ถูกต้องหรือถูกยกเลิกแล้ว');
  end if;
  select member.* into v_member from public.camp_members member
  join private.staff_invitations invite on invite.member_id = member.id
  where member.id = p_member_id and invite.code = p_staff_join_code
    and member.role = 'staff' and member.active;
  if not found then
    return private.rpc_error('INVALID_JOIN_LINK', 'ลิงก์เชิญไม่ถูกต้องหรือถูกยกเลิกแล้ว');
  end if;
  if v_camp.status <> 'active' then
    return private.rpc_error(case when v_camp.status = 'closed' then 'CAMP_CLOSED' else 'CAMP_NOT_ACTIVE' end,
      case when v_camp.status = 'closed' then 'ค่ายนี้ปิดแล้ว' else 'ค่ายนี้ยังไม่เปิดใช้งาน' end);
  end if;
  update public.access_sessions set revoked_at = clock_timestamp(), revoked_reason = 'Staff identity switched'
  where auth_user_id = v_auth_user_id and camp_id = v_camp.id and surface = 'staff' and revoked_at is null;
  insert into public.access_sessions(auth_user_id, surface, camp_id, member_id, code_version)
  values (v_auth_user_id, 'staff', v_camp.id, v_member.id, v_camp.staff_code_version)
  returning id into v_session_id;
  return jsonb_build_object('ok', true, 'session_id', v_session_id, 'camp_id', v_camp.id,
    'member_id', v_member.id, 'display_name', v_member.display_name);
end;
$$;

create function public.get_staff_invitations(p_camp_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_session record;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์ดูลิงก์เชิญ');
  end if;
  return jsonb_build_object('ok', true, 'invitations', coalesce((
    select jsonb_agg(jsonb_build_object('member_id', member.id,
      'display_name', member.display_name, 'code', invite.code) order by member.sort_order, member.id)
    from public.camp_members member join private.staff_invitations invite on invite.member_id = member.id
    where member.camp_id = p_camp_id and member.role = 'staff' and member.active
  ), '[]'::jsonb));
end;
$$;

create function public.rotate_staff_invitation(p_camp_id uuid, p_member_id uuid, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_session record;
  v_camp public.camps%rowtype;
  v_code text;
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เปลี่ยนลิงก์เชิญ');
  end if;
  select * into v_camp from public.camps where id = p_camp_id for update;
  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์เปลี่ยนลิงก์เชิญ');
  end if;
  if v_camp.status <> 'active' then
    return private.rpc_error('CAMP_NOT_ACTIVE', 'ค่ายนี้ไม่ได้เปิดใช้งาน');
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    return private.rpc_error('REASON_REQUIRED', 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร');
  end if;
  if not exists(select 1 from public.camp_members where id = p_member_id and camp_id = p_camp_id
    and role = 'staff' and active) then
    return private.rpc_error('STAFF_NOT_AVAILABLE', 'ไม่พบ Staff ที่เปิดใช้งานในค่ายนี้');
  end if;
  update private.staff_invitations set code = encode(extensions.gen_random_bytes(24), 'hex')
  where member_id = p_member_id returning code into v_code;
  update public.access_sessions set revoked_at = clock_timestamp(), revoked_reason = 'Staff invitation rotated'
  where camp_id = p_camp_id and member_id = p_member_id and surface = 'staff' and revoked_at is null;
  insert into public.audit_logs(camp_id, actor_admin_account_id, action, entity_type, entity_id, after_data, reason)
  values(p_camp_id, v_session.admin_account_id, 'staff_invitation_rotated', 'camp_member', p_member_id,
    jsonb_build_object('sessions_revoked', true), btrim(p_reason));
  return jsonb_build_object('ok', true, 'member_id', p_member_id, 'code', v_code);
end;
$$;

revoke all on function public.get_staff_invitations(uuid) from public, anon;
revoke all on function public.rotate_staff_invitation(uuid, uuid, text) from public, anon;
grant execute on function public.get_staff_invitations(uuid) to authenticated;
grant execute on function public.rotate_staff_invitation(uuid, uuid, text) to authenticated;
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
  if p_surface is distinct from 'public' then
    return private.rpc_error('INVALID_SURFACE', 'กรุณาจัดการลิงก์ Staff แยกเป็นรายคน');
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


