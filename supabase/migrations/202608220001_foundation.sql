create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public
  revoke all on tables from public, anon, authenticated;

create table public.color_presets (
  key text primary key,
  name_th text not null,
  hex text not null,
  text_color text not null,
  sort_order smallint not null unique,
  constraint color_presets_key_format check (key ~ '^[a-z][a-z0-9_-]*$'),
  constraint color_presets_hex_format check (hex ~ '^#[0-9A-F]{6}$'),
  constraint color_presets_text_color_format check (text_color ~ '^#[0-9A-F]{6}$')
);

create table public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  pin_hash text not null,
  active boolean not null default true,
  must_change_pin boolean not null default true,
  failed_pin_attempts smallint not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint admin_accounts_display_name_length check (
    char_length(btrim(display_name)) between 1 and 80
  ),
  constraint admin_accounts_failed_attempts_nonnegative check (failed_pin_attempts >= 0)
);

create unique index admin_accounts_display_name_unique
  on public.admin_accounts (lower(btrim(display_name)));

create table public.camps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_name text,
  camp_date date not null,
  code text not null,
  status text not null default 'draft',
  total_budget integer not null,
  distributed_amount integer not null default 0,
  warning_amount integer,
  warning_percent smallint,
  leaderboard_visible boolean not null default false,
  staff_join_code text,
  public_leaderboard_code text,
  staff_code_version integer not null default 1,
  public_code_version integer not null default 1,
  created_by_admin_account_id uuid references public.admin_accounts(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  constraint camps_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint camps_code_length check (char_length(code) between 4 and 24),
  constraint camps_status check (status in ('draft', 'active', 'closed')),
  constraint camps_budget_positive check (total_budget > 0),
  constraint camps_distributed_amount_valid check (
    distributed_amount between 0 and total_budget
  ),
  constraint camps_warning_amount_nonnegative check (
    warning_amount is null or warning_amount >= 0
  ),
  constraint camps_warning_percent_range check (
    warning_percent is null or warning_percent between 0 and 100
  ),
  constraint camps_staff_code_length check (
    staff_join_code is null or char_length(staff_join_code) >= 12
  ),
  constraint camps_public_code_length check (
    public_leaderboard_code is null or char_length(public_leaderboard_code) >= 12
  ),
  constraint camps_closed_timestamp check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed' and closed_at is null)
  )
);

create unique index camps_code_unique on public.camps (lower(code));
create unique index camps_staff_join_code_unique
  on public.camps (staff_join_code)
  where staff_join_code is not null;
create unique index camps_public_leaderboard_code_unique
  on public.camps (public_leaderboard_code)
  where public_leaderboard_code is not null;

create table public.camp_members (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps(id) on delete restrict,
  admin_account_id uuid references public.admin_accounts(id) on delete restrict,
  display_name text not null,
  role text not null,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint camp_members_role check (role in ('admin', 'staff')),
  constraint camp_members_display_name_length check (
    char_length(btrim(display_name)) between 1 and 80
  ),
  constraint camp_members_admin_link check (
    (role = 'admin' and admin_account_id is not null)
    or (role = 'staff' and admin_account_id is null)
  )
);

create unique index camp_members_display_name_unique
  on public.camp_members (camp_id, lower(btrim(display_name)));
create unique index camp_members_admin_account_unique
  on public.camp_members (camp_id, admin_account_id)
  where admin_account_id is not null;
create index camp_members_camp_order_idx
  on public.camp_members (camp_id, role, sort_order, display_name);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps(id) on delete restrict,
  color_key text not null references public.color_presets(key) on delete restrict,
  color_name text not null,
  color_hex text not null,
  custom_name text not null,
  current_score integer not null default 0,
  score_reached_at timestamptz,
  active boolean not null default true,
  sort_order smallint not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint groups_custom_name_length check (
    char_length(btrim(custom_name)) between 1 and 80
  ),
  constraint groups_current_score_nonnegative check (current_score >= 0),
  constraint groups_color_hex_format check (color_hex ~ '^#[0-9A-F]{6}$'),
  constraint groups_camp_color_unique unique (camp_id, color_key),
  constraint groups_camp_order_unique unique (camp_id, sort_order)
);

