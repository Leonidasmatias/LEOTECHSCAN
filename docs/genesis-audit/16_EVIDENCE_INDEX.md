# 16 — Índice de Evidências

Formato: `EVID-XXX` — achado, arquivo/comando, símbolo, relacionado a.

## Ambiente e repositório

- **EVID-001** — Ambiente da VM-ponte de auditoria: Linux Ubuntu 22.04, Node v22.22.3, npm 10.9.8, git 2.34.1. Comando: `uname -a && node --version && npm --version && git --version`. Relacionado a: `01_ENVIRONMENT_AND_REPOSITORY.md`.
- **EVID-002** — Repositório: branch `master`, 2 commits, sem remotes. Comando: `git branch --show-current`, `git log --oneline -20`, `git remote -v`. Relacionado a: RISK-03.
- **EVID-003** — 19 arquivos modificados não commitados; 14 arquivos untracked (trabalho geoespacial Stage 1). Comando: `git status --porcelain`. Relacionado a: RISK-02, `11_TESTS_AND_QUALITY.md`.
- **EVID-004** — `git diff --stat`: 41 inserções, 1.639 remoções nos 19 arquivos modificados — padrão anômalo de deleção em massa. Comando: `git diff --stat`. Relacionado a: RISK-02.
- **EVID-005** — `app/api/telecom-ai/route.ts` truncado no working tree (`console.error("telecom_ai_fa`, sem newline final) vs. versão `HEAD` completa (18 linhas). Comando: `git diff -- app/api/telecom-ai/route.ts`, `git show HEAD:app/api/telecom-ai/route.ts`. Relacionado a: RISK-02.
- **EVID-006** — Arquivo confirmado estável no estado truncado (dois `md5sum` idênticos com 5s de intervalo). Comando: `md5sum app/api/telecom-ai/route.ts` (2x). Relacionado a: RISK-02.
- **EVID-007** — `package.json`: 5 dependências de produção, 6 de desenvolvimento; nenhuma dependência de banco de dados de terceiros. Arquivo: `package.json`. Relacionado a: `01_ENVIRONMENT_AND_REPOSITORY.md`.
- **EVID-008** — Dois lockfiles simultâneos (`package-lock.json`, `pnpm-lock.yaml`). Comando: `ls`. Relacionado a: RISK-06.
- **EVID-009** — Busca por "sqlite" em ambos os lockfiles não retornou nenhuma linha — confirma que o driver de banco é `node:sqlite` nativo, não um pacote npm. Comando: `grep -iE sqlite pnpm-lock.yaml package-lock.json`. Relacionado a: RISK-11.

## Banco de dados

- **EVID-010** — Schema completo: 18 tabelas de usuário, 11 índices, 0 views, 0 triggers. Comando: consulta Python `sqlite3` somente leitura a `sqlite_master`. Relacionado a: `04_DATA_AND_DATABASE.md`.
- **EVID-011** — `sites`: 299.308 linhas, 39 colunas. Comando: `PRAGMA table_info(sites)`, `SELECT COUNT(*) FROM sites`. Relacionado a: `03_FUNCTIONAL_CATALOG.md`, `04_DATA_AND_DATABASE.md`.
- **EVID-012** — `site_trust_scores`: 270 linhas (0,09% de 299.308). Comando: `SELECT COUNT(*) FROM site_trust_scores`. Relacionado a: RISK-04.
- **EVID-013** — `site_geospatial_status`, `site_coordinate_quality`, `geospatial_grid_cells`: 0 linhas cada. Comando: `SELECT COUNT(*)` em cada tabela. Relacionado a: RISK-05.
- **EVID-014** — `site_spatial_index` (R-Tree): 299.308 linhas — 100% da base indexada espacialmente. Comando: `SELECT COUNT(*) FROM site_spatial_index`. Relacionado a: `06_GEOSPATIAL_AND_MAPS.md`.
- **EVID-015** — `PRAGMA integrity_check` = `ok`. Relacionado a: `04_DATA_AND_DATABASE.md`, `12_PERFORMANCE_BASELINE.md`.
- **EVID-016** — `metadata`: `imported_at=2026-06-27T04:21:17Z`, `source_name=BASE SPAZIO COM IBGE_n.xlsx, VIVO SITES.xlsx`, `operators={"TIM":298341,"VIVO":967}`, `fallback_used=True`. Relacionado a: `04_DATA_AND_DATABASE.md`.
- **EVID-017** — Ausência de `FOREIGN KEY` em 6 tabelas satélite; presente em `site_geospatial_status`/`site_coordinate_quality`. Comando: `PRAGMA foreign_key_list(<tabela>)` para cada uma. Relacionado a: RISK-09.
- **EVID-018** — Índices confirmados por texto completo do `CREATE INDEX` via `sqlite_master`. Relacionado a: `04_DATA_AND_DATABASE.md`, `12_PERFORMANCE_BASELINE.md`.

