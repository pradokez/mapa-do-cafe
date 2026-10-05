-- Issue #83: sugestões do público — a primeira escrita pública do projeto.
--
-- O público não toca nas tabelas: não lê, não insere, não altera, não apaga.
-- A única porta é a função `enviar_sugestao`, que confere o limite de envios
-- por IP e grava tudo na mesma transação. Sem política de `insert` para `anon`
-- de propósito: uma política deixaria inserir direto, pulando o limite.
--
-- O IP nunca chega aqui: a Server Action manda o HMAC dele (com segredo só do
-- servidor). O hash fica em `sugestoes_envios`, separado das mensagens e sem
-- ligação com elas, e some depois de 24 h (pg_cron, abaixo).

create table public.sugestoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('sugestao', 'problema', 'outro')),
  -- `char_length` conta caracteres, como o `sugestao.ts` (que mede depois de normalizar).
  mensagem text not null check (char_length(mensagem) between 10 and 2000),
  -- Página de onde a pessoa veio: só a home ou um café, sem query nem hash.
  origem text check (
    char_length(origem) <= 87
    and (origem = '/' or origem ~ '^/cafes/[a-z0-9]+(-[a-z0-9]+)*$')
  ),
  status text not null default 'nova' check (status in ('nova', 'lida', 'arquivada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index sugestoes_status_criado_em_idx on public.sugestoes (status, criado_em desc);

create trigger sugestoes_set_atualizado_em
  before update on public.sugestoes
  for each row
  execute function private.set_atualizado_em();

-- O Supabase concede tudo por padrão em tabela nova do `public`, daí o `revoke`.
-- Admin lê e muda só o `status` (grant de coluna): a mensagem fica como chegou.
-- Sem DELETE nem TRUNCATE para ninguém da API.
alter table public.sugestoes enable row level security;
revoke all on table public.sugestoes from anon, authenticated;
grant select on table public.sugestoes to authenticated;
grant update (status) on table public.sugestoes to authenticated;

create policy "admin lê sugestões"
  on public.sugestoes for select
  to authenticated
  using ((select private.is_admin()));

create policy "admin muda o status das sugestões"
  on public.sugestoes for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Só para o limite de envios: hash do IP e quando. Nenhum acesso pela API.
create table public.sugestoes_envios (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz not null default now()
);

create index sugestoes_envios_ip_hash_criado_em_idx on public.sugestoes_envios (ip_hash, criado_em);

alter table public.sugestoes_envios enable row level security;
revoke all on table public.sugestoes_envios from anon, authenticated;

-- Envia uma sugestão: no máximo 5 por hash de IP na última hora. O 6º recebe
-- o SQLSTATE `MC429`, que a Server Action traduz para "muitas mensagens
-- seguidas". Os checks da tabela revalidam tipo, tamanho e origem (a Server
-- Action já validou; isto é defesa em profundidade): se a sugestão não entra,
-- o envio também não conta.
--
-- `security definer` porque o `anon` não tem grant nas tabelas; `search_path`
-- vazio para ninguém sequestrar um nome não qualificado. O advisory lock por
-- hash serializa envios simultâneos do mesmo IP, para dois não passarem juntos
-- do limite.
create function public.enviar_sugestao(
  p_tipo text,
  p_mensagem text,
  p_origem text,
  p_ip_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recentes integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash de IP inválido' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));

  select count(*) into recentes
  from public.sugestoes_envios e
  where e.ip_hash = p_ip_hash
    and e.criado_em > now() - interval '1 hour';

  if recentes >= 5 then
    raise exception 'limite de envios atingido' using errcode = 'MC429';
  end if;

  insert into public.sugestoes_envios (ip_hash) values (p_ip_hash);
  insert into public.sugestoes (tipo, mensagem, origem) values (p_tipo, p_mensagem, p_origem);
end;
$$;

-- A única coisa que o `anon` executa. `authenticated` também não: a Server
-- Action chama sem sessão, sempre como `anon`.
revoke all on function public.enviar_sugestao(text, text, text, text) from public, anon, authenticated;
grant execute on function public.enviar_sugestao(text, text, text, text) to anon;

-- Guarda curta do hash: de hora em hora, apaga o que passou de 24 h — mesmo
-- sem envios novos. `cron.schedule` com nome atualiza o job se ele já existir.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'sugestoes-envios-expurgo',
  '0 * * * *',
  $$delete from public.sugestoes_envios where criado_em < now() - interval '24 hours'$$
);
