# 08 — Backend e APIs

## Inventário completo de rotas

Todas as 49 rotas abaixo foram localizadas via inspeção direta do sistema de arquivos (`find app/api -name route.ts`). As marcadas "lida" foram abertas e conferidas integralmente; as demais foram confirmadas apenas por presença de arquivo e, quando aplicável, por padrão observado em rotas vizinhas do mesmo serviço.

| Método | Rota | Serviço chamado | Validação | Auth | Paginação | Testes diretos | Risco |
|---|---|---|---|---|---|---|---|
| GET | `/api/alerts` | (não lida) | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | NÃO FOI POSSÍVEL CONFIRMAR | Nenhum | MÉDIO |
| GET | `/api/audit-trail` | `services/audit-trail.ts` | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | NÃO FOI POSSÍVEL CONFIRMAR | Nenhum | MÉDIO |
| GET | `/api/copernicus/search` | `services/copernicus-engine.ts` | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | NÃO FOI POSSÍVEL CONFIRMAR | `tests/copernicus-engine-contract.test.ts` (não executado) | MÉDIO |
| GET | `/api/copernicus/site` | idem | — | Nenhuma | — | idem | MÉDIO |
| GET | `/api/copernicus/status` | idem | — | Nenhuma | — | idem | MÉDIO |
| GET | `/api/copernicus/validation` | `services/copernicus-truth.ts` | — | Nenhuma | — | `tests/copernicus-truth.test.ts` | MÉDIO |
| GET | `/api/dashboard` | `lib/filters.ts`, `lib/operator.ts`, `services/site-service.ts` | Filtros via lista fixa de colunas (`FILTER_COLUMNS`), SQL parametrizado (`?`) — **lida integralmente** | **Nenhuma** | Sim (`page`, `pageSize=30` fixo) | Não localizado | ALTO — endpoint mais pesado (7 agregações SQL por chamada), sem autenticação, mitigado por cache em memória de 5min |
| GET | `/api/data-quality` | `services/data-quality-engine.ts` | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | — | Nenhum | MÉDIO |
| POST | `/api/data-trust/recalculate` | `services/data-trust-engine.ts::recalculateDataTrust` — **lida integralmente** | Nenhuma validação de corpo observada além do `limit` | **Nenhuma** | `limit` (default 500) | Nenhum | **ALTO — endpoint de escrita (recalcula e persiste scores em lote) sem qualquer autenticação nem limite de taxa** |
| GET | `/api/data-trust` | `dataTrustDashboard` — lida integralmente | — | Nenhuma | Top 50 fixo | Nenhum | ALTO (mesmo motivo do dashboard) |
| GET | `/api/data-trust/site` | `dataTrustForSite` — lida integralmente | `id` de site | Nenhuma | — | Nenhum | MÉDIO |
| GET | `/api/digital-twin/site` | `services/enterprise-v3-engine.ts` | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | — | Nenhum | MÉDIO |
| GET | `/api/duplicates` | `services/duplicates-engine.ts` | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | — | Nenhum | MÉDIO |
| GET | `/api/evidence-center/export` | `services/evidence-center-engine.ts`, `utils/csv.ts`/`pdf.ts` | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | — | Nenhum | MÉDIO — endpoint de exportação sem auth |
| GET | `/api/evidence-center/site` | idem | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/executive-reports` | (3KB, não lida linha a linha) | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | — | Nenhum | MÉDIO |
| GET | `/api/executive-workspace` | `services/enterprise-v3-engine.ts` | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/export` | `utils/csv.ts`, `utils/pdf.ts`, `lib/export-path.ts` — **24KB, maior rota do projeto, não lida linha a linha, e está entre os arquivos com erro de sintaxe no working tree atual (linha 221)** | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | — | `tests/export-path.test.ts` (parcial, só testa `export-path`, não a rota inteira) | **ALTO — maior superfície de código não auditada em profundidade + quebrado no momento** |
| GET | `/api/geointelligence` | (não lida; está entre os arquivos com erro de sintaxe no working tree atual, linha 16) | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | — | Nenhum | ALTO (quebrado no momento) |
| GET | `/api/geospatial/clusters` | `getClustersInBoundingBox` — lida integralmente | `parseBoundingBox` | Nenhuma | Limite fixo | `tests/geospatial-*` (múltiplos, não executados) | MÉDIO (não commitado ainda) |
| GET | `/api/geospatial/nearest` | `getNearestSites` — lida integralmente | idem | Nenhuma | Limite | idem | MÉDIO |
| GET | `/api/geospatial/radius` | `getSitesWithinRadius` — lida integralmente | idem | Nenhuma | Limite | idem | MÉDIO |
| GET | `/api/geospatial/summary` | `getCoordinateQualitySummary`/`getGridSummary` — lida integralmente | idem | Nenhuma | Limite | idem | BAIXO (retorna vazio hoje — tabela sem dados) |
| GET | `/api/geospatial/viewport` | `getSitesInBoundingBox` — **lida integralmente**, código exemplar (comentários de rationale, testes de contrato) | `parseBoundingBox`, `parseOptionalPositiveInt`, erro 400 estruturado | Nenhuma | `limit`/`totalCount`/`truncated` explícitos | `tests/geospatial-api-contract.test.ts` | MÉDIO (ausência de auth é o único risco real aqui; o resto é bem controlado) |
| GET | `/api/market` | `services/market-engine.ts` | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | — | Nenhum | MÉDIO |
| GET | `/api/mission-control` | (5,5KB, não lida linha a linha) | NÃO FOI POSSÍVEL CONFIRMAR | Nenhuma | — | Nenhum | MÉDIO |
| GET | `/api/national-timeline` | `services/national-timeline-engine.ts` | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/opportunities` | (não lida) | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/rollout` | `services/rollout-engine.ts` | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/scenario-planner` | `services/strategic-data.ts` | — | Nenhuma | — | — | MÉDIO |
| GET/POST | `/api/sentinel-core/build` | `sentinel-core/engine.ts::buildGraph` — **escreve no banco** | NÃO FOI POSSÍVEL CONFIRMAR limites de entrada | **Nenhuma** | — | Nenhum | **ALTO — endpoint que reconstrói o grafo de conhecimento, sem auth** |
| GET | `/api/sentinel-core/insights` | `getInsightsForScope` | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/sentinel-core/municipality` | `getMunicipalityKnowledge` | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/sentinel-core/operator` | `getOperatorKnowledge` | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/sentinel-core/recommendations` | `getRecommendationsForScope` | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/sentinel-core/search` | `searchKnowledge` — busca livre por texto no grafo | Comprimento de query NÃO FOI POSSÍVEL CONFIRMAR (arquivo de 330 bytes, não lido) | Nenhuma | — | — | MÉDIO-ALTO se busca livre não for clampada (não confirmado) |
| GET | `/api/sentinel-core/site` | `getSiteKnowledge` | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/sentinel-core/status` | `getGraphStatus` | — | Nenhuma | — | — | BAIXO |
| GET | `/api/site-recommendation` | (não lida) | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/sites/[id]/intelligence` | (5,3KB, não lida linha a linha) | Rota dinâmica `[id]` | Nenhuma | — | — | MÉDIO |
| GET/POST | `/api/sites/[id]/notes` | `services/site-notes.ts` — **escreve nota livre no banco** | NÃO FOI POSSÍVEL CONFIRMAR sanitização de texto livre | **Nenhuma** | — | — | **ALTO — gravação de texto arbitrário do usuário sem autenticação nem limite de tamanho confirmado** |
| GET | `/api/strategic-planning` | `services/strategic-data.ts` | — | Nenhuma | — | — | MÉDIO |
| GET | `/api/system-health` | (3,7KB) | — | Nenhuma | — | — | MÉDIO — endpoint de saúde do sistema, mencionado em `docs/stage-0/08_REMAINING_RISKS.md` como "reachable by anyone" |
| GET | `/api/telecom-ai` | `answerTelecomQuestion` — **lida integralmente**; texto livre via `clampQueryText` (300 chars) — **está entre os arquivos com erro de sintaxe no working tree atual** | `clampQueryText` aplicado (WP0.7) | Nenhuma | — | Nenhum | ALTO (quebrado no momento; sem essa quebra, seria MÉDIO — é um dos poucos endpoints com clamp de entrada confirmado) |
| GET | `/api/validation-history/site` | `validationHistory` | — | Nenhuma | Top 100 fixo | — | MÉDIO |

**Nenhuma rota de API tem autenticação, autorização, ou rate limiting** — confirmado tanto por ausência de qualquer padrão de auth no código lido (nenhum middleware, nenhum header `Authorization` verificado, nenhuma sessão) quanto pela documentação explícita das auditorias anteriores (`docs/stage-0/08_REMAINING_RISKS.md`: "No authentication or authorization anywhere ... Every API endpoint ... is reachable by anyone who can reach the server"). Ver `10_SECURITY_AUDIT.md`.

## Padrões observados nas rotas lidas integralmente

- **Injeção de SQL:** não identificado nenhum caso de concatenação de valor de usuário diretamente em SQL. Todos os pontos lidos usam parâmetros posicionais (`?`) com `.get(...)`/`.all(...)`/`.run(...)` do `node:sqlite`. Nomes de coluna interpolados em template strings (`group(column)`, `volume(column)` no dashboard) vêm de literais fixos no código-fonte do chamador, não de entrada do usuário — **não constitui injeção**, mas é um padrão frágil: se um novo call-site algum dia passar um nome de coluna vindo de `request.nextUrl.searchParams` para essas funções, a proteção contra injeção desaparece silenciosamente (nenhuma validação de allowlist dentro das próprias funções `group`/`volume`/`average`).
- **Ausência de limites:** a maioria das rotas fora do módulo geoespacial (Stage 1) **não usa `lib/request-guard.ts`** — o próprio comentário do arquivo admite isso: "Extending this to every one of the 43 documented endpoints is tracked as Stage 1+ backlog, not silently claimed here."
- **Consultas N+1:** não identificado nenhum caso direto nos arquivos lidos (as agregações usam `GROUP BY` em SQL, não laços com uma query por item) — mas não foi possível confirmar para as ~30 rotas não lidas linha a linha.
- **Leitura integral da base:** não identificada em nenhuma rota lida (todas usam `LIMIT`); porém `/api/export` (24KB, não lida em profundidade) é a candidata mais provável a exportar volumes grandes — `EXPORTACOES/sites_consolidados.csv` tem 73MB, o que sugere que, em algum ponto do fluxo de exportação, a base quase completa é de fato serializada.
- **Erros silenciosos / exposição de detalhes internos:** o padrão observado é bom nesse ponto específico — os `catch` lidos (`dashboard`, `telecom-ai`, `viewport`) logam no servidor (`console.error`) e retornam uma mensagem genérica em português ao cliente, sem stack trace nem detalhes internos.
- **Cache:** apenas `/api/dashboard` tem cache observado (`Map` em memória, TTL 5min, cap de 40 entradas com descarte da mais antiga por ordem de inserção — não é LRU real, é FIFO). As demais 48 rotas não têm cache confirmado.

Status geral: **CONFIRMADO NO CÓDIGO** para as 12 rotas lidas integralmente; **NÃO FOI POSSÍVEL CONFIRMAR** detalhes internos das ~37 rotas restantes além da existência do arquivo e do padrão de nomeação/serviço associado.
