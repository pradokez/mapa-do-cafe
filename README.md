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

```bash
# 1. Clone o repo
git clone https://github.com/pradokez/mapa-do-cafe.git
cd mapa-do-cafe

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Preencha NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e NEXT_PUBLIC_MAPBOX_TOKEN

# 4. Rode as migrations e o seed
npm run db:migrate
npm run db:seed

# 5. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (apenas servidor) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token público do Mapbox |

Mapbox é a única dependência externa com chave. Não há API paga no caminho crítico.

## Seed

O seed popula o banco com os 33 cafés associados à ASCAPE, com `associado_ascape = true`:

```bash
npm run db:seed
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