create index groups_camp_active_order_idx
  on public.groups (camp_id, active, sort_order);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps(id) on delete restrict,
  name text not null,
  active boolean not null default true,
  sort_order smallint not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint activities_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint activities_camp_name_unique unique (camp_id, name),
  constraint activities_camp_order_unique unique (camp_id, sort_order)
);

create table public.activity_rounds (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete restrict,
  label text not null,
  sort_order smallint not null,
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint activity_rounds_label_length check (char_length(btrim(label)) between 1 and 80),
  constraint activity_rounds_activity_label_unique unique (activity_id, label),
  constraint activity_rounds_activity_order_unique unique (activity_id, sort_order)
);

create table public.score_buttons (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps(id) on delete restrict,
  label text not null,
  amount integer not null,
  sort_order smallint not null,
  enabled boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint score_buttons_label_length check (char_length(btrim(label)) between 1 and 40),
  constraint score_buttons_nonzero_amount check (amount <> 0),
  constraint score_buttons_camp_order_unique unique (camp_id, sort_order)
);

create table public.access_sessions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  surface text not null,
  camp_id uuid references public.camps(id) on delete cascade,
  member_id uuid references public.camp_members(id) on delete cascade,
  admin_account_id uuid references public.admin_accounts(id) on delete cascade,
  code_version integer,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint access_sessions_surface check (surface in ('admin', 'staff', 'public')),
  constraint access_sessions_shape check (
    (surface = 'staff' and camp_id is not null and member_id is not null
      and admin_account_id is null and code_version is not null)
    or (surface = 'public' and camp_id is not null and member_id is null
      and admin_account_id is null and code_version is not null)
    or (surface = 'admin' and member_id is null
      and admin_account_id is not null and code_version is null)
  )
);

create index access_sessions_active_lookup_idx
  on public.access_sessions (auth_user_id, camp_id, surface)
  where revoked_at is null;
create index access_sessions_member_idx on public.access_sessions (member_id);

create table public.client_actions (
  client_action_id uuid primary key,
  auth_user_id uuid not null,
  camp_id uuid not null references public.camps(id) on delete cascade
    deferrable initially deferred,
  action text not null,
  payload_hash bytea not null,
  result jsonb,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint client_actions_action_length check (char_length(action) between 1 and 80)
);

create index client_actions_camp_created_idx
  on public.client_actions (camp_id, created_at desc);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps(id) on delete restrict,
  group_id uuid not null references public.groups(id) on delete restrict,
  member_id uuid not null references public.camp_members(id) on delete restrict,
  activity_id uuid references public.activities(id) on delete restrict,
  round_id uuid references public.activity_rounds(id) on delete restrict,
  score_button_id uuid references public.score_buttons(id) on delete restrict,
  amount integer not null,
  transaction_type text not null,
  client_action_id uuid not null unique
    references public.client_actions(client_action_id) deferrable initially deferred,
  reverses_transaction_id uuid references public.transactions(id) on delete restrict,
  adjusts_transaction_id uuid references public.transactions(id) on delete restrict,
  reason text,
  group_color_name_snapshot text not null,
  group_color_hex_snapshot text not null,
  group_custom_name_snapshot text not null,
  actor_name_snapshot text not null,
  activity_name_snapshot text,
  round_label_snapshot text,
  created_at timestamptz not null default clock_timestamp(),
  constraint transactions_nonzero_amount check (amount <> 0),
  constraint transactions_type check (
    transaction_type in ('award', 'deduction', 'quick_undo', 'adjustment')
  ),
  constraint transactions_adjustment_reason check (
    transaction_type <> 'adjustment'
    or (reason is not null and char_length(btrim(reason)) >= 3)
  ),
  constraint transactions_undo_link check (
    transaction_type <> 'quick_undo' or reverses_transaction_id is not null
  )
);

create unique index transactions_single_quick_undo_idx
  on public.transactions (reverses_transaction_id)
  where transaction_type = 'quick_undo';
create index transactions_camp_history_idx
  on public.transactions (camp_id, created_at desc, id desc);
create index transactions_group_history_idx
  on public.transactions (camp_id, group_id, created_at desc, id desc);
