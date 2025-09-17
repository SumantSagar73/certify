-- Alternative RLS policies that use text comparison for auth.uid()
-- Useful if user_id is stored as uuid but auth.uid() or client value ends up as text.

alter table public.certificates enable row level security;

create policy "certificates_insert_own_text" on public.certificates
  for insert
  with check ( auth.uid() = user_id::text );

create policy "certificates_select_own_text" on public.certificates
  for select
  using ( auth.uid() = user_id::text );

create policy "certificates_update_own_text" on public.certificates
  for update
  using ( auth.uid() = user_id::text )
  with check ( auth.uid() = user_id::text );

create policy "certificates_delete_own_text" on public.certificates
  for delete
  using ( auth.uid() = user_id::text );

-- Note: pick one set of policies (uuid or text) to avoid conflicts. Remove the other if applying.
