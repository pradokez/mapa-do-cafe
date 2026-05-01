# Coador

Diretório de cafés especiais em Recife e Olinda, PE — todos associados à [ASCAPE](https://www.ascape.com.br/cafeterias-associadas).

## Sobre o projeto

O Coador resolve um problema simples: a cena de cafés especiais de Recife é rica, mas as informações estão espalhadas em perfis do Instagram, Google Maps genérico e o site da ASCAPE sem experiência integrada. O Coador centraliza tudo num lugar só, com filtros úteis e mapa interativo.

**Layout:** lista de cards à esquerda + mapa Mapbox fixo à direita (desktop). No mobile, lista por padrão com botão flutuante para alternar para o mapa em tela cheia.

**Filtros disponíveis:** bairro · faixa de preço ($, $$, $$$) · aceita pets · estacionamento · Recife Coffee (ASCAPE)

## Stack

- [Next.js 14](https://nextjs.org/) App Router + TypeScript
- [Supabase](https://supabase.com/) — PostgreSQL + PostGIS + Storage + Auth
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS
- Deploy: Vercel + Supabase

## Rodando localmente

```bash
# 1. Clone o repo
git clone https://github.com/pradokez/coador.git
cd coador

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

## Seed

O seed popula o banco com os 33 cafés associados à ASCAPE com `associado_ascape = true`. Para rodá-lo manualmente:

```bash
npm run db:seed
```

## Fases do projeto

| Fase | Status | Escopo |
|---|---|---|
| Fase 1 — MVP | Em andamento | Listagem · Mapa · Filtros · Busca · Detalhe · Mobile · Deploy |
| Fase 2 — Polimento | Backlog | Admin panel · Upload de fotos · SEO · Performance |
| Fase 3 — Comunidade | Backlog | Avaliações · Filtro "Aberto agora" · Sugestões |

## Licença

MIT
