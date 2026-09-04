create or replace function public.update_camp_details(
  p_camp_id uuid,
  p_name text,
  p_location_name text,
  p_camp_date date
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
begin
  select * into v_session from private.current_admin_session();
  if not found or v_session.must_change_pin then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ไขรายละเอียดค่าย');
  end if;

  select camp.* into v_camp
  from public.camps camp
  where camp.id = p_camp_id
  for update;

  if not found or not private.has_active_admin_session(p_camp_id) then
    return private.rpc_error('ACCESS_DENIED', 'ไม่มีสิทธิ์แก้ไขรายละเอียดค่าย');
  end if;
  if v_camp.status = 'closed' then
    return private.rpc_error('CAMP_CLOSED', 'ค่ายนี้ปิดแล้ว');
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then
    return private.rpc_error('INVALID_CAMP_NAME', 'ชื่อค่ายต้องมี 1–120 ตัวอักษร');
  end if;
  if p_location_name is not null and char_length(btrim(p_location_name)) > 120 then
    return private.rpc_error('INVALID_LOCATION', 'ชื่อสถานที่ต้องไม่เกิน 120 ตัวอักษร');
  end if;
  if p_camp_date is null then
    return private.rpc_error('INVALID_CAMP_DATE', 'กรุณาระบุวันที่ค่าย');
  end if;

  v_before := jsonb_build_object(
    'name', v_camp.name,
    'location_name', v_camp.location_name,
    'camp_date', v_camp.camp_date
  );

  update public.camps
  set
    name = btrim(p_name),
    location_name = nullif(btrim(p_location_name), ''),
    camp_date = p_camp_date
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
    'camp_details_changed',
    'camp',
    p_camp_id,
    v_before,
    jsonb_build_object(
      'name', v_camp.name,
      'location_name', v_camp.location_name,
      'camp_date', v_camp.camp_date
    )
  );

  return jsonb_build_object(
    'ok', true,
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.name,
      'location_name', v_camp.location_name,
      'camp_date', v_camp.camp_date
    )
  );
end;
$$;

revoke execute on function public.update_camp_details(uuid, text, text, date)
from public, anon;
grant execute on function public.update_camp_details(uuid, text, text, date)
to authenticated;
