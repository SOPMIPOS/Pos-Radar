-- Run in the EXISTING project's SQL Editor. Keeps accounts and reports.
begin;
alter table public.report_profiles
  add column if not exists access_branches text[] not null default '{}',
  add column if not exists access_states text[] not null default '{}';
alter table public.report_profiles drop constraint if exists report_profiles_role_check;
alter table public.report_profiles drop constraint if exists report_profiles_check;
alter table public.report_profiles drop constraint if exists report_profiles_access_check;
alter table public.report_profiles add constraint report_profiles_role_check
  check (role in ('admin','staff','manager'));
alter table public.report_profiles add constraint report_profiles_access_check check (
  role='admin' or (role='staff' and branch is not null) or
  (role='manager' and branch is null and cardinality(access_branches)+cardinality(access_states)>0)
);

create or replace function public.validate_reporting_manager_access() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.role='manager' then
    if cardinality(new.access_branches)>200 or cardinality(new.access_states)>20 then
      raise exception 'Too many access assignments';
    end if;
    if exists(select 1 from unnest(new.access_branches) as x(name)
      where x.name is null or not exists(select 1 from public.report_branches b where b.name=x.name)) then
      raise exception 'Unknown manager branch';
    end if;
    if exists(select 1 from unnest(new.access_states) as x(state)
      where x.state is null or not exists(select 1 from public.report_branches b where b.state=x.state)) then
      raise exception 'Unknown manager state';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_reporting_manager_access() from public,anon,authenticated;
drop trigger if exists validate_reporting_manager_access on public.report_profiles;
create trigger validate_reporting_manager_access before insert or update on public.report_profiles
for each row execute function public.validate_reporting_manager_access();

create or replace function public.reporting_can_edit(branch_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.report_profiles p
    where p.id=(select auth.uid()) and p.active and (
      p.role='admin' or (p.role='staff' and p.branch=branch_name) or
      (p.role='manager' and (
        branch_name=any(p.access_branches) or exists(
          select 1 from public.report_branches b where b.name=branch_name and b.state=any(p.access_states)
        )
      ))
    )
  );
$$;
-- Existing report and photo policies already call reporting_can_edit().
notify pgrst, 'reload schema';
commit;
select 'Manager access ready' as result;
