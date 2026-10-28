-- Issue #183 (PRD #167): as portas do robô de curadoria no banco.
--
-- O robô roda no GitHub Actions com uma publishable key só dele (papel
-- `anon`) e não tem grant em tabela nenhuma. Tudo passa por duas RPCs
-- `security definer`, que conferem o segredo do robô antes de qualquer coisa:
--
--   curadoria_contexto(segredo)                  -> o mínimo dos cafés para a rodada
--   curadoria_registrar(segredo, rodada, revisoes) -> grava a rodada e as revisões
--
-- O segredo não serve para mais nada: não aprova, não lê a fila, não lê
-- sugestões, não grava em `cafes`. Um vazamento no GitHub enche, no máximo,
-- a fila de pendentes até o teto diário (abaixo).
--
-- O segredo em claro só existe no GitHub (secret `CURADORIA_SEGREDO`, 32 bytes
-- aleatórios em hex). Aqui fica o SHA-256 dele (#181), que não é sensível: com
-- 256 bits aleatórios, não há o que adivinhar. Para trocar o segredo, gere
-- outro e grave o hash novo numa migration (`update private.curadoria_segredo`).
--
-- Erros que o robô trata:
--   MC401 -> segredo errado (ou sem hash cadastrado)
--   MC429 -> teto diário de rodadas ou de revisões
--   22023 -> entrada fora do formato

create table private.curadoria_segredo (
  -- Uma linha só.
  id boolean primary key default true check (id),
  hash text not null check (hash ~ '^[0-9a-f]{64}$')
);

revoke all on table private.curadoria_segredo from public, anon, authenticated;

insert into private.curadoria_segredo (hash)
values ('1695619b399524fcd7bc53374f52f99e6b5ee886c4918db1cda71b16374bd975');

-- Sem hash cadastrado, recusa: falha fechada.
create function private.curadoria_conferir_segredo(p_segredo text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_segredo is null or not exists (
    select 1
    from private.curadoria_segredo s
    where s.hash = encode(sha256(convert_to(p_segredo, 'UTF8')), 'hex')
  ) then
    raise exception 'segredo inválido' using errcode = 'MC401';
  end if;
end;
$$;

revoke all on function private.curadoria_conferir_segredo(text) from public, anon, authenticated;

-- O mínimo para a rodada:
--   cafes                  -> TODOS os cafés (inclusive fora do ar, para não propor
--                             duplicata), só com id, nome, bairro, cidade, ativo e os
--                             campos que a revisão confere (a lista do check `campo`
--                             de `revisoes`). Sem slug, coordenadas, fotos nem datas.
--   rejeitadas             -> (café, campo, valor) rejeitados nos últimos 90 dias,
--                             `[{ cafe_id, campo, valor, rejeitada_em }]`; o
--                             `revisao-proposta` decide a borda exata.
--   cafes_novos_rejeitados -> nomes normalizados de cafés novos rejeitados, sem
--                             prazo: café novo rejeitado nunca volta.
create function public.curadoria_contexto(p_segredo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.curadoria_conferir_segredo(p_segredo);

  return jsonb_build_object(
    'cafes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'nome', c.nome,
        'bairro', c.bairro,
        'cidade', c.cidade,
        'ativo', c.ativo,
        'endereco', c.endereco,
        'aceita_pets', c.aceita_pets,
        'tem_estacionamento', c.tem_estacionamento,
        'permite_coffee_office', c.permite_coffee_office,
        'acessivel_pcd', c.acessivel_pcd,
        'opcoes_vegetarianas', c.opcoes_vegetarianas,
        'tem_ar_condicionado', c.tem_ar_condicionado,
        'faixa_preco', c.faixa_preco,
        'horario_funcionamento', c.horario_funcionamento,
        'instagram', c.instagram,
        'telefone', c.telefone
      ) order by c.id)
      from public.cafes c
    ), '[]'::jsonb),
    'rejeitadas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cafe_id', r.cafe_id,
        'campo', r.campo,
        'valor', r.valor_proposto,
        'rejeitada_em', r.decidido_em
      ) order by r.decidido_em)
      from public.revisoes r
      where r.status = 'rejeitada'
        and r.cafe_id is not null
        and r.decidido_em > now() - interval '90 days'
    ), '[]'::jsonb),
    'cafes_novos_rejeitados', coalesce((
      select jsonb_agg(distinct r.nome_normalizado order by r.nome_normalizado)
      from public.revisoes r
      where r.status = 'rejeitada'
        and r.tipo = 'cafe_novo'
    ), '[]'::jsonb)
  );
end;
$$;

