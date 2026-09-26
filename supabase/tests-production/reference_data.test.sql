-- Run against a disposable database reset with --no-seed.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
select is((select count(*) from public.color_presets), 20::bigint,
  'migrations supply all required Group colors without Demo seed');
select is((select count(*) from public.admin_accounts), 0::bigint,
  'fresh production database has no Demo Admin');
select is((select count(*) from public.camps), 0::bigint,
  'fresh production database has no Demo Camp');
set local role anon;
select is((select count(*) from public.color_presets), 20::bigint,
  'public clients can read the reference colors through existing privileges and RLS');
reset role;
select * from finish();
rollback;
