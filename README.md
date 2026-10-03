# Mapa do Café <sub>(Recife!)</sub>

Diretório de cafés especiais em Recife e Olinda, PE — começando pelos associados à [ASCAPE](https://www.ascape.com.br/cafeterias-associadas).

## Sobre o projeto

A cena de cafés especiais do Recife é rica, mas as informações estão espalhadas entre perfis do Instagram, o Google Maps genérico (que mistura padaria, rede e café especial no mesmo resultado) e a lista institucional da ASCAPE, que é texto corrido sem mapa, sem foto e sem filtro. Nenhuma dessas fontes responde às perguntas que de fato decidem a visita: posso levar meu cachorro? tem onde estacionar? dá pra trabalhar com o notebook? quanto vou gastar? está aberto hoje?

O Mapa do Café centraliza isso num lugar só, com mapa interativo e filtros que respondem exatamente a essas perguntas.

**Layout:** lista de cards à esquerda + mapa Mapbox fixo à direita (desktop). No mobile, lista por padrão com botão flutuante para alternar para o mapa em tela cheia. Passar o mouse num card acende o pin correspondente, e vice-versa.

**Filtros:** selo Recife Coffee (ASCAPE) · aceita pets · tem estacionamento · permite coffee office · bairro (multi-seleção) · faixa de preço ($, $$, $$$) · busca por nome ou bairro

Todo filtro ativo vira query param na URL, então qualquer recorte é um link compartilhável.

## Stack

- [Next.js 14](https://nextjs.org/) App Router + TypeScript
- [Supabase](https://supabase.com/) — PostgreSQL + PostGIS + Storage + Auth
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS
- Deploy: Vercel + Supabase

## Rodando localmente

Requisitos: Node 24 (`.nvmrc`) e pnpm.

```bash
# 1. Clone o repo e instale as dependências
git clone https://github.com/pradokez/mapa-do-cafe.git
cd mapa-do-cafe
pnpm install

# 2. Configure as variáveis de ambiente
cp .env.example .env.local
# Preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY

# 3. Inicie o servidor de desenvolvimento
pnpm dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Banco de dados (Supabase)

Migrations em `supabase/migrations/`, aplicadas no projeto hospedado com o Supabase CLI (via `npx`, sem instalação global):

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push --include-seed
```

O seed carrega os 29 cafés de `supabase/seed/cafes.json` (27 ativos, 3 em Olinda), com os mesmos `id`s. O JSON é a fonte da verdade; `supabase/seed.sql` é gerado a partir dele:

```bash
pnpm seed:build
```

Rodar o seed de novo atualiza os registros em vez de duplicá-los.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`); a RLS só expõe cafés ativos (e tudo, à sessão de admin) |
| `SUPABASE_SECRET_KEY` | Secret key — ignora a RLS; fora do app, só para scripts locais |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token público do Mapbox (`pk.…`), restrito por URL no painel |

As variáveis do Supabase são só de servidor (sem `NEXT_PUBLIC_`): a leitura acontece no `cafe-repository`, dentro de Server Components, e o login do admin (`/admin`) em Server Actions.

Na Vercel, configure as mesmas variáveis em Project Settings › Environment Variables.

## Testes

```bash
pnpm test
pnpm lint
pnpm typecheck
```

## Fotos

A Fase 1 usa placeholders gerados — gradiente em tons de café, determinístico por café. Fotos reais entram na Fase 2, via upload de imagens próprias ou autorizadas para o Supabase Storage.

Google Places foi avaliado e descartado como fonte de imagem: os termos proíbem cachear as fotos e o custo por requisição é incompatível com um projeto sem receita. Detalhes na seção "Fotos" do [PRD](https://github.com/pradokez/mapa-do-cafe/issues/1).

## Fases do projeto

| Fase | Status | Escopo |
|---|---|---|
| Fase 1 — MVP | Em andamento | Listagem · Mapa · Filtros · Busca · Detalhe · Mobile · Deploy |
| Fase 2 — Polimento | Backlog | Admin · Upload de fotos · SEO · Performance |
| Fase 3 — Comunidade | Backlog | Avaliações · "Aberto agora" · Sugestões · Busca por raio |

## Documentação

- **PRD:** [issue #1](https://github.com/pradokez/mapa-do-cafe/issues/1)
- **Briefing técnico:** [`CLAUDE.md`](./CLAUDE.md)

## Licença

MIT
