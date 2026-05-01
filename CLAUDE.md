# Coador

Diretório de cafés especiais em Recife e Olinda, PE. Layout Airbnb-style: lista de cards à esquerda, mapa Mapbox interativo fixo à direita (desktop); FAB lista/mapa no mobile.

## Stack

- **Framework:** Next.js 14 App Router (Server Components + Server Actions)
- **BaaS:** Supabase — PostgreSQL + PostGIS + Storage + Auth
- **Mapa:** Mapbox GL JS
- **UI:** shadcn/ui + Tailwind CSS
- **Deploy:** Vercel (frontend) + Supabase (banco/storage)
- **Linguagem:** TypeScript, português do Brasil

## Estrutura de Módulos

| Módulo | Localização | Responsabilidade |
|---|---|---|
| `CafeRepository` | `src/lib/cafe-repository.ts` | Todas as queries ao Supabase: `listCafes(filters)`, `getCafeBySlug(slug)` |
| `FilterEngine` | `src/lib/filter-engine.ts` | Lógica pura de filtros → query params do Supabase. Sem side effects. |
| `MapController` | `src/lib/map-controller.ts` | Instância Mapbox GL JS, renderização de pins, eventos hover/click |
| `SearchDebouncer` | `src/hooks/use-search-debouncer.ts` | Hook de debounce 300ms para busca em tempo real |
| `AdminAuth` | `src/middleware.ts` | Proteção das rotas `/admin/*` via Supabase Auth |
| `PhotoUploader` | `src/lib/photo-uploader.ts` | _(Fase 2)_ Upload para Supabase Storage, valida tipo e tamanho |

## Schema Principal

Tabela `cafes` (PostgreSQL + PostGIS):

```sql
id, slug, nome, bairro, lat, lng,
associado_ascape boolean,
ativo boolean,
faixa_preco text,        -- '$' | '$$' | '$$$'
aceita_pets boolean,
estacionamento boolean,
fotos text[],            -- array de URLs públicas
telefone text,
instagram text,
endereco text,
horario_funcionamento jsonb
```

## Filtros e URL

Filtros ativos são refletidos como query params na URL:
- `?recifecoffee=true&pets=true&estacionamento=true&preco=$$&bairro=Boa+Viagem`

Usar `useSearchParams` + `useRouter` para sincronização. Evitar `useEffect` para isso.

## Identidade Visual

| Token | Hex | Uso |
|---|---|---|
| `brand-dark` | `#2B1810` | Texto principal, pins padrão, chips ativos |
| `brand-cream` | `#F5EDDF` | Fundo de cards |
| `brand-caramel` | `#C8884B` | Hover states |
| `brand-terracotta` | `#B8553A` | Pin destacado, CTA primário |
| `brand-mustard` | `#E8B84A` | Badges de destaque |
| `brand-moss` | `#5C6B4A` | Badges de categoria |
| `bg-warm` | `#EADFCB` | Background geral |

Tipografia: **Archivo Black** (display/logo) + **Inter** (interface).

## Convenções

- Textos e microcopy em português do Brasil, tom casual e acolhedor ("bairro")
- Componentes shadcn/ui não devem regredir em acessibilidade (teclado + ARIA estão incluídos por padrão)
- Fotos armazenadas como `text[]` — no MVP são URLs públicas, na Fase 2 viram URLs do Supabase Storage (schema não muda)
- Mutations via Server Actions (não API Routes)
- Cafés inativos (`ativo = false`) nunca aparecem na listagem pública

## Testes

| Módulo | Tipo | Prioridade |
|---|---|---|
| `FilterEngine` | Unitário — entradas/saídas puras | Alta |
| `SearchDebouncer` | Unitário — hook com fake timers | Alta |
| `CafeRepository` | Integração — Supabase test instance (não mock) | Média |
| `CafeCard` | Componente — render + interação | Média |
| `FilterBar` | Componente — estado dos chips + URL sync | Média |
| `AdminAuth` | Integração — fluxo de redirect | Baixa (Fase 2) |

Regra: testar comportamento externo (o que o usuário vê/experimenta), não detalhes de implementação.

## Issues e Planejamento

- **PRD:** https://github.com/pradokez/coador/issues/1
- **Tarefas:** Trello board `portfolio`, label `coador` (11 slices)
- Slices 1–7 = Fase 1 MVP | Slices 8–11 = Fase 2 Polimento