create index transactions_member_history_idx
  on public.transactions (camp_id, member_id, created_at desc, id desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid references public.camps(id) on delete restrict,
  actor_admin_account_id uuid references public.admin_accounts(id) on delete restrict,
  actor_member_id uuid references public.camp_members(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default clock_timestamp(),
  constraint audit_logs_action_length check (char_length(action) between 1 and 100),
  constraint audit_logs_entity_type_length check (char_length(entity_type) between 1 and 80)
);

create index audit_logs_camp_created_idx
  on public.audit_logs (camp_id, created_at desc, id desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger admin_accounts_set_updated_at
before update on public.admin_accounts
for each row execute function private.set_updated_at();

create trigger camps_set_updated_at
before update on public.camps
for each row execute function private.set_updated_at();

create trigger camp_members_set_updated_at
before update on public.camp_members
for each row execute function private.set_updated_at();

create trigger groups_set_updated_at
before update on public.groups
for each row execute function private.set_updated_at();

create trigger activities_set_updated_at
before update on public.activities
for each row execute function private.set_updated_at();

create trigger activity_rounds_set_updated_at
before update on public.activity_rounds
for each row execute function private.set_updated_at();

create trigger score_buttons_set_updated_at
before update on public.score_buttons
for each row execute function private.set_updated_at();

create trigger access_sessions_set_updated_at
before update on public.access_sessions
for each row execute function private.set_updated_at();

create or replace function private.reject_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%s records are immutable', tg_table_name);
end;
$$;

create trigger transactions_are_immutable
before update or delete on public.transactions
for each row execute function private.reject_immutable_change();

create trigger audit_logs_are_immutable
before update or delete on public.audit_logs
for each row execute function private.reject_immutable_change();

create or replace function private.has_active_staff_session(p_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_sessions access
    join public.camps camp on camp.id = access.camp_id
    join public.camp_members member on member.id = access.member_id
    where access.auth_user_id = (select auth.uid())
      and access.surface = 'staff'
      and access.camp_id = p_camp_id
      and access.revoked_at is null
      and (access.expires_at is null or access.expires_at > clock_timestamp())
      and access.code_version = camp.staff_code_version
      and camp.status = 'active'
      and member.camp_id = camp.id
      and member.role = 'staff'
      and member.active
  );
$$;

create or replace function private.has_active_admin_session(p_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_sessions access
    join public.admin_accounts account on account.id = access.admin_account_id
    join public.camp_members member
      on member.camp_id = p_camp_id
      and member.admin_account_id = account.id
      and member.role = 'admin'
    where access.auth_user_id = (select auth.uid())
      and access.surface = 'admin'
      and access.revoked_at is null
      and access.expires_at > clock_timestamp()
      and account.active
      and member.active
  );
$$;

create or replace function private.has_active_public_session(p_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_sessions access
    join public.camps camp on camp.id = access.camp_id
    where access.auth_user_id = (select auth.uid())
      and access.surface = 'public'
      and access.camp_id = p_camp_id
      and access.revoked_at is null
      and (access.expires_at is null or access.expires_at > clock_timestamp())
      and access.code_version = camp.public_code_version
      and camp.leaderboard_visible
      and camp.status in ('active', 'closed')
  );
$$;

create or replace function private.has_closed_staff_notice(p_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_sessions access
    join public.camps camp on camp.id = access.camp_id
    join public.camp_members member on member.id = access.member_id
    where access.auth_user_id = (select auth.uid())
      and access.surface = 'staff'
      and access.camp_id = p_camp_id
      and access.revoked_at is not null
      and access.revoked_reason = 'Camp closed'
      and camp.status = 'closed'
      and member.camp_id = camp.id
      and member.role = 'staff'
  );
$$;

create or replace function private.can_read_camp(p_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_active_staff_session(p_camp_id)
    or private.has_active_admin_session(p_camp_id)
    or private.has_active_public_session(p_camp_id)
    or private.has_closed_staff_notice(p_camp_id);
$$;

create or replace function private.can_view_history(p_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_active_staff_session(p_camp_id)
    or private.has_active_admin_session(p_camp_id)
    or private.has_closed_staff_notice(p_camp_id);
$$;

create or replace function private.budget_warning_is_active(
  p_total_budget integer,
  p_distributed_amount integer,
  p_warning_amount integer,
  p_warning_percent smallint
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    (
      p_warning_amount is not null
      and p_total_budget - p_distributed_amount <= p_warning_amount
    )
    or (
      p_warning_percent is not null
      and (p_total_budget - p_distributed_amount)::bigint * 100
        <= p_total_budget::bigint * p_warning_percent
    );
$$;

create or replace function private.camp_integrity_is_valid(p_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.camps camp
    where camp.id = p_camp_id
      and camp.distributed_amount::bigint = coalesce(
        (
          select sum(team.current_score::bigint)
          from public.groups team
          where team.camp_id = p_camp_id
        ),
        0
      )
  ) and not exists (
    select 1
    from public.groups team
    left join (
      select tx.group_id, sum(tx.amount)::bigint as transaction_score
      from public.transactions tx
      where tx.camp_id = p_camp_id
      group by tx.group_id
    ) ledger on ledger.group_id = team.id
    where team.camp_id = p_camp_id
      and team.current_score::bigint <> coalesce(ledger.transaction_score, 0)
  ) and not exists (
    select 1
    from public.transactions tx
    join public.groups team on team.id = tx.group_id
    where (tx.camp_id = p_camp_id or team.camp_id = p_camp_id)
      and tx.camp_id <> team.camp_id
  );
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant select on public.color_presets to anon, authenticated;
grant select (
  id,
  name,
  location_name,
  camp_date,
  status,
  leaderboard_visible,
  updated_at,
  closed_at
) on public.camps to authenticated;
grant select on public.camp_members to authenticated;
grant select on public.groups to authenticated;
grant select on public.activities to authenticated;
grant select on public.activity_rounds to authenticated;
grant select on public.score_buttons to authenticated;
grant select on public.access_sessions to authenticated;
grant select on public.transactions to authenticated;
grant select on public.audit_logs to authenticated;

grant execute on function private.has_active_staff_session(uuid) to authenticated;
grant execute on function private.has_active_admin_session(uuid) to authenticated;
grant execute on function private.has_active_public_session(uuid) to authenticated;
grant execute on function private.has_closed_staff_notice(uuid) to authenticated;
grant execute on function private.can_read_camp(uuid) to authenticated;
grant execute on function private.can_view_history(uuid) to authenticated;

alter table public.color_presets enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.camps enable row level security;
alter table public.camp_members enable row level security;
alter table public.groups enable row level security;
alter table public.activities enable row level security;
alter table public.activity_rounds enable row level security;
alter table public.score_buttons enable row level security;
alter table public.access_sessions enable row level security;
alter table public.client_actions enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_logs enable row level security;

create policy color_presets_are_readable
on public.color_presets for select
to anon, authenticated
using (true);

create policy camps_are_scoped_to_active_access
on public.camps for select
to authenticated
using (private.can_read_camp(id));

create policy camp_members_are_admin_scoped
on public.camp_members for select
to authenticated
using (private.has_active_admin_session(camp_id));

create policy groups_are_scoped_to_active_access
on public.groups for select
to authenticated
using (private.can_read_camp(camp_id));

create policy activities_are_scoped_to_active_access
on public.activities for select
to authenticated
using (
  private.has_active_staff_session(camp_id)
  or private.has_active_admin_session(camp_id)
);

create policy activity_rounds_are_scoped_to_active_access
on public.activity_rounds for select
to authenticated
using (
  exists (
    select 1
    from public.activities activity
    where activity.id = activity_rounds.activity_id
      and (
        private.has_active_staff_session(activity.camp_id)
        or private.has_active_admin_session(activity.camp_id)
      )
  )
);

create policy score_buttons_are_scoped_to_active_access
on public.score_buttons for select
to authenticated
using (
  private.has_active_staff_session(camp_id)
  or private.has_active_admin_session(camp_id)
);

create policy access_sessions_are_visible_to_owner
on public.access_sessions for select
to authenticated
using (auth_user_id = (select auth.uid()));

create policy transactions_are_scoped_to_history_access
on public.transactions for select
to authenticated
using (private.can_view_history(camp_id));

create policy audit_logs_are_admin_scoped
on public.audit_logs for select
to authenticated
using (camp_id is not null and private.has_active_admin_session(camp_id));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'camps'
  ) then
    alter publication supabase_realtime add table public.camps;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'groups'
  ) then
    alter publication supabase_realtime add table public.groups;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;
end;
$$;
