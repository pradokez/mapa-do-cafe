-- Issue #46: fotos dos cafés, cada uma com registro de autorização.
--
-- `cafe_fotos` é a fonte da verdade; `cafes.fotos` vira cópia derivada (os
-- caminhos no bucket, na ordem), mantida por trigger e nunca escrita à mão.
-- O site público continua lendo só `cafes.fotos` — o `cafe-repository`
-- transforma os caminhos em URLs públicas (o banco não sabe o endereço do
-- projeto). O público não lê `cafe_fotos`: a autorização é assunto do admin.

create table public.cafe_fotos (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete restrict,
  -- `{cafe_id}/{uuid}.webp` no bucket `cafe-fotos`, sempre da pasta do próprio café.
  storage_path text not null unique
    check (storage_path ~ ('^' || cafe_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')),
  -- A de menor ordem é a capa. Sem `unique`: reordenar (#51) troca valores.
  ordem integer not null,
  -- Autorização de uso — obrigatória junto com o arquivo.
  origem text not null check (origem in ('propria', 'cedida')),
  autorizado_por text not null check (char_length(btrim(autorizado_por)) between 1 and 120),
  autorizado_em date not null,
  observacao text check (char_length(observacao) <= 500),
  criado_em timestamptz not null default now()
);

create index cafe_fotos_cafe_id_ordem_idx on public.cafe_fotos (cafe_id, ordem);

-- Só admin, nas quatro operações. `anon` não recebe nada (o Supabase concede
-- tudo por padrão em tabela nova do `public`, daí o `revoke`).
alter table public.cafe_fotos enable row level security;
revoke all on table public.cafe_fotos from anon, authenticated;
grant select, insert, update, delete on table public.cafe_fotos to authenticated;

create policy "admin lê fotos"
  on public.cafe_fotos for select
  to authenticated
  using ((select private.is_admin()));

create policy "admin cadastra fotos"
  on public.cafe_fotos for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "admin edita fotos"
  on public.cafe_fotos for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "admin remove fotos"
  on public.cafe_fotos for delete
  to authenticated
  using ((select private.is_admin()));

-- Foto nova vai para o fim: sem `ordem`, a seguinte à maior do café.
create function private.cafe_fotos_ordem_padrao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ordem is null then
    select coalesce(max(f.ordem) + 1, 0) into new.ordem
    from public.cafe_fotos f
    where f.cafe_id = new.cafe_id;
  end if;
  return new;
end;
$$;

revoke all on function private.cafe_fotos_ordem_padrao() from public, anon, authenticated;

create trigger cafe_fotos_ordem_padrao
  before insert on public.cafe_fotos
  for each row
  execute function private.cafe_fotos_ordem_padrao();

-- `cafes.fotos` = caminhos de `cafe_fotos` do café, na ordem. O flag da
-- transação é o único jeito de passar pela `proteger_fotos` abaixo. Roda com
-- os privilégios de quem escreveu (o admin já tem `update` em `cafes` pela RLS).
create function private.sincronizar_fotos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  afetados uuid[];
begin
  if tg_op = 'INSERT' then
    afetados := array[new.cafe_id];
  elsif tg_op = 'DELETE' then
    afetados := array[old.cafe_id];
  else
    afetados := array[old.cafe_id, new.cafe_id];
  end if;

  perform set_config('mapa.sync_fotos', 'on', true);
  update public.cafes c
  set fotos = coalesce(
    (
      select array_agg(f.storage_path order by f.ordem, f.criado_em, f.id)
      from public.cafe_fotos f
      where f.cafe_id = c.id
    ),
    '{}'
  )
  where c.id = any (afetados);
  perform set_config('mapa.sync_fotos', '', true);

  return null;
end;
$$;

revoke all on function private.sincronizar_fotos() from public, anon, authenticated;

create trigger cafe_fotos_sincronizar
  after insert or update or delete on public.cafe_fotos
  for each row
  execute function private.sincronizar_fotos();

-- `cafes.fotos` nunca é escrita à mão: valor vindo de fora (um payload de
-- edição, um insert) é ignorado. Só a `sincronizar_fotos` passa.
create function private.proteger_fotos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('mapa.sync_fotos', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.fotos := '{}';
    else
      new.fotos := old.fotos;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.proteger_fotos() from public, anon, authenticated;

create trigger cafes_proteger_fotos
  before insert or update on public.cafes
  for each row
  execute function private.proteger_fotos();

-- Bucket público (as fotos aparecem no site), só WebP de até 2 MB: o navegador
-- converte antes de subir, e o que contornar o formulário é recusado aqui.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cafe-fotos', 'cafe-fotos', true, 2097152, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Gravar e remover, só admin. A leitura pública vai pelo endpoint
-- `/object/public`, que não passa por política; `select` aqui é o que o
-- Storage exige para conferir e apagar um objeto — e mantém a listagem do
-- bucket fechada ao público. Sem `update`: não há upsert, cada foto tem caminho novo.
create policy "admin lê objetos de fotos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'cafe-fotos' and (select private.is_admin()));

create policy "admin sobe fotos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cafe-fotos' and (select private.is_admin()));

create policy "admin remove fotos do bucket"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'cafe-fotos' and (select private.is_admin()));
