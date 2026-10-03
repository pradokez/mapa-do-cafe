# Mapa do Café

Diretório de cafés especiais em Recife e Olinda, PE. Layout Airbnb-style: lista de cards à esquerda, mapa Mapbox interativo fixo à direita (desktop); FAB lista/mapa no mobile.

**PRD (fonte de verdade):** https://github.com/pradokez/mapa-do-cafe/issues/1 — leia antes de decidir qualquer coisa que este arquivo não cubra.

O produto se chama **Mapa do Café**, com "(Recife!)" como parte do logo — nunca é tagline e nunca aparece inline no texto corrido. O repositório se chamava `coador`; o nome antigo não deve aparecer em código, copy ou documentação.

## Stack

- **Framework:** Next.js 14 App Router — Server Components por padrão, `"use client"` só onde há interação, hook ou Mapbox
- **BaaS:** Supabase — PostgreSQL + PostGIS + Storage + Auth
- **Mapa:** Mapbox GL JS
- **UI:** shadcn/ui + Tailwind CSS
- **Mutations:** Server Actions (não API Routes)
- **Deploy:** Vercel (frontend) + Supabase (banco/storage)
- **Linguagem:** TypeScript; todo texto de produto em português do Brasil

Única dependência externa com chave na Fase 1: **Mapbox**. Não há API paga no caminho crítico.

## Comandos

```bash
pnpm dev          # servidor local (precisa de .env.local — veja .env.example)
pnpm test         # Vitest
pnpm lint         # next lint
pnpm typecheck    # tsc --noEmit
pnpm seed:build   # regenera supabase/seed.sql a partir de supabase/seed/cafes.json
npx supabase db push --include-seed   # aplica migrations + seed no projeto linkado
```

Node 24 (`.nvmrc`), pnpm.

## Duas regras invioláveis

1. **Mapbox só dentro de `<CafeMap />`.** Nenhum outro arquivo importa `mapbox-gl`. Isso mantém uma eventual migração para Leaflet isolada em um arquivo.
2. **Leitura do Supabase só dentro de `cafe-repository`.** Nenhum outro arquivo importa o client do Supabase para ler. Isso mantém a troca de filtragem cliente↔servidor isolada.

## Estrutura de Módulos

| Módulo | Localização | Responsabilidade |
|---|---|---|
| `cafe-filter` | `src/lib/cafe-filter.ts` | **Puro.** Aplica estado de filtro sobre lista de cafés, e serializa/desserializa esse estado para `URLSearchParams`. Não importa React, Supabase nem Mapbox. |
| `cafe-hours` | `src/lib/cafe-hours.ts` | **Puro.** `(jsonb de horário, data)` → aberto hoje, horário de hoje, lista dos 7 dias com hoje marcado. |
| `cafe-distance` | `src/lib/cafe-distance.ts` | **Puro.** Haversine + formatação pt-BR (`1,2 km`) + ordenação por proximidade. Trata explicitamente "sem origem conhecida". |
| `cafe-photos` | `src/lib/cafe-photos.ts` | **Puro.** `(café)` → fontes de imagem. Esconde se vem do Storage ou do placeholder. Precedência: Storage > placeholder. |
| `cafe-repository` | `src/lib/cafe-repository.ts` | Única porta para o Supabase: `listCafesAtivos()`, `getCafeBySlug(slug)`. |
| `cafe-map` | `src/components/cafe-map.tsx` | Encapsula 100% do Mapbox. Interface declarativa: cafés, `hoveredId`, `selectedId`, callbacks. Não expõe nada da API do Mapbox. |
| `use-geolocation` | `src/hooks/use-geolocation.ts` | Hook fino: `idle` / `prompting` / `granted` / `denied` / `unavailable` + coordenadas. O cálculo é do `cafe-distance`. |
| `use-filter-params` | `src/hooks/use-filter-params.ts` | Liga `cafe-filter` à URL: lê com `useSearchParams`, escreve com `history.pushState` (o Next sincroniza sem round-trip; `router.push` re-renderizaria a home dinâmica no servidor) — a busca (`q`) usa `replaceState`, para "voltar" não desfazer letra por letra. **Não usar `useEffect` para sincronizar.** |

