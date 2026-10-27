-- Run once in the existing Weather App project's SQL Editor before enabling user management.
-- Does not recreate tables or change branch/postcode data.
begin;
create or replace function public.protect_last_reporting_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(7301972401);
  if old.role = 'admin' and old.active then
    if tg_op = 'DELETE' then
      if not exists(select 1 from public.report_profiles where role = 'admin' and active and id <> old.id) then
        raise exception 'Keep at least one active admin';
      end if;
    elsif new.role <> 'admin' or not new.active then
      if not exists(select 1 from public.report_profiles where role = 'admin' and active and id <> old.id) then
        raise exception 'Keep at least one active admin';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_last_reporting_admin() from public, anon, authenticated;
drop trigger if exists protect_last_reporting_admin on public.report_profiles;
create trigger protect_last_reporting_admin before update or delete on public.report_profiles
for each row execute function public.protect_last_reporting_admin();
commit;
select 'Admin protection ready' as result;
