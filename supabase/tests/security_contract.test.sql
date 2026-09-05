begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, aud, role, is_anonymous, created_at, updated_at)
values
  (
    '70000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    true,
    clock_timestamp(),
    clock_timestamp()
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    true,
    clock_timestamp(),
    clock_timestamp()
  );

insert into public.access_sessions (
  auth_user_id,
  surface,
  admin_account_id,
  expires_at
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    'admin',
    '60000000-0000-4000-8000-000000000001',
    clock_timestamp() + interval '1 hour'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    'admin',
    '60000000-0000-4000-8000-000000000001',
    clock_timestamp() - interval '1 second'
  );

set local role authenticated;
set local "request.jwt.claim.sub" = '70000000-0000-4000-8000-000000000001';

select is(
  public.get_current_admin_session()->>'ok',
  'true',
  'an unrevoked Admin session before expires_at is accepted'
);

set local "request.jwt.claim.sub" = '70000000-0000-4000-8000-000000000002';

select is(
  public.get_current_admin_session()->'error'->>'code',
  'ACCESS_DENIED',
  'an Admin session after expires_at is rejected'
);

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.admin_accounts', 'SELECT')
  and not has_table_privilege('anon', 'public.admin_accounts', 'SELECT'),
  'normal client roles cannot read Admin Account rows'
);

select ok(
  not has_table_privilege('authenticated', 'public.transactions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.transactions', 'DELETE'),
  'authenticated clients cannot mutate immutable Score Transactions'
);

select ok(
  not has_table_privilege('anon', 'public.transactions', 'UPDATE')
  and not has_table_privilege('anon', 'public.transactions', 'DELETE'),
  'anonymous database clients cannot mutate immutable Score Transactions'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT')
  and not has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.audit_logs', 'DELETE'),
  'authenticated clients cannot forge or mutate Audit Log records'
);

select ok(
  not has_table_privilege('anon', 'public.audit_logs', 'INSERT')
  and not has_table_privilege('anon', 'public.audit_logs', 'UPDATE')
  and not has_table_privilege('anon', 'public.audit_logs', 'DELETE'),
  'anonymous database clients cannot forge or mutate Audit Log records'
);

select ok(
  (
    select bool_and(relrowsecurity)
    from pg_catalog.pg_class
    where oid in (
      'public.access_sessions'::regclass,
      'public.transactions'::regclass,
      'public.audit_logs'::regclass
    )
  ),
  'RLS remains enabled on sessions, transactions, and audit records'
);

select * from finish();

rollback;