## Scores e inteligência

- **EVID-019** — Fórmulas LTS/TCI/OPI/SRI lidas integralmente. Arquivo: `services/sentinel-scoring.ts`. Símbolos: `calculateLts`, `calculateTci`, `calculateOpi`, `calculateSri`. Relacionado a: `05_SCORES_AND_INTELLIGENCE.md`.
- **EVID-020** — Pesos/faixas de LTS/OPI/SRI externalizados; TCI hardcoded no código. Arquivo: `config/sentinel_rules.json` vs. `services/sentinel-scoring.ts::calculateTci`. Relacionado a: RISK-13.
- **EVID-021** — Fórmula de Trust Score: `overallConfidence*0.78 + importConfidence*0.12 + 10 - duplicatePenalty - alertPenalty`. Arquivo: `services/data-trust-engine.ts::dataTrustForSite`. Relacionado a: `05_SCORES_AND_INTELLIGENCE.md`.
- **EVID-022** — Fórmula de Confidence: soma ponderada de 7 sinais (pesos 0.20/0.12/0.12/0.10/0.10/0.16/0.10/0.10). Arquivo: `services/confidence-engine.ts::confidenceForSite`. Relacionado a: `05_SCORES_AND_INTELLIGENCE.md`.
- **EVID-023** — `dataTrustDashboard()` auto-preenche até 25 sites na primeira chamada se a tabela estiver vazia. Arquivo: `services/data-trust-engine.ts::dataTrustDashboard`. Relacionado a: RISK-04.
- **EVID-024** — Fórmula de `geo_score`/`ori_score` não localizada em profundidade (script Python lido apenas parcialmente). Arquivo: `importers/multi_operator_import.py` (primeiras ~120 linhas). Relacionado a: pendência explícita em `05_SCORES_AND_INTELLIGENCE.md`.

## Geoespacial

- **EVID-025** — Haversine correto com raio da Terra 6371km. Arquivo: `services/geospatial/spatial-query-utils.ts::haversineKm`. Relacionado a: `06_GEOSPATIAL_AND_MAPS.md`.
- **EVID-026** — Grade nacional determinística (4 resoluções, ~111km a ~111m). Arquivo: `services/geospatial/national-grid.ts`. Relacionado a: `06_GEOSPATIAL_AND_MAPS.md`.
- **EVID-027** — Prefiltragem por R-Tree antes de buscar linhas completas. Arquivo: `services/geospatial/spatial-intelligence-engine.ts::candidateIdsInBoundingBox`. Relacionado a: `06_GEOSPATIAL_AND_MAPS.md`, `12_PERFORMANCE_BASELINE.md`.
- **EVID-028** — Chunking de `IN (...)` limitado a 900 por seguranca entre builds do SQLite. Arquivo: `services/geospatial/spatial-query-utils.ts::chunkArray`, `MAX_SQL_IN_CLAUSE_SIZE`. Relacionado a: `06_GEOSPATIAL_AND_MAPS.md`.
- **EVID-029** — Antimeridiano (west > east) explicitamente rejeitado como não suportado. Arquivo: `services/geospatial/spatial-query-utils.ts::validateBoundingBox`. Relacionado a: `06_GEOSPATIAL_AND_MAPS.md`.
- **EVID-030** — Dashboard limita pontos de mapa a 4.000 com ordenação pseudo-aleatória. Arquivo: `app/api/dashboard/route.ts`, coluna `points`. Relacionado a: `06_GEOSPATIAL_AND_MAPS.md`.

## Segurança

- **EVID-031** — Nenhum uso real de `authorization`/`jwt`/`session`/`Bearer`/`API_KEY` em todo o código varrido; única menção é em comentário de `next.config.ts` afirmando que os headers ali "do not add authentication...". Comando: `Grep` recursivo. Relacionado a: RISK-01, RISK-10.
- **EVID-032** — `docs/stage-0/08_REMAINING_RISKS.md` confirma independentemente: "No authentication or authorization anywhere". Relacionado a: RISK-01.
- **EVID-033** — Nenhum arquivo `.env*` encontrado na raiz de `APP`. Comando: `find . -maxdepth 2 -iname ".env*"`. Relacionado a: `10_SECURITY_AUDIT.md`, SEC-11.
- **EVID-034** — `lib/request-guard.ts` se auto-declara como cobertura parcial ("Extending this to every one of the 43 documented endpoints is tracked as Stage 1+ backlog"). Relacionado a: SEC-03.
- **EVID-035** — `lib/filters.ts::whereFrom` usa exclusivamente parâmetros posicionais (`?`) — nenhuma concatenação direta de valor de usuário em SQL identificada. Relacionado a: `10_SECURITY_AUDIT.md`.

