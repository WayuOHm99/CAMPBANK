begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.audit_logs (camp_id, action, entity_type)
values ('10000000-0000-4000-8000-000000000001', 'immutability_probe', 'camp');

select throws_ok(
  $$update public.audit_logs set reason = 'edited' where action = 'immutability_probe'$$,
  '55000', 'audit_logs records are immutable',
  'Audit content cannot be edited'
);

select throws_ok(
  $$update public.audit_logs set camp_id = null where action = 'immutability_probe'$$,
  '55000', 'audit_logs records are immutable',
  'Audit rows cannot be detached without the Draft deletion flag'
);

select set_config('eqcamp.detach_draft_audit', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$update public.audit_logs set camp_id = null, reason = 'edited' where action = 'immutability_probe'$$,
  '55000', 'audit_logs records are immutable',
  'The Draft deletion flag still forbids content changes'
);

select throws_ok(
  $$delete from public.audit_logs where action = 'immutability_probe'$$,
  '55000', 'audit_logs records are immutable',
  'Audit rows cannot be deleted'
);

select * from finish();
rollback;
