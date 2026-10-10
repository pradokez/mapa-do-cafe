-- Issue #101: chip, selo e filtro dos festivais vêm da participação na edição
-- no ar (PRD #98). As colunas manuais `selo_*` saem.
--
-- Ordem em produção: esta migration vai DEPOIS do deploy. O código anterior
-- ainda lê `selo_*` (500 sem elas); o novo não lê, e funciona com e sem.

-- Selo marcado no admin depois da migration dos festivais (#100) ainda não
-- virou participação: o mesmo insert dela, sem duplicar quem já entrou.
insert into public.festival_participacoes (edicao_id, cafe_id)
select e.id, c.id
from public.cafes c
join public.festival_edicoes e on e.ano = 2026
join public.festivais f on f.id = e.festival_id
where (f.slug = 'eu-amo-cafe' and c.selo_eu_amo_cafe)
   or (f.slug = 'recife-coffee' and c.selo_ascape)
on conflict (edicao_id, cafe_id) do nothing;

alter table public.cafes
  drop column selo_ascape,
  drop column selo_eu_amo_cafe;
