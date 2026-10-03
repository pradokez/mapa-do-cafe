-- Issue #38: selo do festival Eu Amo Café, três atributos novos e Jaboatão
-- dos Guararapes (Candeias e Piedade) entre as cidades aceitas.
--
-- `tem_ar_condicionado` é o único nullable: `null` = sem informação (o Google
-- não tem esse atributo). Nos outros, `false` também cobre "sem informação".

alter table public.cafes
  add column selo_eu_amo_cafe boolean not null default false,
  add column acessivel_pcd boolean not null default false,
  add column opcoes_vegetarianas boolean not null default false,
  add column tem_ar_condicionado boolean;

alter table public.cafes drop constraint cafes_cidade_check;

alter table public.cafes
  add constraint cafes_cidade_check
    check (cidade in ('Recife', 'Olinda', 'Jaboatão dos Guararapes'));