-- Grava a rodada e as revisões dela numa transação só: qualquer erro desfaz
-- tudo, inclusive a rodada.
--
-- `p_rodada`: `{ inicio, cafes_verificados, chamadas_tavily, chamadas_gemini, erro }`.
-- `inicio` vem do robô (até 1 dia atrás); `fim` é a hora da gravação, e
-- `revisoes_criadas` conta só as inseridas.
--
-- `p_revisoes`: `[{ tipo, cafe_id, campo, valor_atual, valor_proposto, fontes,
-- atualidade, nome_normalizado }]` (contrato na migration da #177). Só essas
-- chaves são lidas: `status` nasce `pendente` e as datas saem do banco. Os
-- checks e a FK da tabela revalidam o resto.
--
-- Revisão igual a uma pendente é ignorada: em atualização e fechamento, mesmo
-- tipo, café, campo e valor proposto (igualdade de jsonb, sem depender da
-- ordem das chaves); em café novo, o mesmo nome normalizado.
--
-- Teto em 24 h móveis: 3 rodadas e 150 revisões do robô. Passou, recusa a
-- chamada inteira (MC429). Uma rodada normal fica bem abaixo: ~7 cafés por
-- semana (rodízio de 8 grupos) e o Gemini a 20 chamadas por dia. O advisory
-- lock serializa as chamadas, para duas simultâneas não passarem juntas do teto.
create function public.curadoria_registrar(p_segredo text, p_rodada jsonb, p_revisoes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  teto_de_rodadas constant integer := 3;
  teto_de_revisoes constant integer := 150;
  v_inicio timestamptz;
  v_rodada_id uuid;
  v_criadas integer := 0;
  r jsonb;
  v_tipo text;
  v_cafe_id uuid;
  v_campo text;
  v_proposto jsonb;
  v_nome text;
begin
  perform private.curadoria_conferir_segredo(p_segredo);

  perform pg_advisory_xact_lock(hashtextextended('curadoria_registrar', 0));

  if p_rodada is null or jsonb_typeof(p_rodada) <> 'object' then
    raise exception 'rodada inválida' using errcode = '22023';
  end if;
  if p_revisoes is null or jsonb_typeof(p_revisoes) <> 'array' then
    raise exception 'revisões inválidas' using errcode = '22023';
  end if;
  if jsonb_array_length(p_revisoes) > teto_de_revisoes then
    raise exception 'teto diário de revisões' using errcode = 'MC429';
  end if;

  v_inicio := (p_rodada->>'inicio')::timestamptz;
  if v_inicio is null or v_inicio > now() or v_inicio < now() - interval '1 day' then
    raise exception 'início da rodada inválido' using errcode = '22023';
  end if;

  insert into public.curadoria_rodadas (inicio, fim, cafes_verificados, chamadas_tavily, chamadas_gemini, erro)
  values (
    v_inicio,
    now(),
    coalesce((p_rodada->>'cafes_verificados')::integer, 0),
    coalesce((p_rodada->>'chamadas_tavily')::integer, 0),
    coalesce((p_rodada->>'chamadas_gemini')::integer, 0),
    p_rodada->>'erro'
  )
  returning id into v_rodada_id;

  for r in select value from jsonb_array_elements(p_revisoes) loop
    if jsonb_typeof(r) <> 'object' or octet_length(r::text) > 20000 then
      raise exception 'revisão inválida' using errcode = '22023';
    end if;

    v_tipo := r->>'tipo';
    v_cafe_id := (r->>'cafe_id')::uuid;
    v_campo := r->>'campo';
    v_proposto := r->'valor_proposto';
    v_nome := r->>'nome_normalizado';

    if v_proposto is null or v_proposto = 'null'::jsonb then
      raise exception 'revisão sem valor proposto' using errcode = '22023';
    end if;

    if v_tipo = 'cafe_novo' then
      perform 1 from public.revisoes p
      where p.status = 'pendente' and p.tipo = 'cafe_novo' and p.nome_normalizado = v_nome;
    else
      perform 1 from public.revisoes p
      where p.status = 'pendente'
        and p.tipo = v_tipo
        and p.cafe_id = v_cafe_id
        and p.campo is not distinct from v_campo
        and p.valor_proposto = v_proposto;
    end if;
    if found then
      continue;
    end if;

    insert into public.revisoes (
      tipo, cafe_id, campo, valor_atual, valor_proposto, fontes, atualidade, nome_normalizado, rodada_id
    ) values (
      v_tipo,
      v_cafe_id,
      v_campo,
      r->'valor_atual',
      v_proposto,
      coalesce(r->'fontes', '[]'::jsonb),
      r->>'atualidade',
      v_nome,
      v_rodada_id
    );
    v_criadas := v_criadas + 1;
  end loop;

  -- Conta já com esta chamada: passou, o `raise` desfaz tudo.
  if (select count(*) from public.curadoria_rodadas c where c.fim > now() - interval '24 hours') > teto_de_rodadas then
    raise exception 'teto diário de rodadas' using errcode = 'MC429';
  end if;
  if (
    select count(*) from public.revisoes p
    where p.rodada_id is not null and p.criado_em > now() - interval '24 hours'
  ) > teto_de_revisoes then
    raise exception 'teto diário de revisões' using errcode = 'MC429';
  end if;

  update public.curadoria_rodadas set revisoes_criadas = v_criadas where id = v_rodada_id;

  return jsonb_build_object('rodada_id', v_rodada_id, 'revisoes_criadas', v_criadas);
end;
$$;

-- Só o papel da publishable key (`anon`) executa; o segredo é que decide.
revoke all on function public.curadoria_contexto(text) from public, anon, authenticated;
revoke all on function public.curadoria_registrar(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.curadoria_contexto(text) to anon;
grant execute on function public.curadoria_registrar(text, jsonb, jsonb) to anon;
