begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_column(
  'public',
  'score_buttons',
  'requires_confirmation',
  'score_buttons exposes the confirmation flag'
);

select ok(
  (
    select column_info.data_type = 'boolean'
      and column_info.is_nullable = 'NO'
      and position('false' in lower(column_info.column_default)) > 0
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'score_buttons'
      and column_info.column_name = 'requires_confirmation'
  ),
  'the confirmation flag is a non-null boolean defaulting to false'
);

select results_eq(
  $$select count(*) from public.score_buttons where requires_confirmation$$,
  array[0::bigint],
  'existing and seeded Score Buttons remain one-tap by default'
);

select ok(
  (
    select routine.prosecdef and routine.provolatile = 's'
    from pg_catalog.pg_proc routine
    where routine.oid = 'public.get_camp_snapshot(uuid)'::regprocedure
  ),
  'get_camp_snapshot remains a stable security-definer function'
);

select ok(
  (
    select routine.prosecdef and routine.provolatile = 'v'
    from pg_catalog.pg_proc routine
    where routine.oid = 'public.save_score_buttons(uuid,jsonb)'::regprocedure
  ),
  'save_score_buttons remains a volatile security-definer function'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_camp_snapshot(uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.save_score_buttons(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated sessions may call both authorized RPC surfaces'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_camp_snapshot(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.save_score_buttons(uuid,jsonb)',
    'EXECUTE'
  ),
  'the anon database role cannot execute the protected RPCs directly'
);

select * from finish();

rollback;
