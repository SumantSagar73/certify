-- SQL migration for certificates table (Supabase/Postgres)

create table if not exists public.certificates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  title text,
  issuing_authority text,
  issue_date date,
  expiry_date date,
  category text,
  notes text,
  is_private boolean default true,
  storage_path text not null,
  file_name text,
  file_size integer,
  mime_type text,
  created_at timestamptz default now()
);

create index if not exists certificates_user_id_idx on public.certificates(user_id);
create index if not exists certificates_created_at_idx on public.certificates(created_at desc);
