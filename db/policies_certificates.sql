-- Enable RLS and add row-level policies for the certificates table

-- Enable RLS
alter table public.certificates enable row level security;

-- Policy: allow authenticated users to INSERT rows where user_id = auth.uid()
create policy "certificates_insert_own" on public.certificates
  for insert
  with check ( auth.uid()::uuid = user_id );

-- Policy: allow authenticated users to SELECT their own rows
create policy "certificates_select_own" on public.certificates
  for select
  using ( auth.uid()::uuid = user_id );

-- Policy: allow authenticated users to UPDATE their own rows
create policy "certificates_update_own" on public.certificates
  for update
  using ( auth.uid()::uuid = user_id )
  with check ( auth.uid()::uuid = user_id );

-- Policy: allow authenticated users to DELETE their own rows
create policy "certificates_delete_own" on public.certificates
  for delete
  using ( auth.uid()::uuid = user_id );

-- Notes:
-- After applying these policies, database operations from the client must supply a valid
-- Supabase access token tied to an authenticated user (supabase client does this automatically
-- when a user is signed in). If you see "violates row-level security policy" while inserting,
-- ensure the insert payload includes user_id equal to the signed-in user's uid (auth.uid()).
