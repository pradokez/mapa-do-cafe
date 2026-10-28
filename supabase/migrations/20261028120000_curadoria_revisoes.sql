-- Issue #177 (PRD #167): fila de revisões da curadoria — o esqueleto.
--
-- O robô de curadoria (fatias seguintes) pesquisa e PROPÕE; nada dele vai ao
-- ar sem a administradora aprovar. Aqui entram só as tabelas e a leitura:
-- o admin lê, e muda apenas o `status` (como em `sugestoes`). Sem `delete`.
-- O anônimo não tem grant em nenhuma das duas. As RPCs do robô vêm depois.
--
-- Contrato de `valor_proposto`:
--   atualizacao -> o novo valor do `campo`, no formato da coluna de `cafes`
--                  (boolean, texto, ou o objeto de 7 dias do horário).
--                  Com `campo` nulo é só indício ("fechado temporariamente"):
--                  `{ "motivo": "fechado_temporariamente" }`.
--   fechamento  -> `{ "ativo": false }`.
--   cafe_novo   -> os dados do formulário de cadastro, SEM slug, lat e lng
--                  (coordenadas são conferidas à mão): nome, bairro, cidade,
--                  endereco, e o que o robô achar de instagram, telefone,
--                  faixa_preco, horario_funcionamento e booleanos; mais
--                  `sinais`: `[{ "sinal": text, "trecho": text, "url": text }]`,
--                  os indícios de café especial, cada um com o trecho literal.
-- `valor_atual` é o retrato do banco na coleta (null em `cafe_novo`).
-- `fontes`: `[{ url, titulo, data_fonte, trecho, atualidade }]`; `data_fonte`
-- é a data como aparece na página.

create table public.curadoria_rodadas (
  id uuid primary key default gen_random_uuid(),
  inicio timestamptz not null default now(),
  fim timestamptz,
  cafes_verificados integer not null default 0 check (cafes_verificados >= 0),
  revisoes_criadas integer not null default 0 check (revisoes_criadas >= 0),
  chamadas_tavily integer not null default 0 check (chamadas_tavily >= 0),
  chamadas_gemini integer not null default 0 check (chamadas_gemini >= 0),
  -- Código curto; nunca a mensagem de um serviço de terceiros.
  erro text check (char_length(erro) <= 80)
);

create table public.revisoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('cafe_novo', 'atualizacao', 'fechamento')),
  cafe_id uuid references public.cafes (id),
  campo text check (
    campo in (
      'endereco', 'aceita_pets', 'tem_estacionamento', 'permite_coffee_office',
      'acessivel_pcd', 'opcoes_vegetarianas', 'tem_ar_condicionado',
      'faixa_preco', 'horario_funcionamento', 'instagram', 'telefone'
    )
  ),
  valor_atual jsonb,
  valor_proposto jsonb not null,
  fontes jsonb not null default '[]'::jsonb check (jsonb_typeof(fontes) = 'array'),
  atualidade text not null check (atualidade in ('atualizada', 'antiga', 'sem_data', 'conflito')),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada', 'obsoleta')),
  rodada_id uuid references public.curadoria_rodadas (id),
  -- Só em `cafe_novo`: para não propor o mesmo café duas vezes.
  nome_normalizado text,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  -- Coerência entre tipo, café e campo.
  constraint revisoes_coerencia check (
    (tipo = 'cafe_novo' and cafe_id is null and campo is null and nome_normalizado is not null)
    or (tipo = 'fechamento' and cafe_id is not null and campo is null)
    or (tipo = 'atualizacao' and cafe_id is not null)
  )
);

create index revisoes_status_criado_em_idx on public.revisoes (status, criado_em desc);
create index revisoes_cafe_id_idx on public.revisoes (cafe_id);

-- `decidido_em` não vem de fora: sai quando o status deixa `pendente`.
create function private.set_revisao_decidido_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.decidido_em := case when new.status = 'pendente' then null else now() end;
  end if;
  return new;
end;
$$;

revoke all on function private.set_revisao_decidido_em() from public, anon, authenticated;

create trigger revisoes_set_decidido_em
  before update on public.revisoes
  for each row
  execute function private.set_revisao_decidido_em();

-- Admin lê e muda só o `status` (grant de coluna). Sem DELETE nem TRUNCATE.
alter table public.revisoes enable row level security;
revoke all on table public.revisoes from anon, authenticated;
grant select on table public.revisoes to authenticated;
grant update (status) on table public.revisoes to authenticated;

create policy "admin lê revisões"
  on public.revisoes for select
  to authenticated
  using ((select private.is_admin()));

create policy "admin muda o status das revisões"
  on public.revisoes for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

alter table public.curadoria_rodadas enable row level security;
revoke all on table public.curadoria_rodadas from anon, authenticated;
grant select on table public.curadoria_rodadas to authenticated;

create policy "admin lê rodadas"
  on public.curadoria_rodadas for select
  to authenticated
  using ((select private.is_admin()));