Os quatro módulos puros (`cafe-filter`, `cafe-hours`, `cafe-distance`, `cafe-photos`) **não importam React**. É isso que os torna testáveis sem montar nada — não quebre essa propriedade.

Nomes antigos que **não** devem ser usados: `FilterEngine`, `MapController`, `SearchDebouncer`, `PhotoUploader`.

## Filtragem acontece no cliente

O Server Component carrega **todos** os cafés ativos de uma vez (cache de 1 h no `cafe-repository`); filtros, busca e hover rodam no cliente. A home é **dinâmica** para o HTML já sair filtrado pelos params da URL — o primeiro render nunca mostra a lista completa piscando. Alvo de escala: 100–150 cafés (~100–200 KB). Mantém a sincronia card↔pin instantânea.

PostGIS fica no schema para a Fase 3 (busca por raio). Mover filtragem para o servidor depois é uma troca atrás do `cafe-repository`.

## Schema

Tabela `cafes` (PostgreSQL + PostGIS), migration em `supabase/migrations/`:

```sql
id uuid, slug text unique,
nome, bairro,                      -- bairro: exibição ("Graças")
bairro_slug,                       -- filtro ("gracas")
endereco, cidade,                  -- cidade: 'Recife' | 'Olinda'
lat, lng,
location geography(Point, 4326),   -- gerado de lat/lng; Fase 3: busca por raio
selo_ascape boolean,               -- filtro "Recife Coffee"
aceita_pets boolean,
tem_estacionamento boolean,        -- nome canônico (não `estacionamento`)
permite_coffee_office boolean,
faixa_preco text,                  -- '$' | '$$' | '$$$'
horario_funcionamento jsonb,       -- 7 chaves segunda…domingo; "HH:MM – HH:MM", turnos por ", ", ou "Fechado"
instagram, telefone,               -- nullable; instagram é URL completa
fotos text[],                      -- vazio na Fase 1; Storage na Fase 2
ativo boolean,
criado_em, atualizado_em           -- metadado técnico, fora do tipo `Cafe`
```

O tipo `Cafe` em `src/lib/cafe.ts` espelha esse formato. Constraints no banco: `slug` único, `cidade` e `faixa_preco` com `check` e `horario_funcionamento` com as 7 chaves.

Cafés com `ativo = false` nunca aparecem na listagem pública nem em `/cafes/[slug]` — garantido também por RLS (`select` público só com `ativo`).

**Seed:** `supabase/seed/cafes.json` é a fonte da verdade (29 cafés: 27 ativos, 3 em Olinda). `supabase/seed.sql` é **gerado** por `pnpm seed:build` — nunca edite o SQL à mão; um teste falha se os dois saírem de sincronia. O mesmo teste trava a forma do seed: coordenadas dentro de Recife/Olinda, 7 dias de horário no formato válido e nenhum par de cafés ativos a menos de 30 m (um pin esconderia o outro).

