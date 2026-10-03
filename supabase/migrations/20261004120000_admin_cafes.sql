-- Issue #43: base do admin — quem é admin, o que ele pode em `cafes`, e
-- `atualizado_em` mantido pelo banco.
--
-- A RLS é a garantia real do admin; o middleware e o `requireAdmin` do app só
-- cuidam da experiência. Nada aqui depende de "estar autenticado": toda
-- política confere `private.is_admin()`.

-- Schema fora da API (não está em `[api].schemas`): funções auxiliares da RLS.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Admin = papel de admin no banco + segundo fator nesta sessão + sessão viva.
--
-- * O papel vem de `auth.users.raw_app_meta_data` (o `app_metadata`), que só o
--   service role altera — nunca de `user_metadata`, que o próprio usuário edita.
--   Lido do banco, e não do JWT, para que tirar o papel valha na hora.
-- * `aal2`: senha sozinha não basta, o TOTP é obrigatório.
-- * A sessão do JWT ainda existe: depois do "Sair" (global), um access token
--   roubado deixa de valer aqui na hora, não só quando expira (1 h).
-- * Usuário banido ou apagado não passa.
--
-- `security definer` porque `authenticated` não lê `auth.sessions`/`auth.users`;
-- `search_path` vazio para ninguém sequestrar um nome não qualificado.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from auth.sessions s
      join auth.users u on u.id = s.user_id
      where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
        and s.user_id = auth.uid()
        and (s.not_after is null or s.not_after > now())
        and u.raw_app_meta_data ->> 'role' = 'admin'
        and (u.banned_until is null or u.banned_until <= now())
        and u.deleted_at is null
    );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Privilégios mínimos por papel. A RLS filtra linhas, mas não cobre TRUNCATE
-- nem dá motivo para `anon` ter INSERT/UPDATE/DELETE. Café nunca é apagado:
-- sai do ar com `ativo = false`.
revoke all on table public.cafes from anon, authenticated;
grant select on table public.cafes to anon;
grant select, insert, update on table public.cafes to authenticated;

-- `(select …)` faz o Postgres avaliar a função uma vez por query, não por linha.
-- Soma-se a "cafes ativos são públicos" (políticas permissivas se somam).
create policy "admin lê todos os cafés"
  on public.cafes for select
  to authenticated
  using ((select private.is_admin()));

create policy "admin cadastra cafés"
  on public.cafes for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "admin edita cafés"
  on public.cafes for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Sem política de DELETE, de propósito.

create function private.set_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

revoke all on function private.set_atualizado_em() from public, anon, authenticated;

create trigger cafes_set_atualizado_em
  before update on public.cafes
  for each row
  execute function private.set_atualizado_em();
