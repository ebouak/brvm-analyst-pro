-- supabase/migrations/0030_monthly_reports.sql
-- Monthly PDF reports for premium users
-- Sent automatically on the 1st of each month at 08h00 UTC

-- 1. Create monthly_reports table
create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'), -- YYYY-MM format validation
  report_url text, -- S3 or Vercel Blob URL
  report_json jsonb, -- Cached content (KPIs, narratives, signals, events)
  sent_at timestamptz, -- When email was sent to user
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month) -- One report per user per month
);

create index if not exists idx_monthly_reports_user_id on public.monthly_reports(user_id);
create index if not exists idx_monthly_reports_month on public.monthly_reports(month);
create index if not exists idx_monthly_reports_sent_at on public.monthly_reports(sent_at);

-- 2. RLS Policies

alter table public.monthly_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'monthly_reports'
    and policyname = 'Users can view own monthly_reports'
  ) then
    execute $policy$
      create policy "Users can view own monthly_reports"
        on public.monthly_reports for select
        using (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'monthly_reports'
    and policyname = 'Backend can insert monthly_reports'
  ) then
    execute $policy$
      create policy "Backend can insert monthly_reports"
        on public.monthly_reports for insert
        with check (true)
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'monthly_reports'
    and policyname = 'Backend can update monthly_reports'
  ) then
    execute $policy$
      create policy "Backend can update monthly_reports"
        on public.monthly_reports for update
        with check (true)
    $policy$;
  end if;
end $$;

-- 3. Trigger for updated_at

create or replace function public.update_monthly_reports_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trigger_monthly_reports_updated_at'
  ) then
    execute $trigger$
      create trigger trigger_monthly_reports_updated_at
      before update on public.monthly_reports
      for each row
      execute function public.update_monthly_reports_updated_at()
    $trigger$;
  end if;
end $$;

-- 4. View: published reports accessible to users (with sent_at timestamp)

create or replace view public.vw_monthly_reports_published as
select
  id,
  user_id,
  month,
  report_url,
  sent_at,
  created_at
from public.monthly_reports
where sent_at is not null
order by month desc;

comment on view public.vw_monthly_reports_published is
  'User-accessible published monthly reports (reports that have been sent)';

-- 5. View: reports pending generation (not sent yet)

create or replace view public.vw_monthly_reports_pending as
select
  id,
  user_id,
  month,
  created_at
from public.monthly_reports
where sent_at is null
order by created_at asc;

comment on view public.vw_monthly_reports_pending is
  'Reports created but not yet sent (for cron monitoring)';