Revisão de lançamento (#14): **O Melhor Cantinho da Cidade** e **A Vida é Bela** dividem de fato o endereço R. Francisco Lacerda, 394 (Várzea) — as coordenadas estão afastadas ~44 m **de propósito**, para os pins não se sobreporem. O `palatsi-ilha-do-leite` tem bairro "Ilha do Leite" e endereço terminando em "- Paissandu": revisado e **mantido**.

## Filtros e URL

Seis filtros. Toda filtragem é compartilhável; ausência de param = filtro desligado.

| Filtro | Param | Formato |
|---|---|---|
| Selo Recife Coffee | `ascape` | `true` |
| Aceita pets | `pets` | `true` |
| Tem estacionamento | `estacionamento` | `true` |
| Permite coffee office | `coffee_office` | `true` |
| Bairro (**multi-select**) | `bairro` | slugs por vírgula — `gracas,espinheiro` |
| Faixa de preço (multi) | `preco` | `$,$$` |
| Busca | `q` | texto livre, debounce 300 ms |

Ida e volta precisa ser estável: estado → params → estado devolve o mesmo estado. Param desconhecido ou malformado é ignorado em silêncio, nunca quebra a página.

**Busca** casa por nome ou bairro, sem caixa nem acento; com várias palavras, cada uma precisa casar com um dos dois (cidade fica de fora). O campo existe **só no header da home** — 440×42 no desktop; no mobile, largura total entre o header e os chips (desvio consciente: o design mobile não tem busca). O design também o põe no detalhe, mas lá não há lista para filtrar.

**Bairro é multi-select** — desvio consciente do design, que desenhou escolha única. Dropdown desktop e bottom sheet mobile usam checkbox; "Todos os bairros" limpa a seleção. Rótulo do chip: `Bairro` → nome do bairro → `N bairros`.

## Mobile (abaixo de `lg`)

Abaixo de 1024 px a home vira o layout mobile do design (tela 02, 390×844): header com logo e botão de filtros, busca, chips de 36 px com scroll lateral (rótulos curtos do design — "Pets", "Estacionamento", "Coffee office" —, com o rótulo inteiro como nome acessível), cards compactos (thumb 92×92; 1 coluna abaixo de `sm`, 2 de `sm` a `lg`) e FAB de 50 px "Ver mapa" / "Ver lista". O mapa do mobile só monta quando a visão "mapa" é pedida — o celular não baixa o Mapbox à toa.

- **Visão lista/mapa é estado local**, fora da URL e do histórico: a home sempre abre na lista. Os filtros (na URL) sobrevivem à troca; voltar para a lista fecha o card do pin.
- **Bottom sheets com rascunho** (Radix Dialog, `ui/sheet.tsx`): marcar opções não mexe na URL; "Ver N cafés" conta o resultado do rascunho e é o único que aplica (uma entrada no histórico). Esc ou toque no fundo descartam. Sem arrasto: a alça é decorativa.
- **Desvio consciente — dois sheets:** no design, o botão de filtros e o chip de bairro abriam o mesmo sheet de bairros. Aqui o **botão de filtros** abre um sheet com o selo, os 3 atributos e a faixa de preço (linhas de 48 px, como o de bairro); o **chip de bairro** abre o sheet de bairros.
- **Badge** do botão de filtros: cada booleano, cada bairro e cada faixa contam 1; a busca não entra (`contarFiltrosAtivos`).
- **Card do pin:** o mesmo `CafeMapPreview` do desktop, preso embaixo (14 px das laterais, acima do FAB), **com X** — desvio do design, que não tem como fechar por teclado nem leitor de tela.

## Fotos: não use Google Places

A Fase 1 lança **inteiramente com placeholder** — gradiente listrado diagonal em tons de café, determinístico por café (o mesmo café gera sempre o mesmo gradiente). Fase 2 liga fotos próprias/autorizadas no Supabase Storage.

**Google Places foi avaliado e descartado**, e a decisão não deve ser reaberta sem ler a seção "Fotos" do PRD: os termos proíbem cachear a foto, e o SKU *Place Details Photos* dá só 1.000 eventos grátis/mês a US$ 7,00/1.000 depois — o que daria ~6 visitas/mês antes de começar a pagar. Instagram está fora como fonte de imagem (o campo `instagram` serve só para o link de saída).

"Como chegar" é link comum para o Google Maps — gratuito, não envolve API.

## Identidade Visual

### Tipografia — duas famílias

| Família | Token | Uso |
|---|---|---|
| **Caprasimo** (só 400) | `font-logo` / `font-display` | Logo (as duas linhas) e todos os títulos: nome de café nos cards e no preview do mapa, `<h1>` do detalhe e do 404, títulos de seção ("Avaliações"), estado vazio, título do bottom sheet |
| **DM Sans** (400/500/600/700) | `font-sans` | Toda a UI, corpo, chips, labels — inclusive rótulos de seção em caixa alta ("Comodidades", "Horário de funcionamento") |

`font-display` e `font-logo` apontam para a mesma família, mas são tokens separados: título não é logo. A Caprasimo **só tem peso 400** — `font-display` nunca leva `font-bold`/`font-semibold`, senão o navegador gera negrito sintético (borrado e mais largo).

Playfair Display (usada nos títulos até o design trocá-la pela Caprasimo), Yellowtail e Special Elite (variantes de logo descartadas) **estão mortas**. Se aparecerem no código, é bug.

### Logo — variante 2d, "etiqueta adesiva"

Duas linhas alinhadas à direita, formando uma unidade:
- "Mapa do Café" em Caprasimo, `espresso` — 27 px no header desktop, 24 px no mobile, 54 px em exibição
- "Recife!" logo abaixo, em pílula: fundo `terracotta`, texto `on-terracotta`, Caprasimo, `border-radius` total, rotação **-5°**, sombra chapada `2px 2px 0 #2C1A0E`. Encosta no título por margem negativa; **nunca inline com ele.**

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `espresso` | `#2C1A0E` | Texto principal, FAB, chips ativos escuros |
| `cream` | `#FAF7F2` | Superfície da aplicação |
| `canvas` | `#E7E0D6` | Fundo externo / página |
| `terracotta` | `#B5562F` | Acento: CTA, chip ativo, pin selecionado, adesivo do logo |
| `terracotta-hover` | `#9E4824` | Hover de CTA |
| `on-terracotta` | `#FFF8F1` | Texto sobre terracota |
| `ink-2` | `#5C4636` | Texto secundário |
| `ink-3` | `#7A6352` | Meta, contador, legenda |
| `placeholder` | `#8A7563` | Placeholder de input — 4,37:1 sobre branco, **abaixo do AA por decisão** (fiel ao design) |
| `line` | `#EDE4D8` | Divisores, borda de header |
| `line-strong` | `#E2D7C9` | Borda de input e botão |
| `chip-line` | `#DDD1C2` | Borda de chip inativo |
| `card-line` | `#EFE6DA` | Borda de card |
| `price-off` | `#D8CBBB` | `$` apagado na faixa de preço |
| `hover-soft` | `#F5EEE5` | Hover de item de lista e botão neutro |
| `seal-bg` / `seal-fg` | `#F6E8DF` / `#8F3F1F` | Badge Recife Coffee |
| `open` | `#3F6B3A` | "Aberto hoje" |
| `map-bg` | `#1E1B19` | Fundo do mapa |

Pins — inativo: preenchimento `#F1E6D8`, contorno e xícara `espresso`. Ativo: preenchimento `terracotta`, contorno e xícara `on-terracotta`, escala 1,3, `z-index` acima dos demais.

A paleta e as fontes da v1.0 (Archivo Black, Inter, `#2B1810`, `#F5EDDF`, `#B8553A`, `#EADFCB`) estão **mortas**. Se aparecerem no código, é bug.

## Microcopy fixado

Vem do design. Não reinventar na implementação.

- Contador: `1 café encontrado` / `N cafés encontrados`
- Estado vazio: **"Xícara vazia por aqui"** + "Nenhum café encontrado com esses filtros. Que tal explorar outros bairros?"
- Busca: placeholder "Buscar café ou bairro"
- Horário: "Aberto hoje" (`open`) / "Fechado hoje" (`terracotta`); quando fechado, complemento "abre amanhã". Horas como no design: `8h – 18h`, `8h30` (`formatarHorario`; o `jsonb` segue `HH:MM`)
- Faixa de preço nomeada: `$` Econômico · `$$` Moderado · `$$$` Elevado — desvio consciente: o design dizia "Especial", que num diretório de cafés especiais soava como qualidade, não preço
- Avaliações: "Ainda sem avaliações" + "Logo você vai poder contar como foi seu café aqui — do espresso ao atendimento." + botão "Avise-me quando abrir"
- FAB mobile: "Ver mapa" / "Ver lista" · Bottom sheet: "Ver N cafés"
- Detalhe: "Voltar ao mapa" · "Como chegar" · "Ver no Instagram" · "Selo Recife Coffee" · "Comodidades" · "Horário de funcionamento"
- Distância: `1,2 km` (vírgula), depois do local: `Graças · 1,2 km`; no detalhe, "1,2 km de você"

**Desvios conscientes no detalhe** (#4, #5) — o design não cobria esses casos:

- Fechado hoje: "abre amanhã" só quando amanhã abre de fato; senão "abre {dia}" (`abre segunda`), ou nada se nenhum dia abre
- Dia sem horário no `jsonb`: "Não informado" — nunca "Fechado". Se for hoje, o badge some
- Nota depois do horário, antes de "Avaliações": "Informações podem mudar. Na dúvida, confira com o café antes de ir." — `ink-3`, 12,5 px, ícone de info em `ink-3/60` (o design não tem a nota)
- "Avise-me quando abrir" → "Anotado! A gente te avisa quando abrir." (confirmação local, sem persistir)
- 404: "Esse café não está no mapa" + "Talvez o endereço esteja errado ou o café tenha saído do diretório." + "Voltar ao mapa"
- Tags de "Comodidades" = as opções de filtro (selo + 3 booleanos) + faixa de preço. Não há lista própria de comodidades: o array `comodidades` (wifi, brunch…) foi removido na #17 por não ter consumidor
- Abaixo de `lg` (o design só desenhou desktop): uma coluna, com o aside (CTAs) logo depois do título
- Carrossel: `max(4, fotos)` slots — fotos reais nunca são cortadas. Placeholder tem legenda "foto · {nome}", não as legendas por slot do design ("Salão", "Fachada"…), que prometeriam fotos inexistentes. Abaixo de `lg`, 260 px de altura e swipe

## Horário e distância

`horario_funcionamento` tem os 7 dias em ordem **Segunda → Domingo**. Mas o `jsonb` **não preserva a ordem das chaves** (o Postgres as normaliza): a ordem de exibição vem de uma lista fixa de `DiaSemana` em `cafe-hours`, nunca de `Object.keys`. "Hoje" vem de `(getDay() + 6) % 7`. Um dia pode ser `"Fechado"`.

O badge **"Aberto hoje / Fechado hoje"** é Fase 1 — compara só o *dia*, sem hora. **"Aberto agora"** (com hora corrente) é Fase 3; não confundir.

Mas o *dia* é o de **`America/Recife`**, não o do servidor: a Vercel roda em UTC e, das 21h à meia-noite, já estaria no dia seguinte. Por isso `/cafes/[slug]` é **dinâmica** (`force-dynamic`), não ISR — HTML cacheado atravessaria a meia-noite com o dia errado. O Vitest roda com `TZ=UTC` para pegar esse tipo de bug.

Distância depende de geolocalização do navegador. Negada, indisponível ou não decidida: a distância **não aparece** e o card mostra só o bairro — sem erro, sem insistir. O layout precisa ficar correto nos dois estados.

A permissão é pedida **ao montar** a home ou o detalhe, uma vez por carregamento de página (a posição sobrevive à navegação client-side). Se a Permissions API já diz `denied`, nem chamamos o navegador. Com posição, a lista da home sai **do mais perto ao mais longe**, já com filtros e busca aplicados (`ordenarPorDistancia`, em `cafe-distance`); empate e café sem coordenada válida (vai para o fim) mantêm a ordem alfabética do `cafe-repository`. Sem posição, a ordem é a alfabética. É automático: sem controle "Mais perto" e sem param na URL — quem recebe o link não está no mesmo lugar.

**Desvio consciente — a lista reordena quando a posição chega.** O HTML sai do servidor sem posição, em ordem alfabética; a reordenação acontece depois da hidratação, sem animação nem trava. Aceito porque, com permissão já concedida, a posição chega antes da primeira interação, e na primeira visita chega logo depois do "Permitir", quando a pessoa espera uma reação.

**Desvio consciente no formato** — o design só mostra `0,8 km`…`9,3 km`: abaixo de 1 km, a distância sai em **metros, de 10 em 10** (`850 m`), com piso de `10 m` (nunca `0 m`); o que arredonda para 1000 m já sai como `1,0 km`. Longe de Recife, separador de milhar: `2.130,4 km`.

## Convenções

- Textos e microcopy em pt-BR, tom casual e acolhedor ("bairro", não "distrito")
- Server Components por padrão; `"use client"` só com justificativa
- Mutations via Server Actions, não API Routes
- Componentes shadcn/ui não devem regredir em acessibilidade (teclado + ARIA vêm por padrão) ao customizar estilo
- Ícones de comodidade nos cards são **informação, não decoração**: precisam de rótulo acessível — `title` sozinho não basta
- Foco visível em toda superfície clicável, sem anel cortado: contêiner com scroll leva `scroll-padding`; canvas e controles do Mapbox usam o anel da paleta (por dentro do canvas)
- Contraste verificado (#14): `ink-3` dá 5,26:1 sobre `cream` e 4,89:1 sobre `hover-soft` — passa AA. Exceções conscientes: `placeholder` (acima) e, por serem `aria-hidden`, os `$` apagados (`price-off`) e as legendas "foto · {nome}"
- Sem menu hamburger até existir destino de navegação real

## Testes

Regra: testar **comportamento externo observável**, nunca detalhe de implementação. Um teste descreve uma decisão de produto, não uma linha de código. Refatorar o interior de um módulo sem mudar comportamento não deve quebrar teste nenhum.

| Módulo | Tipo | Prioridade |
|---|---|---|
| `cafe-filter` | Unitário puro — 6 filtros, interseção, multi-select, busca, ida e volta de URL | **Alta** |
| `cafe-hours` | Unitário puro — aberto/fechado, índice de hoje (atenção a domingo), jsonb incompleto | **Alta** |
| `cafe-distance` | Unitário puro — haversine, formato pt-BR, sem origem, ordenação (crescente, sem origem, desempate estável) | **Alta** |
| `cafe-photos` | Unitário puro — placeholder determinístico, precedência Storage > placeholder | **Alta** |
| `cafe-repository` | Integração — instância de teste do Supabase, **não mock** | Média (pós-MVP) |
| `cafe-card`, `filter-bar` | Componente — interação visível (clique no chip muda a URL) | Média |
| `cafe-map` | **Sem teste automatizado** — Mapbox em jsdom custa muito e entrega pouco. Verificação manual. | — |

E2E está fora da Fase 1.

## Fases

| Fase | Escopo |
|---|---|
| **Fase 1 — MVP** | Seed 29 cafés (27 ativos) · Listagem · Mapa · 6 filtros + busca · URL sync · hover card↔pin · `/cafes/[slug]` com carrossel, horários e badge "Aberto hoje" · distância e lista ordenada por proximidade · estado vazio · mobile · deploy |
| **Fase 2 — Polimento** | Admin + auth · CRUD · **upload de fotos (item de maior valor)** · SEO · lazy load · skeleton · domínio |
| **Fase 3 — Comunidade** | Avaliações · "Aberto agora" · sugestão de café · busca por raio (PostGIS) |

Não-objetivos: app nativo, reservas, delivery, monetização, multi-cidade, auth de usuário final.

## Notas operacionais

- **Supabase free hiberna após ~1 semana sem uso.** Num site de portfólio que pode ficar dias sem visita, o primeiro acesso depois disso é lento. Saiba disso antes de mandar o link para alguém.
- **Risco de dado:** horário, faixa de preço, pets e coffee office mudam e não têm fonte oficial. Sem admin (Fase 2), corrigir exige deploy. `permite_coffee_office` é o mais subjetivo dos quatro e o que mais frustra se estiver errado.
- O filtro **Recife Coffee é redundante no lançamento** (todos os 29 do seed são ASCAPE). É intencional: passa a discriminar conforme o diretório crescer. O badge nos cards continua comunicando o selo.

## Links

- **PRD:** https://github.com/pradokez/mapa-do-cafe/issues/1
- **Design aprovado:** projeto Claude Design `Mapa do Café.dc.html` — 4 telas + variantes de logo (2d aprovada)
- **Seed:** https://www.ascape.com.br/cafeterias-associadas
- **Plano da Fase 1:** [`plans/mapa-do-cafe.md`](./plans/mapa-do-cafe.md)
- **Tarefas:** issues do GitHub (#3–#14 = Fase 1), uma por fase do plano
