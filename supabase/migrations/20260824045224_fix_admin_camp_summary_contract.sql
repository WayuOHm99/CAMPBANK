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

revoke all on function public.get_admin_camps() from public, anon;
grant execute on function public.get_admin_camps() to authenticated;
