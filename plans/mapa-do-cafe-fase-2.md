# Plan: Mapa do Café (Recife!) — Fase 2 (Polimento)

> Source PRD: [pradokez/mapa-do-cafe#1](https://github.com/pradokez/mapa-do-cafe/issues/1) — PRD v2.0, seções "Administração (Fase 2)" (US 58–63) e "Fora da Fase 1, planejado para a Fase 2"
>
> **Pré-requisito:** [pradokez/mapa-do-cafe#42](https://github.com/pradokez/mapa-do-cafe/issues/42) — cards e filtros alinhados ao design v2 (8 marcações por café). Bloqueia só o que mexe no card: o skeleton (#45) e as fotos com `next/image` (#52). Admin e SEO não dependem dela.
>
> Escopo: admin com auth, CRUD e desativação de cafés, upload de fotos com registro de autorização, imagens otimizadas e skeleton, SEO, domínio próprio. Fase 1: [`mapa-do-cafe.md`](./mapa-do-cafe.md).
>
> **Issues:** #43–#53, rótulo [`fase-2`](https://github.com/pradokez/mapa-do-cafe/labels/fase-2). Em 3 ondas: #43, #44 e #45 começam já; #46–#50 dependem delas; #51, #52 e #53 fecham.

## Architectural decisions

Decisões duráveis que valem para todas as fases deste plano (somam-se às da Fase 1, que continuam valendo):

- **Rotas**:
  - `/admin/login` — única rota do admin acessível sem sessão
  - `/admin` — lista de todos os cafés (ativos e inativos)
  - `/admin/cafes/novo` — cadastro
  - `/admin/cafes/[id]` — edição, ativar/desativar e fotos do café
  - `/sitemap.xml`, `/robots.txt` — SEO; `/admin` fica fora do sitemap e com `noindex`
  - Rotas públicas (`/`, `/cafes/[slug]`) não mudam
- **Auth**:
  - Supabase Auth com email e senha, sessão em cookie, apenas para a administradora. Sem auth de usuário final.
  - Signup público **desligado** no projeto Supabase. A conta é criada à mão no painel.
  - Quem é admin: `app_metadata.role = 'admin'` no usuário. Só o service role altera `app_metadata`, então o próprio usuário não consegue se promover. Toda política de escrita confere essa claim, não apenas "estar autenticado".
  - O middleware redireciona qualquer `/admin/*` sem sessão de admin para `/admin/login`. A RLS é a garantia real; o middleware só cuida da experiência.
  - Chaves continuam só no servidor (sem `NEXT_PUBLIC_`): login e mutations rodam em Server Actions. `SUPABASE_SECRET_KEY` só entra onde a RLS não cobre (ex.: o seed).
- **Schema**:
  - `cafes` **não muda de forma**. Ganha políticas de RLS de `select` (todas as linhas), `insert` e `update` para admin. Sem `delete`: café sai do ar por `ativo = false`, nunca é apagado.
  - Nova tabela `cafe_fotos`, fonte da verdade das fotos:
    - `id uuid`, `cafe_id uuid → cafes.id`, `storage_path text` (único), `ordem int` (a de menor ordem é a capa)
    - autorização: `origem text` com `check` (`'propria'` | `'cedida'`), `autorizado_por text`, `autorizado_em date`, `observacao text` (nullable)
    - `criado_em`
    - RLS: leitura e escrita só para admin. O público não lê esta tabela.
  - `cafes.fotos text[]` vira **cópia derivada**: um trigger em `cafe_fotos` reescreve o array com as URLs públicas, na ordem, a cada insert/update/delete. O site público continua lendo só `cafes.fotos`, e `cafe-photos` não muda.
  - `atualizado_em` passa a ser mantido por trigger em todo update de `cafes`.
- **Storage**: bucket público `cafe-fotos`, caminho `{cafe_id}/{uuid}.{ext}`. Escrita e remoção só para admin (política em `storage.objects`). O upload vai **direto do navegador para o Storage** com URL assinada gerada por Server Action. Assim o arquivo não passa pelo limite de body da Server Action nem pela Vercel. Tipos aceitos: JPEG, PNG e WebP, com tamanho máximo definido no bucket.
- **Fronteiras de módulo**:
  - Regra 2 do `CLAUDE.md` continua: toda leitura do Supabase, inclusive a do admin (cafés inativos, `cafe_fotos`), passa pelo `cafe-repository`.
  - Escrita fica em Server Actions de um módulo de admin próprio, separado do `cafe-repository`.
  - Validação do formulário de café é um módulo **puro** (sem React, sem Supabase), testado por entrada → saída, como os outros quatro. Ele espelha as constraints do banco: `cidade`, `faixa_preco`, 7 chaves de horário no formato `"HH:MM – HH:MM"`, turnos por `", "` ou `"Fechado"`, `lat`/`lng` no intervalo, `slug` kebab-case, `instagram` URL completa.
- **Cache**: o cache de `listCafesAtivos` (hoje 1 h, chaveado pelo commit) passa a ter tag. Toda mutation do admin invalida a tag e o caminho do detalhe afetado, para a mudança aparecer no site na hora, sem deploy.
- **Fotos no front**: `next/image` com `unoptimized`. A imagem vai direto do Supabase para o navegador, sem passar pelo otimizador da Vercel (que contaria no bandwidth e nas transformações dela). A otimização acontece **no upload**: o navegador redimensiona e converte para WebP antes de subir. Lazy por padrão, `priority` só na capa acima da dobra. Placeholder listrado continua sendo o fallback.
- **URL do site**: `NEXT_PUBLIC_SITE_URL` alimenta `metadataBase`, canonical, sitemap e Open Graph. O domínio definitivo é **`mapadocafe-pe.com.br`**.

---

## Phase 1: Login e lista do admin

**User stories**: 58

**Issues**: [#43](https://github.com/pradokez/mapa-do-cafe/issues/43)

### What to build

O caminho de ponta a ponta do admin, ainda sem gravar nada. Signup desligado, conta da administradora criada com `role: 'admin'`, políticas de RLS de leitura para admin, sessão em cookie e middleware protegendo `/admin/*`. Tela `/admin/login` com email e senha, e `/admin` listando todos os cafés (nome, bairro, cidade, ativo/inativo, quantidade de fotos), com link para o café no site e botão de sair. O visual segue a identidade do produto, mas funcional e sóbrio: o admin não tem design aprovado. De quebra, o `CLAUDE.md` é atualizado: tira a coluna `comodidades` (removida na #36) e documenta auth, admin e as regras de escrita.

### Acceptance criteria

- [ ] Signup público desligado no projeto Supabase (local e produção)
- [ ] Acessar qualquer `/admin/*` sem sessão redireciona para `/admin/login`
- [ ] Login com credencial errada mostra erro em pt-BR, sem dizer se o email existe
- [ ] Usuário autenticado **sem** `role: 'admin'` não vê nem altera nada (garantido pela RLS, não só pelo middleware)
- [ ] `/admin` lista todos os cafés do seed (53 na #41), inclusive os inativos, sinalizados
- [ ] Sair encerra a sessão e volta para `/admin/login`
- [ ] Rotas `/admin` com `noindex`
- [ ] Leitura do admin passa pelo `cafe-repository`; nenhum outro arquivo lê do Supabase
- [ ] `CLAUDE.md` reflete o schema atual e a arquitetura do admin

---

## Phase 2: Upload de foto com registro de autorização

**User stories**: 62, 63

**Issues**: [#46](https://github.com/pradokez/mapa-do-cafe/issues/46)

### What to build

O item de maior valor da fase. Migration cria `cafe_fotos`, o trigger que mantém `cafes.fotos` em sincronia, o bucket `cafe-fotos` e suas políticas. Em `/admin/cafes/[id]`, uma seção de fotos permite escolher um arquivo e preencher a autorização (origem, quem autorizou, data, observação). Os dois são obrigatórios juntos: não existe foto sem registro de autorização. O navegador sobe o arquivo direto para o Storage com URL assinada, e uma Server Action registra a linha em `cafe_fotos`. A foto passa a aparecer no card da home e no carrossel do detalhe no lugar do placeholder, sem mexer em componente público.

### Acceptance criteria

- [ ] Não é possível salvar uma foto sem origem, quem autorizou e data
- [ ] Arquivo fora de JPEG/PNG/WebP ou acima do limite é recusado com mensagem clara, antes e depois do upload
- [ ] Depois do upload, a foto aparece no card e no carrossel do café sem novo deploy (cache invalidado)
- [ ] `cafes.fotos` reflete exatamente as fotos de `cafe_fotos`, na ordem; nunca é escrito à mão
- [ ] Falha no registro depois de um upload bem-sucedido não deixa arquivo órfão no bucket
- [ ] O público não consegue ler `cafe_fotos` nem gravar no bucket
- [ ] O navegador redimensiona e converte para WebP antes do upload
- [ ] Verificação manual do trigger em produção depois do merge (não há banco de teste): inserir e remover em `cafe_fotos` atualiza `cafes.fotos`

---

## Phase 3: Gerenciar fotos — ordem, capa e remoção

**User stories**: 62

**Issues**: [#51](https://github.com/pradokez/mapa-do-cafe/issues/51)

### What to build

Na mesma seção de fotos, a administradora vê as fotos já enviadas com os dados de autorização. Ela pode mudar a ordem (a primeira vira capa do card e abre o carrossel) e remover uma foto. A remoção apaga a linha e o arquivo no Storage. Reordenar e remover são acessíveis por teclado, sem depender só de arrastar.

### Acceptance criteria

- [ ] Reordenar muda a capa do card e a ordem do carrossel no site
- [ ] Reordenar funciona por teclado (ex.: botões subir/descer), com rótulo acessível
- [ ] Remover pede confirmação, apaga a linha em `cafe_fotos` e o objeto no bucket
- [ ] Remover a última foto faz o café voltar ao placeholder listrado
- [ ] Os dados de autorização de cada foto ficam visíveis no admin

---

## Phase 4: Desativar e reativar café

**User stories**: 61

**Issues**: [#47](https://github.com/pradokez/mapa-do-cafe/issues/47)

### What to build

Em `/admin/cafes/[id]`, um controle para tirar o café do ar e colocar de volta. A política de `update` de admin entra aqui, e o trigger de `atualizado_em` também. O café desativado some da home, do mapa e do contador, e `/cafes/[slug]` dele vira 404. Os dados e as fotos ficam intactos, e reativar devolve tudo.

### Acceptance criteria

- [ ] Desativar pede confirmação e explica o efeito ("o café sai do mapa, nada é apagado")
- [ ] Café desativado some da listagem pública e `/cafes/[slug]` retorna 404, na hora
- [ ] Reativar devolve o café com dados e fotos intactos
- [ ] A lista do admin reflete o novo estado
- [ ] Não existe caminho no admin para apagar um café

---

## Phase 5: Editar café

**User stories**: 60

**Issues**: [#48](https://github.com/pradokez/mapa-do-cafe/issues/48)

### What to build

Formulário de edição em `/admin/cafes/[id]` com todos os campos de `Cafe`: identificação, endereço, cidade, `lat`/`lng`, os dois selos e as seis comodidades (ar-condicionado aceita "sem informação"), faixa de preço, horário dos 7 dias (Segunda → Domingo, aceitando turnos e "Fechado"), Instagram e telefone. A validação é o módulo puro, usada no cliente para resposta imediata e de novo na Server Action, que é quem vale. Salvar invalida o cache e o detalhe do café. Mudar o slug de um café existente fica bloqueado nesta fase, para não quebrar links compartilhados.

### Acceptance criteria

- [ ] Todos os campos de `Cafe` são editáveis, exceto `id` e `slug`
- [ ] Erros de validação aparecem por campo, em pt-BR, ligados ao input (ARIA), sem perder o que foi digitado
- [ ] A Server Action revalida tudo: um payload inválido enviado direto é recusado
- [ ] Horário salvo mantém as 7 chaves e aparece certo no detalhe, com "hoje" marcado
- [ ] Mudança aparece na home e no detalhe sem deploy
- [ ] Testes unitários do módulo de validação: cada constraint do banco, horário com turnos e "Fechado", campos opcionais vazios

---

## Phase 6: Cadastrar café novo

**User stories**: 59

**Issues**: [#53](https://github.com/pradokez/mapa-do-cafe/issues/53)

### What to build

`/admin/cafes/novo` reaproveita o formulário da edição. O slug é sugerido a partir do nome (kebab-case, sem acento) e pode ser ajustado antes de salvar. Slug repetido é recusado com mensagem clara. O `bairro_slug` deriva do bairro da mesma forma. Depois de salvar, o fluxo leva para `/admin/cafes/[id]`, onde dá para subir as fotos. Um mini mapa com o ponto de `lat`/`lng` ajuda a conferir a posição antes de publicar. Ele usa o `<CafeMap />` existente, mantendo a regra 1.

### Acceptance criteria

- [ ] Slug e `bairro_slug` são gerados do nome e do bairro, sem acento e em kebab-case
- [ ] Slug repetido é recusado com mensagem em pt-BR
- [ ] Bairro novo vira opção no filtro de bairro da home automaticamente
- [ ] Café novo aparece na home, no mapa e em `/cafes/[slug]` sem deploy
- [ ] A pré-visualização de posição usa o `<CafeMap />`; nenhum arquivo novo importa `mapbox-gl`
- [ ] Testes de geração de slug: acento, cedilha, espaços repetidos, caracteres especiais

---

## Phase 7: Imagens otimizadas e skeleton

**User stories**: — (PRD › "Lazy load de cards e imagens, skeleton loading")

**Issues**: [#45](https://github.com/pradokez/mapa-do-cafe/issues/45), [#52](https://github.com/pradokez/mapa-do-cafe/issues/52)

### What to build

Fotos reais do Storage passam a sair por `next/image` com `unoptimized` (já chegam otimizadas do upload; nada passa pela Vercel): lazy fora da tela, `priority` só na capa do detalhe e nos primeiros cards. Home e detalhe ganham skeleton de carregamento nos tons da paleta, com o mesmo formato do conteúdo final, para a página não pular quando os dados chegam. Isso importa principalmente no primeiro acesso depois que o Supabase free hiberna.

### Acceptance criteria

- [ ] Nenhuma imagem passa por `/_next/image`
- [ ] Cards fora da tela não baixam imagem até se aproximarem da viewport
- [ ] Skeleton da home e do detalhe com o formato do conteúdo real, sem layout shift perceptível ao trocar
- [ ] Skeleton respeita `prefers-reduced-motion`
- [ ] Placeholder listrado continua aparecendo para café sem foto

---

## Phase 8: SEO

**User stories**: — (PRD › "SEO: metadata dinâmica por café, sitemap, Open Graph")

**Issues**: [#44](https://github.com/pradokez/mapa-do-cafe/issues/44), [#49](https://github.com/pradokez/mapa-do-cafe/issues/49)

### What to build

Cada `/cafes/[slug]` ganha título, descrição gerada dos dados do café (bairro, cidade, faixa de preço, selo) e canonical. Ganha também Open Graph e Twitter Card: com a capa real quando houver foto, e senão uma imagem gerada na identidade (logo, nome do café, bairro, fundo listrado). A home ganha a sua imagem de compartilhamento. `sitemap.xml` lista a home e todos os cafés ativos, e `robots.txt` aponta para ele e bloqueia `/admin`. Dados estruturados `CafeOrCoffeeShop` (JSON-LD) no detalhe.

### Acceptance criteria

- [ ] Título e descrição únicos por café, em pt-BR, sem a palavra "(Recife!)" inline
- [ ] Link de café compartilhado mostra prévia com imagem, nome e bairro
- [ ] `sitemap.xml` contém só cafés ativos e se atualiza quando um café é criado ou desativado
- [ ] `robots.txt` bloqueia `/admin` e aponta para o sitemap
- [ ] JSON-LD válido no detalhe (endereço, geo, horário, Instagram)
- [ ] URLs absolutas vêm de `NEXT_PUBLIC_SITE_URL`

---

## Phase 9: Domínio próprio — `mapadocafe-pe.com.br`

**User stories**: — (PRD › "Domínio próprio")

**Issues**: [#50](https://github.com/pradokez/mapa-do-cafe/issues/50)

### What to build

O domínio `mapadocafe-pe.com.br` passa a servir o site pela Vercel com HTTPS, e o domínio `*.vercel.app` redireciona para ele. `NEXT_PUBLIC_SITE_URL` aponta para o domínio, e o sitemap e o Open Graph passam a usá-lo. No Supabase Auth, a Site URL e as Redirect URLs passam a incluir o domínio. O token do Mapbox é restrito também ao domínio novo.

### Acceptance criteria

- [ ] `https://mapadocafe-pe.com.br` serve o site com certificado válido; `www` redireciona para o domínio raiz (ou o contrário, mas um só canônico)
- [ ] Domínio da Vercel redireciona para o canônico
- [ ] Canonical, sitemap e Open Graph usam `mapadocafe-pe.com.br`
- [ ] Login do admin funciona no domínio novo
- [ ] Mapa carrega no domínio novo (token Mapbox restrito por URL atualizado)
