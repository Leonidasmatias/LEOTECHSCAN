# 02 — Mapa da Arquitetura Real

## Diagrama textual (fluxo real observado)

```
Navegador (React 19 / Leaflet)
   ↓
app/page.tsx  →  components/Dashboard.tsx (+ *Modules.tsx por domínio)
   ↓ (fetch client-side para as próprias rotas Next.js)
app/api/**/route.ts   (~49 route handlers, runtime "nodejs", "force-dynamic")
   ↓
services/*-engine.ts, services/geospatial/*, lib/*, core/site.ts
   ↓
lib/db.ts → node:sqlite (DatabaseSync)
   ↓
DATABASE/leotechscan.db  (SQLite, WAL, 185MB + 58MB WAL)
   ↑ (fonte, somente na importação)
importers/multi_operator_import.py  ←  BASE SPAZIO COM IBGE_n.xlsx, VIVO SITES.xlsx
   ↓ (na exportação)
app/api/export/route.ts, utils/csv.ts, utils/pdf.ts  →  C:\LEOTECHSCAN\EXPORTACOES\*.csv/.pdf
```

Camada paralela (Sentinel Core / Knowledge Graph), consumida por rotas próprias (`app/api/sentinel-core/**`):

```
app/api/sentinel-core/**/route.ts
   ↓
sentinel-core/engine.ts  (orquestrador fino)
   ↓                              ↓                        ↓
sentinel-core/graph/*     sentinel-core/inference/*   sentinel-core/recommendation/*
   ↓                              ↓                        ↓
lib/db.ts (getWritableDb)  →  sig_nodes / sig_edges / sig_insights / sig_snapshots (SQLite)
```

`sentinel-core/entities/*` e `sentinel-core/adapters/*` aparecem no diagrama do blueprint mas, na implementação real, são arquivos de 60–150 bytes (constantes/re-exports triviais) — ver `03_FUNCTIONAL_CATALOG.md` e `13_GENESIS_GAP_ANALYSIS.md`. Eles não interceptam nem transformam nada entre o `engine.ts` e o banco; o `engine.ts` chama diretamente `graph-builder`, `graph-store`, `graph-query`, `inference-engine`, `recommendation-engine` e `knowledge-summary`.

Status: **CONFIRMADO NO CÓDIGO** (lido diretamente: `sentinel-core/engine.ts`, `sentinel-core/adapters/sqlite-adapter.ts`, `sentinel-core/entities/site-entity.ts`).

## Estrutura de diretórios (nível 1, `APP/`)

| Diretório | Papel observado | Evidência |
|---|---|---|
| `app/` | Next.js App Router — página única (`page.tsx`, `layout.tsx`) + ~49 route handlers em `app/api/**` + 7 arquivos CSS versionados (`v11.css`...`v16.css`, `enterprise-theme.css`, `globals.css`) | `find` (listagem completa) |
| `api/` | Um único arquivo, `api/site-query.ts` — define `SITE_SELECT`, a projeção de colunas compartilhada por quase todos os serviços | leitura direta |
| `components/` | 15 componentes React (`Dashboard.tsx` é o maior, 24,5KB) | listagem + leitura parcial |
| `config/` | 4 arquivos JSON com regras/pesos/thresholds externalizados (`sentinel_rules.json`, `capabilities.json`, `copernicus_rules.json`, `operator_rules.json`) | leitura direta |
| `core/` | Um único arquivo, `core/site.ts` (17 linhas) — define `SITE_UNIFIED_COLUMNS` | leitura direta |
| `database/` | Um único arquivo, `database/schema.ts` (5 linhas) — reexporta nomes de tabela/colunas de `core/site.ts`; **não é um schema real** (não define DDL, tipos, nem migrações) | leitura direta |
| `importers/` | `multi_operator_import.py` — importador Python com DDL, hashing SHA-256, mapeamento de colunas TIM/VIVO | leitura direta |
| `lib/` | `db.ts` (conexão SQLite), `filters.ts` (WHERE parametrizado), `request-guard.ts` (clamps de entrada), `types.ts`, `operator.ts`, `export-path.ts` | leitura direta |
| `logs/` | Vazio exceto `README.md` | listagem |
| `operator-engine/` | Vazio exceto `README.md` — nome sugere um módulo que não existe como código | listagem |
| `scripts/` | Scripts Python/Node de importação, migração, backup/restore, e migração geoespacial | listagem + leitura de `backup_database.py` |
| `sentinel-core/` | Ver diagrama acima | leitura direta |
| `services/` | 23 arquivos "engine"/serviço — a camada de regra de negócio principal do projeto | leitura direta (12 arquivos lidos integralmente) |
| `tests/` | 15 arquivos de teste Vitest (7 focados em geoespacial "Stage 1", ainda não rastreados no Git) | listagem + leitura parcial |
| `utils/` | `csv.ts`, `pdf.ts` | leitura direta |

## Módulos de domínio identificados (por convenção de nome de arquivo, confirmados por leitura)

- **Dashboard / Filtros** — `app/api/dashboard`, `lib/filters.ts`, `lib/operator.ts`.
- **Data Trust** — `services/data-trust-engine.ts`, `services/confidence-engine.ts`, `app/api/data-trust/**`.
- **Sentinel Core / Knowledge Graph** — `sentinel-core/**`, `app/api/sentinel-core/**`.
- **Geoespacial (Stage 1, não commitado)** — `services/geospatial/**`, `app/api/geospatial/**`.
- **Copernicus (validação satelital)** — `services/copernicus-engine.ts`, `services/copernicus-truth.ts`, `services/satellite-validation-engine.ts`, `components/CopernicusModules.tsx`, `config/copernicus_rules.json`.
- **Evidence Center** — `services/evidence-center-engine.ts`, `app/api/evidence-center/**`.
- **Telecom AI** — `services/telecom-ai-engine.ts`, `app/api/telecom-ai`.
- **Market / Rollout / Strategic Planning / Scenario Planner** — `services/market-engine.ts`, `services/rollout-engine.ts`, `services/strategic-data.ts`, respectivas rotas.
- **Enterprise V3 (Digital Twin, Executive Reports, Executive Workspace)** — `services/enterprise-v3-engine.ts` (14KB, o segundo maior arquivo de serviço).
- **Alertas / Auditoria** — `services/alert-engine.ts`, `services/audit-trail.ts` (grava em `audit_trail` table).
- **Duplicidades** — `services/duplicates-engine.ts`.
- **National Timeline** — `services/national-timeline-engine.ts`.

Não há uma camada de "repositório"/"adapter" formal separada dos serviços (padrão Repository não aplicado de forma consistente) — cada serviço em `services/*.ts` monta e executa suas próprias queries SQL diretamente contra `DatabaseSync`. Isso é uma escolha pragmática para o tamanho atual do projeto, mas significa que qualquer troca de banco de dados (ex.: migração para Postgres na Fase Genesis) exigiria reescrever a camada de acesso a dados espalhada por 23 arquivos, não um único ponto de abstração.

Status: **CONFIRMADO NO CÓDIGO** para todos os itens acima (cada um foi localizado e, na maioria dos casos, lido integralmente — ver `16_EVIDENCE_INDEX.md` para o que foi lido vs. apenas localizado por nome).
