-- Issue #100 (PRD #98): festivais como edições com data.
--
-- Os selos "Recife Coffee" e "Eu Amo Café" deixam de ser booleanos fixos em
-- `cafes` e passam a vir da participação na edição ativa. Esta migration só
-- cria o modelo e migra os selos atuais para as edições de 2026: as colunas
-- `selo_*` continuam até a fatia do chip/selo (#101), para o site não quebrar
-- no meio do caminho.
--
-- "Ativa" (publicada e dentro do período) é decidido no app, no dia de
-- Recife — nunca na política, para o cache não depender do relógio do banco.

-- Os dois festivais entram aqui; não há tela para criar festival.
create table public.festivais (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome text not null check (char_length(btrim(nome)) between 1 and 80)
);

insert into public.festivais (slug, nome)
values ('recife-coffee', 'Recife Coffee'), ('eu-amo-cafe', 'Eu Amo Café');

create table public.festival_edicoes (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivais (id) on delete restrict,
  ano integer not null,
  inicio date not null,
  -- Inclusive: o último dia do festival.
  fim date not null,
  descricao text check (char_length(descricao) <= 1000),
  -- Preço único do combo, em centavos. Obrigatório só para publicar.
  preco integer check (preco > 0),
  publicada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (festival_id, ano),
  check (fim >= inicio),
  check (extract(year from inicio) = ano),
  check (not publicada or preco is not null)
);

create table public.festival_participacoes (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.festival_edicoes (id) on delete restrict,
  cafe_id uuid not null references public.cafes (id) on delete restrict,
  -- Número do combo na divulgação. Opcional (os migrados chegam sem); único
  -- na edição quando preenchido — o `unique` aceita vários nulos.
  numero integer check (numero > 0),
  nome_combo text check (char_length(btrim(nome_combo)) between 1 and 120),
  -- Transcrição da arte: o texto do combo está dentro da imagem.
  alt text check (char_length(btrim(alt)) between 1 and 1000),
  instagram_url text check (instagram_url ~ '^https://(www\.)?instagram\.com/' and char_length(instagram_url) <= 300),
  -- `{edicao_id}/{uuid}.webp` no bucket `festival-artes`, sempre da pasta da própria edição.
  arte_path text unique
    check (arte_path ~ ('^' || edicao_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')),
  -- Autorização de uso da arte, como a das fotos (#46).
  autorizado_por text check (char_length(btrim(autorizado_por)) between 1 and 120),
  autorizado_em date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (edicao_id, cafe_id),
  unique (edicao_id, numero),
  -- Arte no ar só com o texto alternativo e o registro de quem autorizou.
  check (arte_path is null or (alt is not null and autorizado_por is not null and autorizado_em is not null))
);

create index festival_participacoes_cafe_id_idx on public.festival_participacoes (cafe_id);

create trigger festival_edicoes_set_atualizado_em
  before update on public.festival_edicoes
  for each row
  execute function private.set_atualizado_em();

create trigger festival_participacoes_set_atualizado_em
  before update on public.festival_participacoes
  for each row
  execute function private.set_atualizado_em();

-- Privilégios mínimos (o Supabase concede tudo por padrão em tabela nova do
-- `public`, daí o `revoke`). Festival é só leitura para todos: entra por migration.
alter table public.festivais enable row level security;
alter table public.festival_edicoes enable row level security;
alter table public.festival_participacoes enable row level security;

revoke all on table public.festivais, public.festival_edicoes, public.festival_participacoes from anon, authenticated;
grant select on table public.festivais, public.festival_edicoes to anon;
-- Participação: o público lê o combo, não a autorização (quem autorizou a
-- arte é assunto do admin, como nas fotos) — grant por coluna.
grant select (id, edicao_id, cafe_id, numero, nome_combo, alt, instagram_url, arte_path)
  on table public.festival_participacoes to anon;
grant select on table public.festivais to authenticated;
-- Edição nunca é apagada (sai do ar com `publicada = false`); participação sim
-- (tirar um café da edição).
grant select, insert, update on table public.festival_edicoes to authenticated;
grant select, insert, update, delete on table public.festival_participacoes to authenticated;

create policy "festivais são públicos"
  on public.festivais for select
  to anon, authenticated
  using (true);

create policy "edições publicadas são públicas"
  on public.festival_edicoes for select
  to anon, authenticated
  using (publicada);

create policy "admin lê todas as edições"
  on public.festival_edicoes for select
  to authenticated
  using ((select private.is_admin()));

create policy "admin cadastra edições"
  on public.festival_edicoes for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "admin edita edições"
  on public.festival_edicoes for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Sem política de DELETE em edições, de propósito.

-- Público: participações de edições publicadas, só de cafés no ar (um café
-- fora do ar não conta como participante nem aparece na vitrine).
create policy "participações de edições publicadas são públicas"
  on public.festival_participacoes for select
  to anon, authenticated
  using (
    exists (select 1 from public.festival_edicoes e where e.id = edicao_id and e.publicada)
    and exists (select 1 from public.cafes c where c.id = cafe_id and c.ativo)
  );

create policy "admin lê todas as participações"
  on public.festival_participacoes for select
  to authenticated
  using ((select private.is_admin()));

create policy "admin cadastra participações"
  on public.festival_participacoes for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "admin edita participações"
  on public.festival_participacoes for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "admin remove participações"
  on public.festival_participacoes for delete
  to authenticated
  using ((select private.is_admin()));

-- Artes: bucket próprio, público, só WebP de até 2 MB (o navegador converte
-- antes de subir, como as fotos). Gravar e remover, só admin; sem `update`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('festival-artes', 'festival-artes', true, 2097152, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "admin lê objetos de artes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'festival-artes' and (select private.is_admin()));

create policy "admin sobe artes"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'festival-artes' and (select private.is_admin()));

create policy "admin remove artes do bucket"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'festival-artes' and (select private.is_admin()));

-- Migração dos selos para as edições de 2026. Todos entram sem número e sem
-- arte; a administradora completa no admin. O Recife Coffee 2026 já passou e
-- fica não publicado.
insert into public.festival_edicoes (festival_id, ano, inicio, fim, descricao, preco, publicada)
select f.id, 2026, '2026-10-18', '2026-11-15',
  'Cafeterias de Recife, Olinda e Jaboatão criam um combo exclusivo de café + comida, a preço único.',
  3490, true
from public.festivais f
where f.slug = 'eu-amo-cafe';

insert into public.festival_edicoes (festival_id, ano, inicio, fim, descricao, preco, publicada)
select f.id, 2026, '2026-05-03', '2026-06-07', null, 4590, false
from public.festivais f
where f.slug = 'recife-coffee';

-- O mesmo insert está no seed (projeto novo roda as migrations antes do seed).
insert into public.festival_participacoes (edicao_id, cafe_id)
select e.id, c.id
from public.cafes c
join public.festival_edicoes e on e.ano = 2026
join public.festivais f on f.id = e.festival_id
where (f.slug = 'eu-amo-cafe' and c.selo_eu_amo_cafe)
   or (f.slug = 'recife-coffee' and c.selo_ascape);
