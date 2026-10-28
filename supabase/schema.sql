-- Esquema do painel de horários (Supabase). Rode uma vez em SQL Editor > New query.
-- Depois cadastre quem pode enviar planilhas (ver o último comando).

-- Quem é administrador (identificado pelo e-mail do login).
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;
drop policy if exists "admin lê a própria linha" on public.admins;
create policy "admin lê a própria linha" on public.admins
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Última versão dos horários publicada pelo painel (sempre a linha id = 1).
create table if not exists public.horarios_publicados (
  id int primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.horarios_publicados enable row level security;

drop policy if exists "qualquer pessoa lê os horários" on public.horarios_publicados;
create policy "qualquer pessoa lê os horários" on public.horarios_publicados
  for select to anon, authenticated
  using (true);

drop policy if exists "admins inserem horários" on public.horarios_publicados;
create policy "admins inserem horários" on public.horarios_publicados
  for insert to authenticated
  with check (exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email')));

drop policy if exists "admins atualizam horários" on public.horarios_publicados;
create policy "admins atualizam horários" on public.horarios_publicados
  for update to authenticated
  using (exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email')));

-- Cadastre os administradores (troque pelos e-mails reais, os mesmos dos usuários criados em Authentication > Users):
-- insert into public.admins (email) values ('presidente@exemplo.com'), ('tesoureiro@exemplo.com');
