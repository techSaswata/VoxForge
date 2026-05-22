-- VoxForge AI Supabase bootstrap schema
-- NOTE: This script intentionally keeps tables unrestricted (RLS disabled + broad grants),
-- as requested. Do not use this security posture in production.

create extension if not exists pgcrypto;

-- =========================
-- Enum types
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'interview_type_enum') then
    create type public.interview_type_enum as enum ('DSA', 'Frontend', 'Backend', 'Fullstack', 'Cybersecurity', 'DevOps');
  end if;

  if not exists (select 1 from pg_type where typname = 'difficulty_enum') then
    create type public.difficulty_enum as enum ('Easy', 'Medium', 'Hard');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_status_enum') then
    create type public.session_status_enum as enum ('active', 'completed', 'abandoned');
  end if;

  if not exists (select 1 from pg_type where typname = 'question_status_enum') then
    create type public.question_status_enum as enum ('pending', 'active', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'overall_verdict_enum') then
    create type public.overall_verdict_enum as enum ('Strong Hire', 'Hire', 'Lean Hire', 'Lean No Hire', 'No Hire');
  end if;
end
$$;

-- =========================
-- Utility functions/triggers
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_session_question_count()
returns trigger
language plpgsql
as $$
begin
  new.question_count = new.num_questions;
  return new;
end;
$$;

create or replace function public.fill_question_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    select s.user_id into new.user_id
    from public.interview_sessions s
    where s.id = new.session_id;
  end if;
  return new;
end;
$$;

create or replace function public.sync_question_completion_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed'::public.question_status_enum then
    new.is_completed = true;
    if new.completed_at is null then
      new.completed_at = now();
    end if;
  else
    new.is_completed = false;
  end if;
  return new;
end;
$$;

-- =========================
-- Tables
-- =========================
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  total_interviews integer not null default 0,
  total_questions_solved integer not null default 0,
  average_score numeric(4,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interview_type public.interview_type_enum not null,
  difficulty public.difficulty_enum not null,
  topics text[] not null default '{}',
  num_questions integer not null default 1 check (num_questions > 0),
  -- Added because API reads this exact field in feedback route.
  question_count integer not null default 0,
  voice_id text not null default 'en-US-matthew',
  status public.session_status_enum not null default 'active',
  current_question_index integer not null default 0,
  messages jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  question_title text not null,
  question_description text not null,
  question_difficulty public.difficulty_enum not null default 'Medium',
  question_type text not null,
  constraints text[],
  examples jsonb,
  followup_guidelines jsonb,
  question_order integer not null check (question_order > 0),
  status public.question_status_enum not null default 'pending',
  followup_count integer not null default 0,
  user_answer text,
  user_code text,
  is_completed boolean not null default false,
  asked_at timestamptz not null default now(),
  completed_at timestamptz,
  time_spent_seconds integer,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  overall_score numeric(4,2) not null check (overall_score >= 0 and overall_score <= 10),
  overall_verdict public.overall_verdict_enum not null,
  summary text not null,
  strengths text[] not null default '{}',
  areas_for_improvement text[] not null default '{}',
  recommendations text[] not null default '{}',
  technical_skills_score numeric(4,2),
  technical_skills_feedback text,
  problem_solving_score numeric(4,2),
  problem_solving_feedback text,
  communication_score numeric(4,2),
  communication_feedback text,
  full_feedback_json jsonb,
  created_at timestamptz not null default now()
);

-- =========================
-- Indexes
-- =========================
create index if not exists idx_interview_sessions_user_id on public.interview_sessions(user_id);
create index if not exists idx_interview_sessions_user_created_at on public.interview_sessions(user_id, created_at desc);
create index if not exists idx_interview_sessions_status_created_at on public.interview_sessions(status, created_at);

create index if not exists idx_interview_questions_session_id on public.interview_questions(session_id);
create index if not exists idx_interview_questions_session_status on public.interview_questions(session_id, status);
create index if not exists idx_interview_questions_session_status_order on public.interview_questions(session_id, status, question_order);

create index if not exists idx_feedback_reports_user_id on public.feedback_reports(user_id);
create index if not exists idx_feedback_reports_user_created_at on public.feedback_reports(user_id, created_at desc);
create index if not exists idx_feedback_reports_session_id on public.feedback_reports(session_id);

-- =========================
-- Triggers
-- =========================
drop trigger if exists trg_user_profiles_set_updated_at on public.user_profiles;
create trigger trg_user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_interview_sessions_set_updated_at on public.interview_sessions;
create trigger trg_interview_sessions_set_updated_at
before update on public.interview_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_interview_sessions_sync_question_count on public.interview_sessions;
create trigger trg_interview_sessions_sync_question_count
before insert or update on public.interview_sessions
for each row
execute function public.sync_session_question_count();

drop trigger if exists trg_interview_questions_fill_user_id on public.interview_questions;
create trigger trg_interview_questions_fill_user_id
before insert on public.interview_questions
for each row
execute function public.fill_question_user_id();

drop trigger if exists trg_interview_questions_sync_completion on public.interview_questions;
create trigger trg_interview_questions_sync_completion
before insert or update on public.interview_questions
for each row
execute function public.sync_question_completion_fields();

-- =========================
-- View used by dashboard
-- =========================
create or replace view public.user_statistics as
select
  u.id as user_id,
  up.full_name,
  count(distinct s.id)::int as total_interviews,
  coalesce(round(avg(fr.overall_score)::numeric, 2), 0)::numeric(4,2) as average_score,
  count(distinct s.id)::int as total_sessions,
  count(distinct s.id) filter (where s.status = 'completed')::int as completed_sessions,
  count(q.id)::int as total_questions_attempted,
  count(q.id) filter (where q.status = 'completed')::int as questions_completed
from auth.users u
left join public.user_profiles up on up.id = u.id
left join public.interview_sessions s on s.user_id = u.id
left join public.interview_questions q on q.session_id = s.id
left join public.feedback_reports fr on fr.session_id = s.id
group by u.id, up.full_name;

-- =========================
-- Keep everything unrestricted (as requested)
-- =========================
alter table public.user_profiles disable row level security;
alter table public.interview_sessions disable row level security;
alter table public.interview_questions disable row level security;
alter table public.feedback_reports disable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;
