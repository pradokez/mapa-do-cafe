-- Tabela `cafes` — PRD v2.0 › Schema; formato do registro em src/lib/cafe.ts.

create extension if not exists postgis with schema extensions;

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  bairro text not null,
  bairro_slug text not null,
  endereco text not null,
  cidade text not null
    constraint cafes_cidade_check check (cidade in ('Recife', 'Olinda')),
  lat double precision not null
    constraint cafes_lat_check check (lat between -90 and 90),
  lng double precision not null
    constraint cafes_lng_check check (lng between -180 and 180),
  -- Fase 3: busca por raio. Sempre derivado de lat/lng, nunca escrito.
  location extensions.geography(Point, 4326)
    generated always as (
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
    ) stored,
  selo_ascape boolean not null default false,
  aceita_pets boolean not null default false,
  tem_estacionamento boolean not null default false,
  permite_coffee_office boolean not null default false,
  faixa_preco text not null
    constraint cafes_faixa_preco_check check (faixa_preco in ('$', '$$', '$$$')),
  comodidades text[] not null default '{}'
    constraint cafes_comodidades_check check (
      comodidades <@ array[
        '24-horas', 'acessivel', 'area-externa', 'brunch', 'cursos', 'delivery',
        'jardim', 'kids', 'livraria', 'loja', 'manobrista', 'musica-ao-vivo',
        'opcoes-veganas', 'reservas', 'torrefacao', 'wifi'
      ]::text[]
    ),
  horario_funcionamento jsonb not null
    constraint cafes_horario_funcionamento_check check (
      jsonb_typeof(horario_funcionamento) = 'object'
      and horario_funcionamento ?& array[
        'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'
      ]
    ),
  instagram text,
  telefone text,
  fotos text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index cafes_ativo_idx on public.cafes (ativo);
create index cafes_location_idx on public.cafes using gist (location);

-- Leitura pública só de cafés ativos. Escrita fica para o admin (Fase 2).
alter table public.cafes enable row level security;

create policy "cafes ativos são públicos"
  on public.cafes for select
  to anon, authenticated
  using (ativo);
