# Mapa do Café

Diretório de cafés especiais em Recife, Olinda e Jaboatão dos Guararapes, PE. Layout Airbnb-style: lista de cards à esquerda, mapa Mapbox interativo fixo à direita (desktop); FAB lista/mapa no mobile.

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
2. **Leitura do Supabase só dentro de `cafe-repository`.** Nenhum outro arquivo lê tabela (`.from(…)`) — nem o admin, que lê cafés inativos pelo mesmo repositório. Isso mantém a troca de filtragem cliente↔servidor isolada. Fora dele, o Supabase só aparece para **sessão** (`supabase-server`, `supabase-env`, `src/lib/admin/`, `middleware.ts`) — e escrita, nas Server Actions de `src/lib/admin/` e na **única escrita pública**, `enviarSugestao` (`src/lib/sugestoes-actions.ts`, #83), que só chama `rpc('enviar_sugestao')`, sem `.from`. `src/lib/fronteiras.test.ts` falha se alguém furar isso (e também a regra 1).

## Estrutura de Módulos

| Módulo | Localização | Responsabilidade |
|---|---|---|
| `cafe-filter` | `src/lib/cafe-filter.ts` | **Puro.** Aplica estado de filtro sobre lista de cafés, e serializa/desserializa esse estado para `URLSearchParams`. Não importa React, Supabase nem Mapbox. |
| `cafe-hours` | `src/lib/cafe-hours.ts` | **Puro.** `(jsonb de horário, data)` → aberto hoje, horário de hoje, lista dos 7 dias com hoje marcado. |
| `cafe-distance` | `src/lib/cafe-distance.ts` | **Puro.** Haversine + formatação pt-BR (`1,2 km`) + ordenação por proximidade. Trata explicitamente "sem origem conhecida". |
| `cafe-photos` | `src/lib/cafe-photos.ts` | **Puro.** `(café)` → fontes de imagem. Esconde se vem do Storage ou do placeholder. Precedência: Storage > placeholder. `tonsDoPlaceholder` dá as cores das listras (a imagem de compartilhamento usa as mesmas). `urlsPublicasDasFotos` transforma os caminhos de `cafes.fotos` em URLs públicas do bucket `cafe-fotos`. |
| `cafe-seo` | `src/lib/cafe-seo.ts` | **Puro.** `(café)` → título, meta description, imagem de compartilhamento (`imagemCompartilhamento`) e JSON-LD `CafeOrCoffeeShop`. "Fechado" vira 00:00–00:00; dia sem informação fica fora do JSON-LD. |
| `cafe-repository` | `src/lib/cafe-repository.ts` | Única porta de leitura do Supabase. Público (sem sessão): `listCafesAtivos()` (cache de 1 h, tag `cafes`), `getCafeBySlug(slug)`. Admin (sessão do cookie, a RLS decide): `listTodosCafes()`, `getCafeById(id)`, `listFotosDoCafe(cafeId)` (fotos de `cafe_fotos` na ordem do site, com URL e autorização), `fotoRegistrada(caminho)`. Toda leitura de café sai com `fotos` já em URL pública. |
| `cafe-map` | `src/components/cafe-map.tsx` | Encapsula 100% do Mapbox. Interface declarativa: cafés, `hoveredId`, `selectedId`, callbacks. Não expõe nada da API do Mapbox. |
| `use-geolocation` | `src/hooks/use-geolocation.ts` | Hook fino: `idle` / `prompting` / `granted` / `denied` / `unavailable` + coordenadas. O cálculo é do `cafe-distance`. |
| `foto-upload` | `src/lib/foto-upload.ts` | **Puro.** Regras do upload de foto, comuns ao formulário e às Server Actions: tipos e limites (entrada JPEG/PNG/WebP ≤ 15 MB, HEIC recusado com instrução; saída WebP ≤ 2 MB), `dimensoesDestino` (lado maior 1600 px), `validarAutorizacao`, `hojeEmRecife`, caminho no bucket (`caminhoDaFoto`, `ehCaminhoDoCafe`). |
| `foto-upload-erro` | `src/lib/foto-upload-erro.ts` | **Puro.** Falhas do upload de foto (#74): `Falha` (etapa `converter`/`preparar`/`enviar`/`registrar`, código, HTTP, mensagem original), classificadores (`falhaDoStorage`, `falhaDoPut`, `falhaDoPostgres`, `falhaDeRede`), `sanear` (tira URL e token) e `mensagemDaFalha` → frase + linhas de "Detalhes técnicos". |
| `cafe-dados` | `src/lib/cafe-dados.ts` | **Puro.** Validação e normalização dos dados de um café no admin (#48), comum ao formulário e à Server Action: `validarDadosCafe` espelha as constraints de `cafes` (cidade, faixa, 7 dias de horário, lat/lng dentro da `REGIAO`), deriva `bairro_slug` (`slugify`), normaliza Instagram e telefone; cadastro (#53): `validarSlug` (kebab-case, até 80, nunca um slug de `slugs-antigos.mjs`) e `validarNovoCafe` (dados + slug); horário ↔ turnos do formulário (`turnosDoHorario`/`horarioDosTurnos`, `validarHorarioDia`); coordenadas de link do Google Maps (`coordenadasDaUrl`, `ehLinkDoMaps`, `parDeCoordenadas`). |
| `foto-ordem` | `src/lib/foto-ordem.ts` | **Puro.** Ordem das fotos no admin (#51): `moverFoto(ids, id, 'subir' \| 'descer' \| 'capa')` → nova ordem ou `null` (nada muda, foto de fora, movimento inválido); `ordensParaGravar` → `ordem` = posição só onde muda, o que também desfaz buracos e empates. |
| `admin-auth` | `src/lib/admin-auth.ts` | **Puro.** Etapa do login a partir das claims (`senha` → `codigo`/`cadastro-mfa` → `pronto`), `destinoSeguro` (o `next` do login, sem open redirect) e `isUuid`. |
| `admin-escrita` | `src/lib/admin-escrita.ts` | **Puro.** Modo leitura (#75): `escritaDoAdmin(env)` → `{ liberada: true }` em `VERCEL_ENV=production` ou com `ADMIN_ESCRITA_LIBERADA=1` (só o valor exato), senão `{ liberada: false, motivo }`. As actions o usam por `bloqueioDeEscrita()` (`src/lib/admin/escrita.ts`); o layout do painel, para a faixa. |
| `sugestao` | `src/lib/sugestao.ts` | **Puro.** Sugestões do público (#83): tipos e microcopy por tipo (`SOBRE_O_TIPO`), limites de tamanho (10–2.000 caracteres; o de 5 envios/h é da função no banco), `normalizarMensagem` (NFC, sem controle, largura zero e bidi, `\r\n` → `\n`, no máximo uma linha em branco, aparado; HTML **não** é removido nem escapado), `validarSugestao` (com honeypot → `robo`), `origemSegura` (só `/` e `/cafes/{slug}`), `hashDoIp` (HMAC-SHA-256 pela Web Crypto — o form também importa o módulo), `contadorDaMensagem` e o estado do envio (`EnvioSugestao`). |
| `supabase-server` | `src/lib/supabase-server.ts` | `server-only`. `createSessionClient` (sessão do cookie, para Server Components e Server Actions) e `createAnonClient` (sem sessão, sempre `anon`: a leitura pública do repositório e o envio de sugestão). `supabase-env` tem as envs e as opções do cookie (o middleware também usa). |
| `admin/*` | `src/lib/admin/` | `requireAdmin()` (e `sessaoDeAdmin()`, a mesma decisão sem redirect — #74), Server Actions de auth (`entrar`, `iniciarCadastroMfa`, `confirmarCodigo`, `sair`) e `revalidarCafe(slug)`. Fotos (#46): `prepararUpload`, `registrarFoto`, `descartarUpload`; (#51) `reordenarFoto`, `removerFoto`. Status (#47): `definirStatus` (estado-alvo, idempotente). Dados (#48): `salvarDadosCafe`, `coordenadasDoLink`. Cadastro (#53): `cadastrarCafe`. As Server Actions de escrita das próximas issues moram aqui. |
| `use-filter-params` | `src/hooks/use-filter-params.ts` | Liga `cafe-filter` à URL: lê com `useSearchParams`, escreve com `history.pushState` (o Next sincroniza sem round-trip; `router.push` re-renderizaria a home dinâmica no servidor) — a busca (`q`) usa `replaceState`, para "voltar" não desfazer letra por letra. **Não usar `useEffect` para sincronizar.** |

Os módulos puros (`cafe-filter`, `cafe-hours`, `cafe-distance`, `cafe-photos`, `cafe-seo`, `cafe-dados`, `admin-auth`, `admin-escrita`, `foto-upload`, `foto-upload-erro`, `foto-ordem`, `sugestao`) **não importam React**. É isso que os torna testáveis sem montar nada — não quebre essa propriedade.

Nomes antigos que **não** devem ser usados: `FilterEngine`, `MapController`, `SearchDebouncer`, `PhotoUploader`.

## Admin e auth (Fase 2, #43)

Painel só da administradora, para manter o diretório sem deploy. Não existe auth de usuário final.

**Rotas** — todas com `noindex` (`<meta>` e `X-Robots-Tag`), `Cache-Control: no-store` e sem iframe (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), via `next.config.mjs`:

| Rota | O quê |
|---|---|
| `/admin/login` | Única acessível sem sessão. Uma tela, etapas decididas no servidor: senha → código de 6 dígitos (ou, sem autenticador ainda, cadastro com QR) |
| `/admin` | Todos os cafés, ativos e inativos (etiqueta "Fora do ar"), com nome, bairro, cidade, status, nº de fotos e "Ver no site" (só ativos — o inativo dá 404 lá). Busca por nome ou bairro (#79): `<form method="get">` → `?q=`, filtrada no servidor com `filtrarCafes` do `cafe-filter` (a mesma regra do site, inativos incluídos) — ao enviar, não a cada letra, para a lista seguir sem JavaScript. Os contadores do topo seguem sobre a lista inteira |
| `/admin/cafes/novo` | Cadastro (#53): o mesmo formulário de Dados, em branco, com o slug. Salvar leva a `/admin/cafes/[id]?novo=1` (aviso de próximo passo) |
| `/admin/cafes/[id]` | Cabeçalho do café e as seções Fotos (lista com autorização, ordem e remoção, #51; envio, #46), Status (tirar do ar / colocar no ar, com confirmação nos dois sentidos, #47) e Dados (formulário de edição recolhido num `<details>`, #48). Id inexistente ou malformado → 404 do admin |

**Quem é admin:** `app_metadata.role = 'admin'` (só o service role altera; `user_metadata`, que o usuário edita, nunca conta) **e** segundo fator na sessão (`aal2`). **TOTP é obrigatório** — senha sozinha não lê nem grava nada.

**Três camadas, de propósito redundantes:**
1. `middleware.ts` (`getClaims()`, verificação local do JWT) — só experiência: sem admin `aal2`, `/admin/*` vai para o login com `?next=`. Server Action (header `Next-Action`) passa sem redirect, só renovando o cookie: um 307 faria a action rejeitar no cliente como queda de rede; ela se defende sozinha.
2. `requireAdmin()` em **todo** layout, page e Server Action do admin — `getUser()` vai ao servidor de auth, então sessão encerrada, usuário banido ou apagado não passam. A page chama também, não só o layout: o Next renderiza os dois em paralelo. As actions do upload de foto usam `if (!(await sessaoDeAdmin()))`, a mesma decisão sem redirect: devolvem a falha `sessao`, e o formulário explica e guarda a foto e os campos (#74).
3. **RLS** — a garantia real. `private.is_admin()` (schema fora da API, `security definer`, `search_path` vazio) confere o papel em `auth.users` (tirar o papel vale na hora), `aal2` no JWT e que a sessão do JWT ainda existe em `auth.sessions` (depois do "Sair", um token roubado para de valer no banco na hora, não em 1 h).

**Sessão:** cookie `httpOnly`, `secure`, `sameSite=lax`, `__Host-` em produção, 12 h. Não existe client do Supabase no navegador; as chaves seguem sem `NEXT_PUBLIC_`. "Sair" é `signOut({ scope: 'global' })`: encerra em todos os dispositivos.

**Login:** credencial errada e conta sem papel de admin dão o **mesmo** erro ("Email ou senha incorretos.") — a conta sem papel sai na hora. O `next` passa por `destinoSeguro`: só caminhos `/admin…`.

**Regras de escrita** (para #46–#53):
- Server Actions em `src/lib/admin/`, nunca API Routes. Toda action começa com `requireAdmin()` e valida a entrada no servidor — a do cliente é só conforto.
- **Modo leitura (#75):** não há banco local, então `pnpm dev`, `next start` e os previews da Vercel gravariam na produção. Fora de `VERCEL_ENV=production`, toda action que grava (tabela ou Storage) recusa logo depois da checagem de admin, com `bloqueioDeEscrita()` — `{ ok: false, erro }`, ou a falha `modo-leitura` nas do upload de foto (#74) — a menos que `ADMIN_ESCRITA_LIBERADA=1` (sem `NEXT_PUBLIC_`; nunca na Vercel). O painel mostra uma faixa no topo enquanto estiver bloqueado. Login, código, "Sair", leituras e `coordenadasDoLink` seguem funcionando. Não é camada de segurança (quem decide é a RLS): é proteção contra acidente. O `fronteiras.test.ts` exige a checagem em **toda** action nova do admin (as da auth ficam de fora); uma que só lê entra na lista `SO_LEITURA` do teste, que confere que ela não grava.
- `cafes` tem políticas de admin de `select`, `insert` e `update`. **Não há `delete`**, nem grant de `DELETE`/`TRUNCATE`: café sai do ar com `ativo = false`.
- `atualizado_em` é mantido por trigger — não escreva à mão.
- Depois de gravar, `revalidarCafe(slug)`: invalida a tag `cafes` (cache de `listCafesAtivos`) e o caminho do detalhe.
- `SUPABASE_SECRET_KEY` (ignora a RLS) não entra no app; o teste de fronteiras falha se aparecer em `src/`.
- Escrita usa `.from(…)` sem `.select(…)`: o que precisa ser lido de volta passa pelo `cafe-repository` (o teste de fronteiras confere).

**Fotos (#46):** `cafe_fotos` é a fonte da verdade (caminho no bucket, `ordem`, e a autorização: `origem` `propria`|`cedida`, `autorizado_por`, `autorizado_em`, `observacao`). Leitura e escrita só para admin; o público não lê. `cafes.fotos` é **cópia derivada** — os caminhos, na ordem — reescrita por trigger a cada mudança em `cafe_fotos`; outro trigger ignora qualquer valor de `fotos` vindo de fora (inclusive de um payload de edição). Foto nova vai para o fim (`ordem` automática).
- Bucket público `cafe-fotos`, caminho `{cafe_id}/{uuid}.webp`, **só `image/webp` até 2 MB** (o navegador converte antes). Gravar e remover só admin (políticas em `storage.objects`).
- Fluxo: o navegador redimensiona (lado maior 1600 px) e converte para WebP; `prepararUpload` valida a autorização e devolve uma URL assinada para um caminho gerado no servidor; o navegador faz `PUT` direto no Storage (sem chave: quem valida é o token; o arquivo não passa pela Vercel); `registrarFoto` grava a linha e revalida. Registro que falha apaga o arquivo; registro que não responde → o formulário chama `descartarUpload` (que não apaga se a linha existir). Órfão só se a aba fechar entre upload e registro — risco aceito, visível no painel do Storage e inofensivo (não aparece no site).
- **Ordem e remoção (#51):** botões Subir, Descer, Usar como capa e Remover em cada foto, com rótulo por foto (`Descer foto 2 de 4`) — sem arrastar. `reordenarFoto` grava `ordem` = posição só nas linhas que mudam, sem transação: gravação pela metade deixa empate (válido, sem `unique`) que a próxima corrige. `removerFoto` apaga **a linha antes do arquivo**: falha no Storage deixa um órfão inofensivo, nunca linha apontando para arquivo inexistente; sem a última foto, o trigger esvazia `cafes.fotos` e volta o placeholder. Remover confirma num diálogo com a miniatura, foco em "Cancelar". Depois da ação, o foco segue a foto que andou (ou a vizinha da removida) e um `role="status"` anuncia.
- Safari não gera WebP no canvas: o formulário recusa e pede Chrome, Edge ou Firefox. Sem fallback JPEG, de propósito.
- **Erros do upload (#74):** cada falha tem frase própria com etapa e ação (tentar de novo, entrar de novo, trocar de foto ou de navegador, ou "não adianta tentar de novo" quando o banco está errado). As actions devolvem `{ ok: false, falha }` crua (`foto-upload-erro`) e o formulário traduz com `mensagemDaFalha`: frase em `role="alert"`, que recebe o foco, e `<details>` "Detalhes técnicos" (etapa, código do Postgres/Storage, HTTP, mensagem original saneada; caminho só no órfão). Toda falha de servidor vai para `console.error("[fotos] <etapa> falhou", …)` com café e caminho — nunca cookie, token nem URL assinada. O Storage responde quase tudo com HTTP 400 e o status real no `statusCode` do corpo; o `exists` do storage-js **lança** para o que não é 400/404. O `PUT` tem timeout de 60 s. Em toda falha, a foto convertida e os campos ficam. Reordenar, remover, status e dados ainda usam o erro genérico.

**Dados (#48):** formulário com todos os campos de `Cafe` menos `id`, `slug`, `fotos` (trigger) e `ativo` (seção Status). `validarDadosCafe` roda no cliente e de novo em `salvarDadosCafe`, que só grava o que ele devolve — chave a mais no payload é ignorada.
- **Slug bloqueado** na edição: mudar quebraria links compartilhados. `bairro_slug` não é campo: sai de `slugify(bairro)`, para o filtro não ganhar bairro duplicado.
- **Normaliza ao salvar:** Instagram (`@u`, `u` ou link do perfil) → `https://instagram.com/u`, recusando outro site ou post; telefone com DDD → `(81) 99908-4986` / `(81) 3071-6834`; lat/lng aceitam vírgula decimal. Opcional vazio → `null`.
- **Horário estruturado:** "Fechado" ou de 1 a 3 turnos com `<input type="time">`, e "Repetir nos dias seguintes" na Segunda. Turnos em ordem e sem sobreposição; só o último pode virar a meia-noite (`14:00 – 00:00`). `24:00` só como fechamento (`00:00 – 24:00`, café 24 h): no formulário, que não tem 24:00, é `00:00 – 00:00`.
- **Mini mapa de posição** (#53): no cadastro e na edição, `MapaDePosicao` mostra o pin de lat/lng pelo `<CafeMap variant="mini">` (regra 1), que acompanha a posição quando ela muda. Valor incompleto ou fora da `REGIAO` deixa o pin na última posição válida. Só monta quando aparece na tela: na edição, com o `<details>` fechado, não cria mapa (cada um conta na cota do Mapbox).
- **Desvio consciente — link do Google Maps → coordenadas.** O botão "Buscar coordenadas" segue o redirect do link curto (`maps.app.goo.gl/…`) e lê o ponto do lugar (`!3d…!4d…`) na URL completa — sem API nem chave. O formato não tem contrato: se o Google mudar, dá erro e lat/lng são preenchidos à mão. `coordenadasDoLink` segue no máximo 3 redirects, conferindo a cada salto que é `https` e host do Maps (`ehLinkDoMaps`), para não virar proxy (SSRF). O link não é salvo.

**Cadastro (#53):** o café **nasce fora do ar** (`ativo = false`): a administradora sobe as fotos e o põe no ar pela seção Status, que revalida o site. O slug segue `slugify(nome)` até ser editado (apagado, volta a seguir) e é normalizado ao sair do campo; depois de criado, fica bloqueado como na edição. Slug repetido → erro `23505` do `unique`, mostrado no campo (conta também os cafés fora do ar). O `id` sai do servidor (`crypto.randomUUID()`), para reler pelo repositório sem `.select` na escrita. Slug antigo com redirect (`borsoi-cafe`) é recusado: o redirect venceria. A lista mora em `src/lib/slugs-antigos.mjs`, que o `next.config.mjs` usa para montar os redirects — slug novo que mudar entra lá.

**Supabase Auth:** signup público **desligado** (`config.toml` e painel), senha de 12+ com maiúscula, minúscula, dígito e símbolo, TOTP ligado. A conta é criada à mão no painel e promovida com `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '…'`. **Perdeu o autenticador:** remova o fator em Authentication › Users no painel e cadastre de novo no próximo login.

## Sugestões do público (#83)

Canal de mão única para quem usa o site falar da **plataforma** (não de um café): `/sugestoes`, com tipo (Sugestão · Problema · Outro) e texto. Sem identificação, sem resposta, sem email. Link num rodapé discreto — fim da lista da home (inclusive abaixo do estado vazio) e fim do detalhe — com `?de=` da página (`RodapeSugestoes`); nada flutuante nem no header. A triagem no admin é a issue seguinte; até lá, as mensagens se leem no painel do Supabase.

- **Página:** `noindex`, fora do sitemap, header do detalhe (**sem busca** — desvio do design). Formulário com `useFormState`: **funciona sem JS** (a action devolve o tipo e o texto, e a página volta preenchida no erro e no limite); com JS, valida antes de enviar, e o contador e o placeholder seguem o tipo. Tipo em `<input type="radio">` nativo com o visual dos botões do design (desvio: o `<button role="radio">` do design não funciona sem JS). A linha "Junto vai só a página de onde você veio" aparece também no mobile (desvio: é informação de privacidade); café inexistente ou fora do ar não vira origem. Contador em `ink-3` (não `placeholder`), não é `aria-live` — o erro de "passou do limite" é que se anuncia.
- **Banco:** `sugestoes` (tipo, mensagem, origem, status `nova`/`lida`/`arquivada`, datas — **sem hash de IP**) e `sugestoes_envios` (hash + data, só para o limite). O `anon` não tem grant em nenhuma das duas: a **única** coisa que executa é `enviar_sugestao` (`security definer`, `search_path` vazio), que trava por hash (advisory lock), recusa o 6º envio da hora com SQLSTATE `MC429` e grava envio e sugestão na mesma transação; os checks da tabela revalidam tipo, tamanho (`char_length`) e origem. Admin lê e muda só `status` (grant de coluna); sem `delete`. Um pg_cron (`sugestoes-envios-expurgo`) apaga de hora em hora os hashes com mais de 24 h.
- **Hash do IP — decisão de privacidade:** HMAC-SHA-256 do primeiro IP do `x-forwarded-for` (preenchido pela Vercel; senão `x-real-ip`) com `SUGESTOES_IP_SECRET`. É dado pseudonimizado, justificado pela segurança (limitar robôs), guardado só 24 h e **separado das mensagens**, sem ligação entre os dois. IP em claro, user-agent ou qualquer identificação nunca são gravados.
- **Action (`enviarSugestao`):** honeypot (`site`) finge sucesso sem gravar; erro do banco vira frase genérica (o log leva só o código — a mensagem do Postgres pode citar o texto); **sem segredo ou sem IP, falha fechada**. Não respeita o modo leitura (#75): envio de teste em dev cai em produção — arquive depois.
- **Texto guardado como escrito:** HTML e aspas não são escapados na entrada (corromperia `<3`, `a < b`); a segurança está na saída — o React escapa, e o admin exibe como texto puro.

## Filtragem acontece no cliente

O Server Component carrega **todos** os cafés ativos de uma vez (cache de 1 h no `cafe-repository`); filtros, busca e hover rodam no cliente. A home é **dinâmica** para o HTML já sair filtrado pelos params da URL — o primeiro render nunca mostra a lista completa piscando. Alvo de escala: 100–150 cafés (~100–200 KB). Mantém a sincronia card↔pin instantânea.

PostGIS fica no schema para a Fase 3 (busca por raio). Mover filtragem para o servidor depois é uma troca atrás do `cafe-repository`.

## Schema

Tabela `cafes` (PostgreSQL + PostGIS), migration em `supabase/migrations/`:

```sql
id uuid, slug text unique,
nome, bairro,                      -- bairro: exibição ("Graças")
bairro_slug,                       -- filtro ("gracas")
endereco, cidade,                  -- cidade: 'Recife' | 'Olinda' | 'Jaboatão dos Guararapes'
lat, lng,
location geography(Point, 4326),   -- gerado de lat/lng; Fase 3: busca por raio
selo_ascape boolean,               -- filtro "Recife Coffee"
selo_eu_amo_cafe boolean,          -- festival Eu Amo Café (6ª edição, 2026)
aceita_pets boolean,
tem_estacionamento boolean,        -- nome canônico (não `estacionamento`)
permite_coffee_office boolean,
acessivel_pcd boolean,             -- cadeira de rodas (fonte: Google)
opcoes_vegetarianas boolean,       -- vegetarianas/veganas
tem_ar_condicionado boolean,       -- nullable: null = sem informação (o Google não tem o atributo)
faixa_preco text,                  -- '$' | '$$' | '$$$'
horario_funcionamento jsonb,       -- 7 chaves segunda…domingo; "HH:MM – HH:MM", turnos por ", ", ou "Fechado"
instagram, telefone,               -- nullable; instagram é URL completa
fotos text[],                      -- derivada de `cafe_fotos` por trigger: caminhos no bucket, na ordem; nunca escrita à mão
ativo boolean,
criado_em, atualizado_em           -- metadado técnico, fora do tipo `Cafe`
```

O tipo `Cafe` em `src/lib/cafe.ts` espelha esse formato. Constraints no banco: `slug` único, `cidade` e `faixa_preco` com `check` e `horario_funcionamento` com as 7 chaves.

Cafés com `ativo = false` nunca aparecem na listagem pública nem em `/cafes/[slug]` — garantido também por RLS (`select` público só com `ativo`). Só o admin lê os inativos (ver "Admin e auth").

**Seed:** `supabase/seed/cafes.json` é a fonte da verdade (53 cafés: 51 ativos, 4 em Olinda, 2 em Jaboatão — associados da ASCAPE e cafeterias de café especial que não são). `supabase/seed.sql` é **gerado** por `pnpm seed:build` — nunca edite o SQL à mão; um teste falha se os dois saírem de sincronia. O mesmo teste trava a forma do seed: coordenadas dentro da região (Recife, Olinda, Jaboatão), `tem_ar_condicionado` só `true`/`false`/`null`, 7 dias de horário no formato válido e nenhum par de cafés ativos a menos de 30 m (um pin esconderia o outro).

Revisão de lançamento (#14): **O Melhor Cantinho da Cidade** e **A Vida é Bela** dividem de fato o endereço R. Francisco Lacerda, 394 (Várzea) — as coordenadas estão afastadas ~44 m **de propósito**, para os pins não se sobreporem. Na #38, o JSON novo chegou com os dois a 8 m; as coordenadas da #14 foram mantidas. Também na #38, `borsoi-cafe` virou `borsoi-cafe-riomar` (mesmo `id`); `/cafes/borsoi-cafe` redireciona (308, `next.config.mjs`, a partir de `src/lib/slugs-antigos.mjs`). O `palatsi-ilha-do-leite` tem bairro "Ilha do Leite" e endereço terminando em "- Paissandu": revisado e **mantido**.

## Filtros e URL

Dez filtros. Toda filtragem é compartilhável; ausência de param = filtro desligado.

| Filtro | Param | Formato |
|---|---|---|
| Selo Recife Coffee | `ascape` | `true` |
| Selo Eu Amo Café | `eu_amo_cafe` | `true` |
| Aceita pets | `pets` | `true` |
| Tem estacionamento | `estacionamento` | `true` |
| Permite coffee office | `coffee_office` | `true` |
| Acessível para PcD | `pcd` | `true` |
| Opções vegetarianas | `vegetariano` | `true` |
| Ar-condicionado | `ar_condicionado` | `true` — `null` (sem informação) não passa, como `false` |
| Bairro (**multi-select**) | `bairro` | slugs por vírgula — `gracas,espinheiro` |
| Faixa de preço (multi) | `preco` | `$,$$` |
| Busca | `q` | texto livre, debounce 300 ms |

Ida e volta precisa ser estável: estado → params → estado devolve o mesmo estado. Param desconhecido ou malformado é ignorado em silêncio, nunca quebra a página.

**Busca** casa por nome ou bairro, sem caixa nem acento; com várias palavras, cada uma precisa casar com um dos dois (cidade fica de fora). O campo existe **só no header da home** — 440×42 no desktop; no mobile, largura total entre o header e os chips, com texto de 16 px — abaixo disso o Safari do iPhone amplia a tela ao focar (desvio consciente: o design mobile não tem busca). O design também o põe no detalhe, mas lá não há lista para filtrar.

**Barra de filtros (#38):** só os dois selos, "Tem estacionamento", bairro e preço viram chip. No desktop, os outros cinco booleanos (pets, coffee office, PcD, vegetariano, ar-condicionado) ficam no dropdown **"Mais filtros"** — checkbox que aplica na hora, como o de bairro; rótulo `Mais filtros` → `Mais filtros · N`. No mobile não há "Mais filtros": o sheet do botão de filtros tem todos.

**Card desktop (#42, design v2):** selos em pílula sobre a foto; comodidades em **fichas redondas** de 28 px (`hover-soft`, ícone 15 px `ink-2`, gap 6 px), na ordem fixa de `cafe-atributos`. As 6 cabem numa linha (198 px), de **altura fixa** e reservada mesmo vazia — todos os cards da grade têm a mesma altura. Para caber em toda largura, a grade tem **1 coluna de 1024 a 1219 px** e 2 a partir de 1220 px (em 1024 px, meia coluna dá ~163 px úteis; 1180 px bastaria com barra de rolagem sobreposta, mas a permanente do Windows come ~15 px).

**Bairro é multi-select** — desvio consciente do design, que desenhou escolha única. Dropdown desktop e bottom sheet mobile usam checkbox; "Todos os bairros" limpa a seleção. Rótulo do chip: `Bairro` → nome do bairro → `N bairros`.

## Mobile (abaixo de `lg`)

Abaixo de 1024 px a home vira o layout mobile do design (tela 02, 390×844): header com logo e botão de filtros, busca, chips de 36 px com scroll lateral (Recife Coffee, Eu Amo Café, "Estacionamento" — rótulo curto, com o inteiro como nome acessível —, bairro e preço), cards compactos (thumb 92×92; 1 coluna abaixo de `sm`, 2 de `sm` a `lg`; detalhes em "Card compacto", abaixo) e FAB de 50 px "Ver mapa" / "Ver lista". O mapa do mobile só monta quando a visão "mapa" é pedida — o celular não baixa o Mapbox à toa.

- **Visão lista/mapa é estado local**, fora da URL e do histórico: a home sempre abre na lista. Os filtros (na URL) sobrevivem à troca; voltar para a lista fecha o card do pin.
- **Bottom sheets com rascunho** (Radix Dialog, `ui/sheet.tsx`): marcar opções não mexe na URL; "Ver N cafés" conta o resultado do rascunho e é o único que aplica (uma entrada no histórico). Esc, toque no fundo ou arrastar para baixo descartam. O arrasto (#39) é gesto próprio com pointer events, sem vaul, e só começa pela alça ou pelo título — a lista rola normalmente; fecha além de 25% da altura ou num peteleco rápido, senão volta à posição.
- **Desvio consciente — dois sheets** (reafirmado no design v2, #42): no design, o botão de filtros e o chip de bairro abrem o mesmo sheet (Comodidades + Bairro). Aqui o **botão de filtros** abre um sheet em seções — **Selos** e **Comodidades** (as 6) em chips de 36 px como os da barra (ícone + rótulo curto, o inteiro como nome acessível), e **Faixa de preço** em linhas de 48 px (o chip `$` sozinho perderia o nome); o **chip de bairro** abre o sheet de bairros.
- **Card compacto (#42, design v2):** os selos saem da linha de baixo e viram **selinhos só com ícone** no canto da thumb (24 px, `cream`). Comodidades em ícones soltos de 14 px; **no máximo 5 itens na linha** — com 6, as 4 primeiras e um **"+2"**, que mostra os nomes das que ficaram de fora no toque, hover e foco.
- **Badge** do botão de filtros: cada booleano, cada bairro e cada faixa contam 1; a busca não entra (`contarFiltrosAtivos`).
- **Card do pin:** o mesmo `CafeMapPreview` do desktop, preso embaixo (14 px das laterais, acima do FAB), **com X** — desvio do design, que não tem como fechar por teclado nem leitor de tela.

## Fotos: não use Google Places

A Fase 1 lança **inteiramente com placeholder** — gradiente listrado diagonal em tons de café, determinístico por café (o mesmo café gera sempre o mesmo gradiente). Na Fase 2 (#46), fotos próprias/autorizadas no Supabase Storage, sempre com registro de autorização (ver "Fotos (#46)" em "Admin e auth"); café sem foto continua com o placeholder.

**Exibição (#52):** toda foto do Storage sai por `FotoDoStorage` (`next/image` com `unoptimized`) — no site, dentro de `CafePhotoFrame` (`fill`, moldura de tamanho fixo — sem layout shift; fundo `hover-soft` enquanto carrega). `images.unoptimized` é **global** no `next.config.mjs`: nada passa por `/_next/image` nem pelo bandwidth da Vercel (a foto já chega otimizada do upload). `priority` só nos 4 primeiros cards da lista e na capa do carrossel; o resto é lazy, menos no carrossel, onde a foto à vista e as vizinhas carregam já (o lazy nativo mede distância em pixels, não em swipes). `alt`: `Foto de {nome}` no card e no carrossel; **vazio no preview do mapa** (desvio consciente: a foto fica dentro do link, que já tem o nome). `<img>` cru só para data URL e object URL locais (QR do login, prévia do upload).

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
| `seal-bg` / `seal-fg` | `#F6E8DF` / `#8F3F1F` | Badges dos selos (Recife Coffee, Eu Amo Café) |
| `erro` | `#B23A1E` | Erro de formulário nas sugestões — 5,97:1 sobre branco (o `#D9826A` de borda do design dá 2,86:1, abaixo dos 3:1). Os erros do admin seguem em terracota |
| `aviso-bg` / `aviso-line` / `aviso-fg` | `#FBEFE8` / `#EBC9B8` / `#7A3216` | Caixa de limite de envios (e de falha) nas sugestões — texto 8,1:1 |
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
- Avaliações: pílula "Em breve" + "Ainda sem avaliações" + "Logo você vai poder contar como foi seu café aqui — do espresso ao atendimento." — **sem CTA**, desvio consciente do design (#80): o "Avise-me quando abrir" prometia um aviso que nunca chegava, e guardar o email exige double opt-in, texto de privacidade (LGPD), descadastro e proteção contra robôs, para uma Fase 3 sem data. Se ela ganhar data, o aviso volta como issue própria com esse pacote
- FAB mobile: "Ver mapa" / "Ver lista" · Bottom sheet: "Ver N cafés"
- Detalhe: "Voltar ao mapa" · "Como chegar" · "Ver no Instagram" · "Selo Recife Coffee" · "Selo Eu Amo Café" · "Comodidades" · "Horário de funcionamento"
- Sugestões (#83): título "Sugestões" + "Uma ideia para o site ou algo que não funcionou direito? Escreva aqui. Toda mensagem é lida, mas não há resposta por este canal." · legenda "Sobre o quê?" · "Sua mensagem", dica e placeholder por tipo (`SOBRE_O_TIPO`) ou "Escolha um tipo acima para ver uma dica." · contador "N restantes" / "N a mais" · erros "Escolha o tipo da mensagem.", "Escreva sua mensagem.", "Escreva pelo menos 10 caracteres.", "Passou de 2.000 caracteres. Corte um pouco." · privacidade "**Você não precisa se identificar.** Evite colocar email, telefone ou outros dados pessoais no texto." + "Junto vai só a página de onde você veio: {café ou "a lista de cafés"}." · limite "**Opa, muitas mensagens seguidas.** Espere um pouco e tente de novo. Seu texto continua aqui." · falha (não está no design) "**Não deu para enviar agora.** Tente de novo em alguns minutos. Seu texto continua aqui." · "Enviar mensagem" · sucesso "Recebido, obrigado!" + "Sua mensagem chegou e vai ser lida. Não tem resposta por aqui, mas ela ajuda a deixar o mapa melhor." + "Voltar ao mapa" / "Enviar outra" · rodapé "Envie uma sugestão" depois de "Tem uma ideia ou viu algo quebrado?" (lista), "Sentiu falta de algo?" (estado vazio) ou "Viu algo estranho nesta página?" (detalhe)
- Distância: `1,2 km` (vírgula), depois do local: `Graças · 1,2 km`; no detalhe, "1,2 km de você"
- Local no card (`localLabel`): em Recife, só o bairro; fora, bairro e cidade pelo nome curto — `Casa Caiada, Olinda`, `Candeias, Jaboatão`. No detalhe (trilha e endereço), "Jaboatão dos Guararapes" inteiro

**Desvios conscientes no detalhe** (#4, #5) — o design não cobria esses casos:

- Fechado hoje: "abre amanhã" só quando amanhã abre de fato; senão "abre {dia}" (`abre segunda`), ou nada se nenhum dia abre
- Dia sem horário no `jsonb`: "Não informado" — nunca "Fechado". Se for hoje, o badge some
- Nota depois do horário, antes de "Avaliações": "Informações podem mudar. Na dúvida, confira com o café antes de ir." — `ink-3`, 12,5 px, ícone de info em `ink-3/60` (o design não tem a nota)
- 404: "Esse café não está no mapa" + "Talvez o endereço esteja errado ou o café tenha saído do diretório." + "Voltar ao mapa"
- Tags de "Comodidades" = as opções de filtro (2 selos + 6 booleanos; ar-condicionado só quando `true`) + faixa de preço. Não há lista própria de comodidades: o array `comodidades` (wifi, brunch…) foi removido na #17 por não ter consumidor
- Abaixo de `lg` (o design só desenhou desktop): uma coluna, com o aside (CTAs) logo depois do título
- Carrossel: `max(4, fotos)` slots — fotos reais nunca são cortadas. Placeholder tem legenda "foto · {nome}", não as legendas por slot do design ("Salão", "Fachada"…), que prometeriam fotos inexistentes. Abaixo de `lg`, 260 px de altura e swipe

## Horário e distância

`horario_funcionamento` tem os 7 dias em ordem **Segunda → Domingo**. Mas o `jsonb` **não preserva a ordem das chaves** (o Postgres as normaliza): a ordem de exibição vem de uma lista fixa de `DiaSemana` em `cafe-hours`, nunca de `Object.keys`. "Hoje" vem de `(getDay() + 6) % 7`. Um dia pode ser `"Fechado"`.

O badge **"Aberto hoje / Fechado hoje"** é Fase 1 — compara só o *dia*, sem hora. **"Aberto agora"** (com hora corrente) é Fase 3; não confundir.

Mas o *dia* é o de **`America/Recife`**, não o do servidor: a Vercel roda em UTC e, das 21h à meia-noite, já estaria no dia seguinte. Por isso `/cafes/[slug]` é **dinâmica** (`force-dynamic`), não ISR — HTML cacheado atravessaria a meia-noite com o dia errado. O Vitest roda com `TZ=UTC` para pegar esse tipo de bug.

Distância depende de geolocalização do navegador. Negada, indisponível ou não decidida: a distância **não aparece** e o card mostra só o bairro — sem erro, sem insistir. O layout precisa ficar correto nos dois estados.

A permissão é pedida **ao montar** a home ou o detalhe, uma vez por carregamento de página (a posição sobrevive à navegação client-side). Não consultamos a Permissions API antes: recusa já registrada faz o próprio navegador responder com erro, sem prompt — e, com a consulta, o Safari do iPhone não perguntava. Com posição, a lista da home sai **do mais perto ao mais longe**, já com filtros e busca aplicados (`ordenarPorDistancia`, em `cafe-distance`); empate e café sem coordenada válida (vai para o fim) mantêm a ordem alfabética do `cafe-repository`. Sem posição, a ordem é a alfabética. É automático: sem controle "Mais perto" e sem param na URL — quem recebe o link não está no mesmo lugar.

**Desvio consciente — a lista reordena quando a posição chega.** O HTML sai do servidor sem posição, em ordem alfabética; a reordenação acontece depois da hidratação, sem animação nem trava. Aceito porque, com permissão já concedida, a posição chega antes da primeira interação, e na primeira visita chega logo depois do "Permitir", quando a pessoa espera uma reação.

**Desvio consciente no formato** — o design só mostra `0,8 km`…`9,3 km`: abaixo de 1 km, a distância sai em **metros, de 10 em 10** (`850 m`), com piso de `10 m` (nunca `0 m`); o que arredonda para 1000 m já sai como `1,0 km`. Longe de Recife, separador de milhar: `2.130,4 km`.

## Domínio (#50)

**`https://mapadocafe-pe.com.br`**, na raiz — é o canônico. O resto converge para ele por 308:

- `www` → raiz: configurado no painel da Vercel (Domains), não no código.
- `*.vercel.app` de produção → raiz: `redirectsParaCanonico()` no `next.config.mjs`, com destino `siteUrl()`. Só com `VERCEL_ENV=production` — previews seguem acessíveis (atrás do SSO da Vercel) — e nunca quando o próprio canônico é `.vercel.app` (seria loop). Por isso `site-url` é `.mjs`: o `next.config.mjs` não importa TypeScript.
- **Desvio consciente — token do Mapbox sem restrição de URL.** O token padrão não aceita restrição, e criar um token restrito não está disponível na conta gratuita. Quem copiar o `pk.…` do bundle consegue usá-lo em outro site. Aceito porque a conta **não tem cartão**: o uso tem teto rígido, então o pior caso é a cota grátis acabar e o mapa parar até o mês virar — nunca cobrança. **Cadastrar cartão exige antes restringir o token** (domínio + `localhost:3000`/`3001`), senão abuso vira fatura.
- Supabase Auth: Site URL é o domínio; Redirect URLs, o domínio e `localhost:3000`. O login do admin não depende delas (senha + TOTP por Server Action, sem link por email).

## SEO (#44)

`NEXT_PUBLIC_SITE_URL` alimenta `metadataBase`, canonical, sitemap e JSON-LD (`siteUrl()`, `src/lib/site-url.mjs`); sem ela, o domínio de produção da Vercel, e fora dela `localhost`. Nenhum domínio escrito no código. Canonical da home é `/`, sem params de filtro. `sitemap.xml` lista a home e os cafés ativos via `listCafesAtivos` (mesmo cache) e não tem `lastModified`; `robots.txt` bloqueia `/admin`. Café inexistente ou inativo é **404** de verdade, com `noindex` e título "Café não encontrado · Mapa do Café" (`metadata` do `not-found.tsx`, que vale para todo 404). Título do detalhe `{nome} · Mapa do Café`; a descrição não usa preposição antes do bairro ("nas Graças", "no Pina"), porque o banco não sabe qual é.

**Compartilhamento (#49):** Open Graph + Twitter Card `summary_large_image`. A imagem do café vem de `imagemCompartilhamento` (`cafe-seo`):
- **Com foto:** a capa (`fotos[0]`) como está — WebP, na proporção dela. O `next/og` do Next 14 não lê WebP, então não há composição com o logo; o LinkedIn pode não mostrar WebP (risco aceito, sem `sharp`).
- **Sem foto:** `/cafes/[slug]/og`, gerada com `next/og` (`src/lib/og/imagens.tsx`): as listras do placeholder do café (`tonsDoPlaceholder`, as mesmas do card), cartão `cream` com o nome em Caprasimo e o `localLabel` em DM Sans, logo 2d no canto. Lê de `listCafesAtivos` (cache de 1 h); inativo ou inexistente → 404.
- **Home:** `src/app/opengraph-image.tsx`, estática; na raiz, vale também de fallback (404). O `openGraph` de uma página substitui o do layout inteiro — **inclusive a imagem do `opengraph-image.tsx` da raiz** (por isso a home não define `openGraph` nem `og:url`); quem define o seu espalha `OPEN_GRAPH_BASE` e traz a própria imagem.
- O satori não aceita `repeating-linear-gradient`: as listras saem de um ladrilho de `linear-gradient` de 40 px. Não lê `next/font` nem Tailwind: estilos inline e os TTF (OFL) em `src/lib/og/fonts/`, lidos por `process.cwd()` e levados à função pelo `outputFileTracingIncludes` do `next.config.mjs` — rota nova que use as fontes entra lá.

**Ícones (#60):** convenções de arquivo do App Router — `src/app/favicon.ico` (16+32), `icon.svg` e `apple-icon.png` (180, quadrado cheio; o iOS arredonda) —, sem `metadata.icons` nem `<link>` à mão. `manifest.ts` só põe o ícone na tela inicial do Android (`icon-192`/`icon-512` em `public/`, `display: "browser"`): não é PWA, sem service worker. Os arquivos vieram sem a proveniência C2PA (`<metadata>` no SVG, chunk `caBX` nos PNGs, com os pixels intactos).

## Skeleton (#45)

Home e detalhe têm `loading.tsx`, que importa principalmente quando o Supabase acorda da hibernação. A home fica no route group `src/app/(home)/` (a URL continua `/`) para o skeleton dela não aparecer em outras rotas, como o `/admin`. O skeleton copia o formato da página: logo real, blocos no resto (busca, chips, contador, cards, mapa; no detalhe, trilha, carrossel, título, aside e comodidades). O "Voltar ao mapa" do detalhe é real, para desistir sem esperar.

- **Mesmas medidas, num lugar só:** as classes de formato que o skeleton repete (card, grade, barra, busca, carrossel, aside…) moram em `src/components/medidas.ts` e são usadas pelos dois lados. Mudou o card, muda o skeleton. O módulo é neutro de propósito: constante exportada de arquivo `"use client"` chega ao Server Component como referência de cliente, não como string.
- **Cores:** `hover-soft` sobre branco, `line` sobre o `cream`, `map-bg` no mapa. Os blocos pulsam só com `motion-safe:animate-pulse`.
- **Acessibilidade:** os blocos são `aria-hidden`; um `role="status"` em `sr-only` diz "Carregando cafés…" / "Carregando café…".
- **O 404 do detalhe mora no `layout.tsx`** (#72): o `loading.tsx` põe a página num Suspense, e o shell sai com 200 antes de a página chamar `notFound()` — virava soft-404. `src/app/cafes/[slug]/layout.tsx` checa a existência fora desse Suspense; `getCafe` (`get-cafe.ts`, `cache` do React) faz layout, metadata e página dividirem uma query. Rota nova com `loading.tsx` e `notFound()` precisa do mesmo.
- **Limitação do Next 14 no detalhe:** o `generateMetadata` busca o café e segura o streaming. No acesso direto a `/cafes/[slug]`, o skeleton não aparece; ele só aparece na navegação dentro do site, depois que o prefetch do link termina. Resolver isso exige Next 15.2+ (metadata em streaming) ou tirar a query do metadata, o que perderia título e canonical por café.

## Convenções

- Textos e microcopy em pt-BR, tom casual e acolhedor ("bairro", não "distrito")
- Server Components por padrão; `"use client"` só com justificativa
- Mutations via Server Actions, não API Routes
- Componentes shadcn/ui não devem regredir em acessibilidade (teclado + ARIA vêm por padrão) ao customizar estilo
- Ícones de comodidade nos cards são **informação, não decoração**: precisam de rótulo acessível — `title` sozinho não basta. Nome em `sr-only` + dica própria (`dica.ts`) no hover
- **Card com stretched link (#42):** o link é o nome do café, esticado sobre o card (`after:inset-0`), para o "+N" ser um `<button>` fora do `<a>`. **Desvio consciente:** só o "+N" recebe foco; fichas e selinhos têm a dica só no hover (com foco em cada um seriam até 8 Tabs por card, ~400 na lista) — leitor de tela lê os nomes pelo `sr-only`. Clique exatamente numa ficha não abre o detalhe (ela fica acima da camada do link para receber o hover)
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
| `cafe-photos` | Unitário puro — placeholder determinístico, precedência Storage > placeholder, caminho → URL pública | **Alta** |
| `cafe-dados` | Unitário puro — cada constraint do banco, horário (turnos, "Fechado", meia-noite, sobreposição), Instagram e telefone, opcionais vazios, coordenadas de link do Maps e hosts aceitos; os 53 cafés do seed passam sem mudança | **Alta** |
| `foto-ordem` | Unitário puro — subir, descer, capa, bordas e movimento inválido, normalização de buracos e empates | **Alta** |
| `foto-upload-erro` | Unitário puro — cada código HTTP, Storage e Postgres com frase própria, órfão, desconhecido → genérica, `sanear` sem URL nem token | **Alta** |
| `foto-upload` | Unitário puro — tipos e limites (HEIC), dimensões, autorização (obrigatórios, data em Recife, sem futuro), caminho de outro café recusado | **Alta** |
| `cafe-repository` | Integração — instância de teste do Supabase, **não mock** | Média (pós-MVP) |
| `cafe-card`, `filter-bar` | Componente — interação visível (clique no chip muda a URL) | Média |
| `sugestao` | Unitário puro — limites medidos depois da normalização (invisíveis, emoji = 1), NFC, HTML e "SQL" intactos, tipo, honeypot, `origemSegura`, `hashDoIp` | **Alta** |
| `sugestoes-actions` | Dublê do client e dos headers — inválido e honeypot nunca chegam ao banco, só `rpc('enviar_sugestao')` com o texto normalizado e o hash (nunca o IP), `MC429` → limite, sem segredo ou sem IP → falha fechada | **Alta** |
| `admin-auth` | Unitário puro — etapas do login (role só em `app_metadata`, `aal1`/`aal2`, com e sem autenticador), `destinoSeguro` contra open redirect, `isUuid` | **Alta** |
| `admin-escrita` | Unitário puro — produção libera; preview, development e fora da Vercel bloqueiam; `ADMIN_ESCRITA_LIBERADA=1` libera em qualquer ambiente, outro valor não | **Alta** |
| `fronteiras` | Guarda estática — toda Server Action do admin (achada por varredura, só `export async function`; as da auth de fora) começa por `requireAdmin()` ou `if (!(await sessaoDeAdmin()))` e logo depois checa o modo leitura, salvo a lista de só leitura; só o `cafe-repository` lê tabela (fora dele, `.from` só para escrever, no admin), só a action de sugestões chama `.rpc` (e só a `enviar_sugestao`), quem pode importar `@supabase/*`, nenhuma chave em `NEXT_PUBLIC_`, nenhuma secret key, só o `cafe-map` importa `mapbox-gl` | **Alta** |
| RLS de admin, triggers (`atualizado_em`, `cafes.fotos`), bucket, `enviar_sugestao` e pg_cron | **Sem banco de teste** — verificação manual em produção depois da migration, num `begin … rollback` simulando claims | — |
| `cafe-map` | **Sem teste automatizado** — Mapbox em jsdom custa muito e entrega pouco. Verificação manual. | — |

E2E está fora da Fase 1.

## Segurança (#59)

Rodada de testes de exploit contra o próprio site, para provar que as garantias do admin se sustentam diante de um atacante. Relatório e evidências em [`docs/security/pentest-2026-10.md`](./docs/security/pentest-2026-10.md) — repita a rodada completa (e recrie o relatório, datado) antes de divulgar o link do admin, e a cada mudança de política de RLS.

**Onde moram os testes:**
- `pnpm test` (offline, a cada commit): guardas estáticas em `src/lib/fronteiras.test.ts` (toda Server Action de escrita começa com `requireAdmin()`; só o `cafe-repository` lê tabela; nenhuma chave no bundle), `src/lib/admin/require-admin.test.ts`, payloads maliciosos em `src/lib/cafe-dados.test.ts` e open redirect em `src/lib/admin-auth.test.ts`.
- `pnpm test:security` (contra um Supabase real): `security/` — RLS, Storage, o exploit HTTP das Server Actions e o status 404 do detalhe (`rotas.test.ts`, só leitura). Fora do CI; pula sozinho sem `.env.security`.

**Como rodar os que escrevem:** num **projeto Supabase descartável** (as mesmas migrations + seed, criado para a rodada e **apagado ao fim** — nunca produção), com um `.env.security` na raiz (gitignored): `SECURITY_SUPABASE_URL`, `SECURITY_PUBLISHABLE_KEY`, `SECURITY_SECRET_KEY` (o **service_role JWT legado** — a `sb_secret_…` nova dá "Invalid API key" no `supabase-js`), `SECURITY_APP_URL`. A trava em `security/env.ts` recusa escrever se a URL for a de produção. Login por email vem **desligado** num projeto novo: habilite no descartável (Management API `config/auth` → `external_email_enabled: true`, mantendo `disable_signup: true`) para o teste de usuário autenticado sem papel. O exploit das actions precisa de `pnpm build` (os action IDs) e de um `next start` apontado para o descartável, **com `ADMIN_ESCRITA_LIBERADA=1`** — sem ela, o modo leitura recusa antes e o teste não prova as outras camadas. Os só de leitura e de negação podem rodar em produção.

**O que nunca pode regredir:** anônimo não lê café inativo nem escreve em `cafes`/`cafe_fotos`/bucket; usuário autenticado sem `app_metadata.role='admin'` é barrado pela RLS, mesmo com `user_metadata.role='admin'`; Server Action sem sessão ou cross-origin não grava; signup público desligado; nenhuma secret key (`sb_secret_`, `service_role`) nem token `sk.` do Mapbox no bundle. Os headers de segurança (`SECURITY_HEADERS` no `next.config.mjs`) valem para todo o site.

## Fases

| Fase | Escopo |
|---|---|
| **Fase 1 — MVP** | Seed 53 cafés (51 ativos) · Listagem · Mapa · 10 filtros + busca · URL sync · hover card↔pin · `/cafes/[slug]` com carrossel, horários e badge "Aberto hoje" · distância e lista ordenada por proximidade · estado vazio · mobile · deploy |
| **Fase 2 — Polimento** | Admin + auth · CRUD · **upload de fotos (item de maior valor)** · SEO · lazy load · skeleton · domínio |
| **Fase 3 — Comunidade** | Avaliações · "Aberto agora" · sugestão de café · busca por raio (PostGIS) |

Não-objetivos: app nativo, reservas, delivery, monetização, multi-cidade, auth de usuário final.

## Notas operacionais

- **Supabase free hiberna após ~1 semana sem uso.** Num site de portfólio que pode ficar dias sem visita, o primeiro acesso depois disso é lento. Saiba disso antes de mandar o link para alguém.
- **Risco de dado:** horário, faixa de preço, pets, coffee office e os atributos da #38 mudam e não têm fonte oficial. Em `acessivel_pcd` e `opcoes_vegetarianas`, `false` muitas vezes quer dizer "sem informação" (sobretudo fora da ASCAPE); `tem_ar_condicionado` tem só 5 confirmados, o resto é `null` e pede curadoria. Faltam Instagrams (Saltim, Mafrita, Tokyo's, Soto, Amaro, CoffeeTown). Desde a #48, o admin corrige sem deploy. `permite_coffee_office` é o mais subjetivo dos quatro e o que mais frustra se estiver errado.
- **Dev aponta para a produção** (sem banco local, por decisão). Desde a #75, o admin fora da produção da Vercel fica em **modo leitura**: dá para logar e navegar, mas nada grava. Para gravar de propósito a partir do dev: `ADMIN_ESCRITA_LIBERADA=1 pnpm dev`. Testar migration antes da produção continua sem caminho (seria um staging).
- **Pins colados pelo admin.** A regra "nenhum par de cafés ativos a menos de 30 m" só é garantida pelo teste do seed; o formulário do admin (#48) valida um café por vez e não compara com os outros. Depois de mudar coordenadas pelo admin, confira no mapa se um pin não esconde outro.
- **Login do admin sem captcha.** As Server Actions chamam o Supabase de IPs da Vercel, então o rate limit de login por IP não separa atacante de administradora (e pode bloqueá-la por minutos). O TOTP limita o estrago de uma senha vazada; um captcha (Cloudflare Turnstile, suportado pelo Supabase Auth) fica para uma possível Fase 4, se houver necessidade.
- **Sugestões dependem de `SUGESTOES_IP_SECRET` na Vercel** (Production e Preview). Sem ela, o envio falha fechado e ninguém consegue mandar nada. Trocar o valor só zera os limites em curso. A `enviar_sugestao` é exposta pela API do Supabase: quem tivesse a publishable key (só no servidor, nunca no bundle) poderia chamá-la direto com hashes inventados, pulando o limite — mais um motivo para a chave nunca ganhar `NEXT_PUBLIC_`.
- O filtro **Recife Coffee** era redundante no lançamento (todos os 29 eram ASCAPE); desde a #38 ele discrimina (35 dos 51 ativos).

## Links

- **PRD:** https://github.com/pradokez/mapa-do-cafe/issues/1
- **Design aprovado:** projeto Claude Design `Mapa do Café.dc.html` — 4 telas + variantes de logo (2d aprovada)
- **Seed:** https://www.ascape.com.br/cafeterias-associadas
- **Plano da Fase 1:** [`plans/mapa-do-cafe.md`](./plans/mapa-do-cafe.md)
- **Tarefas:** issues do GitHub (#3–#14 = Fase 1), uma por fase do plano
