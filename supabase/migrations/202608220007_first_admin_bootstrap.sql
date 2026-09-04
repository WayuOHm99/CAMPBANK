create or replace function public.bootstrap_first_admin(
  p_display_name text,
  p_temporary_pin text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account public.admin_accounts%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    return private.rpc_error('ACCESS_DENIED', 'Server-only bootstrap');
  end if;
  if exists (select 1 from public.admin_accounts) then
    return private.rpc_error('FIRST_ADMIN_EXISTS', 'ระบบมี Admin แล้ว');
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 80 then
    return private.rpc_error('INVALID_ADMIN_NAME', 'กรุณาระบุชื่อ Admin');
  end if;
  if p_temporary_pin is null or p_temporary_pin !~ '^[0-9]{4}$' then
    return private.rpc_error('INVALID_TEMPORARY_PIN', 'PIN ชั่วคราวต้องเป็นตัวเลข 4 หลัก');
  end if;

  insert into public.admin_accounts (
    display_name,
    pin_hash,
    active,
    must_change_pin
  ) values (
    btrim(p_display_name),
    extensions.crypt(p_temporary_pin, extensions.gen_salt('bf', 12)),
    true,
    true
  ) returning * into v_account;

  insert into public.audit_logs (
    actor_admin_account_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    v_account.id,
    'first_admin_bootstrapped',
    'admin_account',
    v_account.id,
    jsonb_build_object(
      'display_name', v_account.display_name,
      'must_change_pin', true
    )
  );

  return jsonb_build_object(
    'ok', true,
    'admin', jsonb_build_object(
      'id', v_account.id,
      'display_name', v_account.display_name,
      'must_change_pin', true
    )
  );
end;
$$;

revoke execute on function public.bootstrap_first_admin(text, text)
  from public, anon, authenticated;
grant execute on function public.bootstrap_first_admin(text, text) to service_role;
