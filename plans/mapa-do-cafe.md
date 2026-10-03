# Plan: Mapa do Café (Recife!) — Fase 1

> Source PRD: [pradokez/mapa-do-cafe#1](https://github.com/pradokez/mapa-do-cafe/issues/1) — PRD v2.0 (2026-10-02)
>
> Escopo: apenas a Fase 1 do PRD (US 1–57). Admin (US 58–63) fica para um plano separado.

## Architectural decisions

Decisões duráveis que valem para todas as fases:

- **Stack**: Next.js 14 (App Router, TypeScript, Server Components por padrão), Tailwind com tokens da identidade no `theme`, shadcn/ui, Mapbox GL JS (estilo escuro), Supabase (PostgreSQL + PostGIS), deploy Vercel + Supabase. Única chave externa: `NEXT_PUBLIC_MAPBOX_TOKEN`.
- **Rotas**:
  - `/` — diretório (lista + mapa), todo filtro em query params
  - `/cafes/[slug]` — detalhe do café; slug inexistente ou café inativo → 404 amigável
- **Contrato de URL** (ausência de param = filtro desligado; param desconhecido/malformado é ignorado em silêncio; estado → params → estado é estável):
  - `ascape=true`, `pets=true`, `estacionamento=true`, `coffee_office=true`
  - `bairro=gracas,espinheiro` (multi, slugs separados por vírgula)
  - `preco=$,$$` (multi)
  - `q=<texto>` (debounce 300 ms)
- **Schema** — tabela `cafes`:
  - identificação: `id`, `slug` (único), `nome`, `bairro`, `bairro_slug`, `endereco`, `cidade` (Recife | Olinda)
  - geo: `lat`, `lng`, `location geography(Point,4326)` derivado de `lat`/`lng` (reservado para a Fase 3)
  - atributos de filtro: `selo_ascape boolean`, `aceita_pets boolean`, `tem_estacionamento boolean`, `permite_coffee_office boolean`, `faixa_preco` (`$` | `$$` | `$$$`)
  - conteúdo: `horario_funcionamento jsonb` (7 dias, Segunda → Domingo, valor pode ser `"Fechado"`), `instagram`, `telefone`
  - mídia: `fotos text[]` — vazio na Fase 1, não muda de forma na Fase 2
  - `ativo boolean` — inativo nunca aparece publicamente
- **Leitura de dados**: o Server Component carrega todos os cafés ativos uma vez (ISR); filtro, busca e hover rodam no cliente.
- **Fronteiras de isolamento (regras críticas)**:
  1. Só o `<CafeMap />` importa `mapbox-gl`.
  2. Só o `cafe-repository` lê do Supabase.
- **Módulos puros (sem React, testados por entrada → saída)**: `cafe-filter`, `cafe-hours`, `cafe-distance`, `cafe-photos`.
- **Hooks finos**: `use-filter-params` (URL ↔ estado de filtro, sem `useEffect` de sincronização), `use-geolocation` (`idle` / `prompting` / `granted` / `denied` / `unavailable`).
- **Identidade**: paleta e tipografia (Caprasimo no logo e nos títulos, DM Sans na UI) exatamente como na seção "Identidade visual" do PRD; microcopy pt-BR fixada pelo PRD, sem reinvenção.

---

## Phase 1: Walking skeleton — lista de cards vinda do Supabase

**User stories**: 1, 9, 10, 11, 56

### What to build

O primeiro caminho completo de ponta a ponta: projeto Next.js com Tailwind e os tokens da identidade, fontes, header com o logo 2d ("Mapa do Café" + adesivo "Recife!" a -5°), `CLAUDE.md` reescrito para o PRD v2.0 (com as duas regras críticas e a seção de testes), migration do schema `cafes` com o seed real de `supabase/seed/cafes.json` (29 cafés: 27 ativos e 2 inativos; 26 em Recife e 3 em Olinda), `cafe-repository` listando cafés ativos, e a home `/` renderizando a grade de cards (foto placeholder, nome, bairro, faixa de preço, badge Recife Coffee, ícones de comodidade) com o contador. Setup de testes com `cafe-photos` coberto. Deploy na Vercel funcionando.

### Acceptance criteria

- [ ] `CLAUDE.md` descreve o PRD v2.0: identidade, módulos kebab-case, schema, regras críticas e regra de testes
- [ ] Migration cria `cafes` conforme o schema acima, com `location` derivado de `lat`/`lng`
- [ ] A home lista apenas cafés `ativo = true`, vindos do Supabase via `cafe-repository`, com ISR
- [ ] Cards em 2 colunas no desktop, foto 16/10, hover eleva 3 px, tipografia e cores do design
- [ ] Todo café sem foto mostra o placeholder listrado determinístico (mesmo café → mesmo gradiente)
- [ ] Contador "1 café encontrado" / "N cafés encontrados"
- [ ] Cafés de Olinda aparecem no mesmo diretório
- [ ] Testes de `cafe-photos` passando: vazio → placeholder, URLs na ordem, determinismo, entradas inválidas degradam, precedência Storage > placeholder
- [ ] App publicado na Vercel apontando para o Supabase

---

## Phase 2: Página de detalhe `/cafes/[slug]`

**User stories**: 40, 43, 44, 45, 46, 47, 48, 49, 51, 52, 53

### What to build

Clicar num card abre `/cafes/[slug]`, renderizado no servidor a partir do `cafe-repository`. A página mostra uma imagem hero estática (o carrossel vem na fase 3), o `<h1>`, o endereço e o bairro, as comodidades em tags, a faixa de preço nomeada, o badge "Aberto hoje / Fechado hoje" com o horário de hoje e um expansor com os sete dias, com hoje destacado. Tudo isso é calculado pelo módulo puro `cafe-hours`. O aside fixo tem "Como chegar" (link do Google Maps) e "Ver no Instagram". A página inclui ainda "Voltar ao mapa", a seção de avaliações vazia com "Avise-me quando abrir" (sem backend) e um 404 amigável para slug inexistente ou café inativo.

### Acceptance criteria

- [ ] Card da home leva a `/cafes/[slug]`; o link é compartilhável e abre direto
- [ ] Faixa de preço exibida como "$ Econômico" / "$$ Moderado" / "$$$ Especial"
- [ ] "Aberto hoje" (`open`) ou "Fechado hoje" (terracota) + "abre amanhã" quando fechado
- [ ] Horário expansível com Segunda → Domingo e hoje destacado
- [ ] "Como chegar" abre o Google Maps com o destino; "Ver no Instagram" abre o perfil
- [ ] "Voltar ao mapa" retorna à home
- [ ] Seção "Ainda sem avaliações" com microcopy e botão do PRD, sem efeito colateral
- [ ] Slug inexistente ou café inativo → 404 com caminho de volta
- [ ] Testes de `cafe-hours` passando: aberto/fechado, índice de hoje para os 7 dias (incluindo domingo), ordem dos dias, `jsonb` incompleto/vazio/ausente degrada

---

## Phase 3: Carrossel de fotos no detalhe

**User stories**: 41, 42, 57

### What to build

O hero do detalhe vira um carrossel (500 px de altura, raio 18 px, transição de 450 ms) alimentado por `cafe-photos`, com setas, indicadores e contador "2 / 4". Navegável por teclado. Cafés com menos fotos que os slots completam com placeholder, nunca slot vazio.

### Acceptance criteria

- [ ] Setas e indicadores navegam entre as imagens; contador "N / total" atualiza
- [ ] Carrossel operável por teclado com foco visível
- [ ] Nenhum slot vazio: faltas são preenchidas com placeholder via `cafe-photos`
- [ ] Teste de `cafe-photos` para `fotos` parcialmente preenchido passando

---

## Phase 4: Mapa Mapbox — home e mini mapa do detalhe

**User stories**: 2, 3, 50

### What to build

Introduz o `<CafeMap />` como única fronteira com o Mapbox: interface declarativa (cafés, id destacado, id selecionado, callbacks), estilo escuro, pins 32×40 no visual inativo do PRD e controles de zoom na paleta `map-control`. Na home, o corpo vira a grade 45% / 55% com o mapa fixo enquanto a lista rola. No detalhe, o aside ganha o mini mapa de 230 px com a localização exata.

### Acceptance criteria

- [ ] Home desktop: lista à esquerda (45%), mapa à direita (55%), mapa permanece fixo ao rolar a lista
- [ ] Um pin por café listado, com visual inativo (`#F1E6D8` / `#2C1A0E`)
- [ ] Detalhe mostra mini mapa de 230 px centrado no café
- [ ] `mapbox-gl` é importado apenas pelo `<CafeMap />`
- [ ] Mapa carregado só no cliente, sem quebrar o render do servidor

---

## Phase 5: Sincronia card ↔ pin e preview no mapa

**User stories**: 4, 5, 6, 7, 8

### What to build

Liga a lista e o mapa nos dois sentidos. Hover no card ativa o pin, que fica terracota, com escala 1,3 e acima dos demais. Hover no pin destaca o card. Clique no pin abre o preview flutuante de 280 px com foto, nome e bairro (a distância entra na fase 10), botão X para fechar e posição invertida para baixo quando o pin está no terço superior do mapa.

### Acceptance criteria

- [ ] Hover em card → pin correspondente ativo; sair do card → pin volta ao normal
- [ ] Hover em pin → card correspondente destacado na lista
- [ ] Clique em pin abre preview de 280 px; clique no preview leva ao detalhe
- [ ] X fecha o preview
- [ ] Pin no terço superior → preview abre abaixo do pin, sem corte pela borda
- [ ] Resposta instantânea (estado local, sem round-trip)

---

## Phase 6: Filtros booleanos + contrato de URL

**User stories**: 12, 13, 14, 15, 19, 24, 26, 27, 28

### What to build

Cria o módulo puro `cafe-filter` (aplicar estado sobre a lista e serializar/desserializar `URLSearchParams`) e o hook `use-filter-params`. Adiciona a barra de filtros de 64 px com quatro chips: Recife Coffee, Aceita pets, Estacionamento e Coffee office. Os filtros combinam por interseção e cada mudança vira uma entrada no histórico. Lista, contador e pins refletem o resultado. O botão "Limpar filtros" aparece quando há filtro ativo.

### Acceptance criteria

- [ ] Cada chip liga/desliga seu filtro e seu param (`ascape`, `pets`, `estacionamento`, `coffee_office`)
- [ ] Filtros combinados retornam a interseção
- [ ] Lista, contador e pins do mapa refletem o mesmo resultado
- [ ] Abrir uma URL com params aplica os filtros já no primeiro render
- [ ] Voltar/avançar do navegador desfaz/refaz mudanças de filtro
- [ ] "Limpar filtros" visível com filtro ativo e volta ao estado inicial
- [ ] Chips operáveis por teclado
- [ ] Testes de `cafe-filter`: cada filtro booleano isolado (inclusive sem excluir ninguém), interseção, ida e volta de URL, param ausente/desconhecido/vazio/malformado ignorado sem erro

---

## Phase 7: Filtros multi-select de preço e bairro

**User stories**: 16, 17, 18

### What to build

Estende `cafe-filter` e a barra com faixa de preço multi (`preco=$,$$`) e bairro multi (`bairro=gracas,espinheiro`). No desktop, o bairro usa um dropdown com checkboxes, onde "Todos os bairros" limpa a seleção. O rótulo do chip muda conforme a seleção: `Bairro`, depois o nome do bairro, depois `N bairros`.

### Acceptance criteria

- [ ] Preço: selecionar várias faixas retorna a união das faixas (interseção com os demais filtros)
- [ ] Bairro: nenhum, um e vários selecionados funcionam; "Todos os bairros" limpa
- [ ] Rótulo do chip de bairro segue `Bairro` / nome / `N bairros`
- [ ] Params `preco` e `bairro` fazem ida e volta estável
- [ ] Dropdown operável por teclado
- [ ] Testes de `cafe-filter` cobrindo multi-select de bairro e preço

---

## Phase 8: Busca por nome ou bairro

**User stories**: 20, 21, 22

### What to build

Campo de busca de 440×42 px no header desktop com placeholder "Buscar café ou bairro". Casa por nome ou bairro, ignorando caixa e acento, com debounce de 300 ms e o termo refletido em `q`. A busca combina com os demais filtros.

### Acceptance criteria

- [ ] Busca por nome e por bairro, case-insensitive e insensível a acento
- [ ] Filtragem só dispara após 300 ms sem digitação
- [ ] `q` na URL; link com `q` abre já filtrado
- [ ] String vazia ou só espaços não filtra
- [ ] Testes de `cafe-filter` para busca: nome, bairro, caixa, acento, sem resultado, vazio, só espaços

---

## Phase 9: Estado vazio

**User stories**: 54, 55

### What to build

Quando o recorte não retorna nada, a lista mostra a ilustração da xícara vazia em line art, o título "Xícara vazia por aqui", a mensagem do PRD e um botão terracota de limpar filtros. O mapa fica sem pins, sem quebrar.

### Acceptance criteria

- [ ] Resultado vazio mostra ilustração, título e mensagem exatos do PRD
- [ ] Botão do estado vazio limpa todos os filtros e a busca
- [ ] Contador e mapa permanecem consistentes no estado vazio

---

## Phase 10: Distância e geolocalização

**User stories**: 29, 30, 31, 32

### What to build

Cria o módulo puro `cafe-distance` (haversine e formatação pt-BR) e o hook `use-geolocation`. O navegador pede permissão. Se concedida, a distância ("1,2 km") aparece nos cards, no preview do mapa e no detalhe ("1,2 km de você"). Se negada, indisponível ou ainda não decidida, a distância simplesmente não aparece e o layout continua correto, sem erro e sem novo pedido insistente.

### Acceptance criteria

- [ ] Prompt de permissão do navegador acontece; sem rastreamento silencioso
- [ ] Permissão concedida → distância em cards, preview e detalhe, formato `1,2 km`
- [ ] Negada/indisponível → só o bairro, layout íntegro, nenhuma mensagem de erro
- [ ] Testes de `cafe-distance`: haversine contra distâncias conhecidas com tolerância, mesmo ponto = 0, vírgula e uma casa decimal, sem origem → ausência explícita (nem 0, nem `NaN`)

---

## Phase 11: Layout mobile

**User stories**: 23, 25, 33, 34, 35, 36, 37, 38, 39

### What to build

Experiência mobile completa (referência 390×844):

- **Header:** logo, campo de busca e botão de filtros com badge de contagem.
- **Chips:** linha com scroll horizontal.
- **Lista:** padrão, com cards compactos (thumb 92×92).
- **FAB:** 50 px, alterna "Ver mapa" / "Ver lista" com o mapa em tela cheia.
- **Bairro:** escolhido num bottom sheet (raio 24 px, linhas de 48 px, multi-select) com o botão "Ver N cafés".
- **Toque num pin:** abre um card na parte de baixo da tela.

### Acceptance criteria

- [ ] Mobile abre na lista; FAB alterna lista ↔ mapa com o rótulo correto
- [ ] Busca no header mobile, acima dos chips, com o mesmo comportamento do desktop
- [ ] Chips rolam horizontalmente sem quebrar linha
- [ ] Badge no botão de filtros mostra a quantidade de filtros ativos
- [ ] Bottom sheet de bairro multi-select; "Ver N cafés" reflete o resultado antes de fechar
- [ ] Cards compactos com thumb lateral
- [ ] Toque num pin mostra card inferior; estado de filtro preservado ao alternar visões
- [ ] Bottom sheet operável por teclado e com ARIA preservado

---

## Phase 12: Revisão do seed e acabamento de lançamento

**User stories**: transversal (reforça 1, 11, 15 e os requisitos de acessibilidade do PRD)

### What to build

Revisão do seed de 29 cafés (27 ativos, Recife e Olinda) carregado na fase 1: conferir endereço, bairro, coordenadas, horário, preço e atributos. Passada de acessibilidade em todo o app: rótulos acessíveis nos ícones de comodidade, foco visível na paleta, navegação por teclado e verificação de contraste de `ink-3` sobre `cream` nos tamanhos pequenos. Nota discreta "informações podem mudar" no detalhe. Verificação manual completa em produção.

### Acceptance criteria

- [ ] Seed com 29 cafés (27 ativos, 2 inativos), todos com slug único, coordenadas e horário de 7 dias
- [ ] Ícones de comodidade com rótulo acessível além de `title`
- [ ] Toda superfície clicável tem foco visível e é alcançável por teclado
- [ ] Contraste de `ink-3` verificado e ajustado onde não passar
- [ ] Nota "informações podem mudar" na página de detalhe
- [ ] Verificação manual em produção: desktop, mobile, links com filtros, 404, geolocalização negada