## Testes e qualidade

- **EVID-036** — `npx vitest run` falhou no startup: `Cannot find module '@rollup/rollup-linux-x64-gnu'`. Comando executado nesta sessão. Relacionado a: RISK-07, `11_TESTS_AND_QUALITY.md`.
- **EVID-037** — `npx tsc --noEmit` executou (exit code 0 como processo) e reportou ~50 linhas de erros reais de sintaxe/JSX em exatamente os 17 arquivos de código-fonte que aparecem como "modified" no `git status` (mais 2 arquivos gerados em `.next/types`). Comando executado nesta sessão. Relacionado a: RISK-02, `11_TESTS_AND_QUALITY.md`, `07_FRONTEND_AND_UX.md`.
- **EVID-038** — Nenhum script de lint/formatação em `package.json`; nenhum arquivo `.eslintrc*`/`.prettierrc*` encontrado. Relacionado a: RISK-14.
- **EVID-039** — `docs/stage-1/00_STAGE_1_SUMMARY.md` cita execução local do usuário: `npm test` PASSOU (83/83), `npx tsc --noEmit` PASSOU — não verificado por esta auditoria, classificado como DOCUMENTADO MAS NÃO CONFIRMADO.

## Backups e governança

- **EVID-040** — `scripts/backup_database.py` usa `VACUUM INTO` (seguro contra banco WAL ativo), hash SHA-256 antes/depois, manifesto JSON, nunca sobrescreve backup existente. Relacionado a: `00_EXECUTIVE_SUMMARY.md` (item 11 — o que preservar).
- **EVID-041** — 8 backups de marco (.zip) + 1 backup de banco standalone confirmados em `C:\LEOTECHSCAN\BACKUPS\`. Comando: listagem de diretório. Relacionado a: `00_EXECUTIVE_SUMMARY.md`.
- **EVID-042** — `audit_trail`: 288 linhas; `import_audit`: 2 linhas, com hash SHA-256 confirmando imutabilidade do Excel original. Relacionado a: `04_DATA_AND_DATABASE.md`.

## Cobertura desta auditoria — o que foi lido integralmente vs. apenas localizado

**Lidos integralmente** (confirmação direta linha a linha): `lib/db.ts`, `lib/filters.ts`, `lib/request-guard.ts`, `core/site.ts`, `database/schema.ts`, `config/sentinel_rules.json`, `package.json`, `CHANGELOG.md`, `services/sentinel-scoring.ts`, `services/data-trust-engine.ts`, `services/confidence-engine.ts`, `services/telecom-ai-engine.ts`, `services/geospatial/spatial-query-utils.ts`, `services/geospatial/national-grid.ts`, `services/geospatial/coordinate-quality-engine.ts`, `services/geospatial/spatial-intelligence-engine.ts`, `sentinel-core/engine.ts`, `sentinel-core/adapters/sqlite-adapter.ts`, `sentinel-core/entities/site-entity.ts`, `app/api/dashboard/route.ts`, `app/api/telecom-ai/route.ts`, `app/api/geospatial/viewport/route.ts`, `importers/multi_operator_import.py` (parcial, ~120 linhas), `scripts/backup_database.py` (parcial).

**Localizados e classificados por tamanho/nome, mas não lidos linha a linha:** as 37 rotas de API restantes, 13 dos 15 componentes React, `services/enterprise-v3-engine.ts`, `services/copernicus-engine.ts`, `services/satellite-validation-engine.ts`, `sentinel-core/inference/inference-engine.ts`, `sentinel-core/recommendation/recommendation-engine.ts`, `sentinel-core/graph/*`, restante do corpo de `importers/multi_operator_import.py`, `next.config.ts`, os 6 arquivos CSS versionados (`v11`–`v16`).

**Não abertos, por decisão deliberada de preservação:** `BASE SPAZIO COM IBGE_n.xlsx`, `VIVO SITES.xlsx` (apenas metadados inspecionados).

Esta lista existe para que a próxima rodada de auditoria (ou a equipe de implementação da Fase Genesis) saiba exatamente onde a cobertura desta passagem termina.
