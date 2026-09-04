-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default.
-- Reset every application function to deny-by-default, then expose only the
-- Camp-scoped RPC surface used by authenticated (including anonymous-auth) clients.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- These helpers are referenced by RLS policies and reveal only access booleans.
grant execute on function private.has_active_staff_session(uuid) to authenticated;
grant execute on function private.has_active_admin_session(uuid) to authenticated;
grant execute on function private.has_active_public_session(uuid) to authenticated;
grant execute on function private.has_closed_staff_notice(uuid) to authenticated;
grant execute on function private.can_read_camp(uuid) to authenticated;
grant execute on function private.can_view_history(uuid) to authenticated;

grant execute on function public.get_staff_join_options(text) to authenticated;
grant execute on function public.join_staff_camp(text, uuid) to authenticated;
grant execute on function public.get_camp_snapshot(uuid) to authenticated;
grant execute on function public.apply_score_transaction(uuid, uuid, uuid, uuid, uuid, uuid)
to authenticated;

grant execute on function public.get_admin_login_options() to authenticated;
grant execute on function public.login_admin(uuid, text) to authenticated;
grant execute on function public.change_admin_pin(text, text) to authenticated;
grant execute on function public.get_current_admin_session() to authenticated;
grant execute on function public.logout_admin() to authenticated;
grant execute on function public.get_admin_camps() to authenticated;
grant execute on function public.create_draft_camp(text, text, date, integer)
to authenticated;
grant execute on function public.save_draft_setup(uuid, jsonb, text[])
to authenticated;
grant execute on function public.activate_camp(uuid) to authenticated;
grant execute on function public.get_admin_camp_snapshot(uuid) to authenticated;

grant execute on function public.quick_undo(uuid, uuid, uuid) to authenticated;
grant execute on function public.update_camp_budget(uuid, integer, integer, smallint, text)
to authenticated;
grant execute on function public.save_activity_configuration(uuid, jsonb)
to authenticated;
grant execute on function public.set_leaderboard_visibility(uuid, boolean)
to authenticated;
grant execute on function public.join_public_leaderboard(text) to authenticated;
grant execute on function public.get_leaderboard_snapshot(uuid) to authenticated;

grant execute on function public.get_transaction_history(
  uuid,
  integer,
  timestamptz,
  uuid,
  uuid,
  uuid,
  uuid,
  text
) to authenticated;
grant execute on function public.admin_adjust_score(uuid, uuid, integer, text, uuid, uuid)
to authenticated;
grant execute on function public.update_group_identity(uuid, uuid, text, text)
to authenticated;
grant execute on function public.add_staff_member(uuid, text) to authenticated;
grant execute on function public.set_camp_member_active(uuid, uuid, boolean)
to authenticated;
grant execute on function public.get_audit_log(uuid, integer, timestamptz, uuid)
to authenticated;
grant execute on function public.close_camp(uuid, text) to authenticated;

grant execute on function public.save_score_buttons(uuid, jsonb) to authenticated;
grant execute on function public.add_admin_to_camp(uuid, text, text) to authenticated;
grant execute on function public.reset_admin_pin(uuid, uuid, text, text)
to authenticated;
grant execute on function public.rotate_camp_access_code(uuid, text, text)
to authenticated;
grant execute on function public.update_camp_details(uuid, text, text, date)
to authenticated;

-- The first-Admin bootstrap remains server-only.
grant execute on function public.bootstrap_first_admin(text, text) to service_role;
