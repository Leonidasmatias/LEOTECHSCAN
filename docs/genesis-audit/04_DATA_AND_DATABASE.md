# 04 — Modelo de Dados e Banco

## 8.1 Fontes de dados

| Fonte | Caminho | Formato | Tamanho | Papel | Original ou derivada | Uso |
|---|---|---|---|---|---|---|
| Planilha TIM (nome interno) | `C:\LEOTECHSCAN\BASE SPAZIO COM IBGE_n.xlsx` | Excel | 52.191.443 bytes | Fonte original — 298.341 registros | **Original, imutável** | Somente na importação (não aberta nesta auditoria, apenas metadados) |
| Planilha VIVO | `C:\LEOTECHSCAN\VIVO SITES.xlsx` | Excel | 1.580.352 bytes | Fonte original — 967 registros | **Original, imutável** | Somente na importação |
| Banco derivado | `C:\LEOTECHSCAN\DATABASE\leotechscan.db` (+ `-wal`, `-shm`) | SQLite | 185.020.416 bytes (+ WAL 57.832.472 bytes) | Base operacional de toda a aplicação | Derivada, regenerável pelo importador | Runtime (leitura via `getDb`, escrita via `getWritableDb`) |
| Exports | `C:\LEOTECHSCAN\EXPORTACOES\*.csv/.pdf` | CSV/PDF | Dezenas de arquivos, de poucos KB até 73.339.462 bytes (`sites_consolidados.csv`) | Saída para uso externo/comercial | Derivada | Apenas gerada por `app/api/export` — não é lida de volta pela aplicação |
| Backups | `C:\LEOTECHSCAN\BACKUPS\*.zip`, `*.db` | ZIP / SQLite | 8 backups de marco (V1 a V1.3) + 1 backup Stage 0 + 1 backup de banco standalone (`leotechscan-db-backup-20260715T143837Z.db`, 168.939.520 bytes) | Recuperação/rollback | Derivada | Não usada em runtime |
| Logs | `C:\LEOTECHSCAN\LOGS\*.log/.md` | Texto/Markdown | Pequenos | Histórico de execução de importações/migrações e checkpoints de sprint | Derivada | Não usada em runtime |
| `BASE` (pasta) | `C:\LEOTECHSCAN\BASE` | — | Vazia | Referenciada como `BASE_DIR` no importador (`multi_operator_import.py:19`) mas sem conteúdo atual | — | NÃO CONFIRMADO EM USO — pasta vazia no momento da auditoria |
| `MAPAS` (pasta) | `C:\LEOTECHSCAN\MAPAS` | — | Vazia | Nome sugere armazenamento de tiles/mapas offline; sem conteúdo | — | NÃO IMPLEMENTADO / NÃO EM USO |
| Fixtures/seeds/mocks | — | — | — | **Nenhum arquivo de fixture, seed ou dado mockado foi encontrado** nos diretórios de código lidos (`tests/*.test.ts` usam dados construídos inline em memória, não fixtures em arquivo separado, pelo que foi possível confirmar nos testes lidos) | — | NÃO IMPLEMENTADO |

Status: **CONFIRMADO NO CÓDIGO E NO SISTEMA DE ARQUIVOS** (listagens diretas de diretório e leitura de `importers/multi_operator_import.py`).

## 8.2 Banco de dados

Acesso feito exclusivamente via consulta somente-leitura (`sqlite3.connect("file:...?mode=ro", uri=True)` em Python, e leitura do arquivo `lib/db.ts` no código-fonte). `PRAGMA integrity_check` retornou `('ok',)`. `PRAGMA schema_version` = 39. Nenhuma tabela tem `VIEW` ou `TRIGGER` (ambas as consultas a `sqlite_master` retornaram vazio).

### Tabelas, contagem de linhas e papel

| Tabela | Linhas | Papel | Observação |
|---|---|---|---|
| `sites` | 299.308 | Tabela central — um site de telecom por linha, 39 colunas | PK `id` INTEGER; sem FKs de saída |
| `site_trust_scores` | 270 | Data Trust Score persistido | FK conceitual para `sites` via `site_id` (não declarada como `FOREIGN KEY` no schema — ver abaixo) |
| `site_geospatial_status` | **0** | Status geoespacial (Stage 1) | FK declarada explicitamente: `FOREIGN KEY(site_id) REFERENCES sites(id)`. Tabela vazia — pipeline de preenchimento não rodou ainda contra este banco |
| `site_coordinate_quality` | **0** | Qualidade de coordenada (Stage 1) | FK declarada: `site_id → sites(id)`. Vazia |
| `site_spatial_index` (+ `_node`, `_parent`, `_rowid`) | 299.308 | Índice espacial R-Tree (módulo virtual do SQLite) | Populado para 100% da base de sites |
| `geospatial_grid_cells` | **0** | Células de grade nacional agregadas | Vazia — grade calculada sob demanda em runtime (`national-grid.ts`), não persistida ainda |
| `geospatial_processing_runs` | 1 | Log de execuções do pipeline geoespacial | Uma única execução registrada |
| `sig_nodes` | 2.497 | Nós do Knowledge Graph (Sentinel Core) | Cobre uma fração da base de 299.308 sites |
| `sig_edges` | 5.355 | Arestas do Knowledge Graph | — |
| `sig_insights` | 35 | Insights gerados pelo `inference-engine` | — |
| `sig_snapshots` | 1 | Snapshot único do grafo | — |
| `site_evidence_center` | 55 | Evidências por site (Evidence Center) | — |
| `site_satellite_validation` | 271 | Validação satelital (Copernicus) por site | — |
| `site_validation_history` | 270 | Histórico de validação (casado 1:1 com `site_trust_scores`) | — |
| `site_notes` | 1 | Notas manuais por site | — |
| `copernicus_scenes` | 1.270 | Cenas de satélite associadas a sites | — |
| `audit_trail` | 288 | Trilha de auditoria de eventos | — |
| `import_audit` | 2 | Auditoria de importação (uma linha por arquivo importado: TIM e VIVO) | Contém `sha256_antes`/`sha256_depois`/`excel_inalterado` — confirma que o Excel de origem não é alterado pelo importador |
| `metadata` | 6 | Metadados de import (`schema_version`, `imported_at`, `source_name`, `row_count`, `fallback_used`, `operators`) | `imported_at = 2026-06-27T04:21:17Z`; `operators = {"TIM": 298341, "VIVO": 967}` |

### Colunas de `sites` (as 39, com foco nos campos pedidos pela missão)

- **Campos geográficos:** `latitude REAL`, `longitude REAL`.
- **Campos de operadora:** `operadora_origem`, `operadora_classificada`, `operator_rule` (regra usada na classificação heurística).
- **Campos de tecnologia:** `tecnologia`.
- **Campos de estrutura:** `tipo_torre`, `tipo_infra`, `altura REAL`, `tipo_elemento`, `tipo_conexao`, `tipo_site`.
- **Campos de proprietário:** `detentor_area`, `detentor_infra`.
- **Campos temporais:** `data_importacao`.
- **Campos de qualidade/status:** `status`, `status_original`, `status_normalizado`, `situacao`.
- **Campos de score:** `geo_score INTEGER`, `risco TEXT`, `ori_score INTEGER`, `ori_risk TEXT` — **calculados e persistidos no momento da importação** (`importers/multi_operator_import.py`), não recalculados em runtime pela aplicação Next.js.

Nenhuma coluna JSON armazenada como texto foi encontrada em `sites` propriamente dita, mas várias tabelas satélite armazenam JSON como texto deliberadamente (`attributes_json` em `sig_nodes`/`sig_edges`, `evidence_json`, `metadata_json`) — um padrão consistente e documentado, não uma inconsistência.

### Índices confirmados (via `sqlite_master`, texto completo do `CREATE INDEX`)

| Índice | Tabela | Definição |
|---|---|---|
| `idx_filters` | `sites` | `(estado, municipio, tecnologia, status_normalizado, detentor_infra, tipo_infra, operadora_classificada)` |
| `idx_score` | `sites` | `(geo_score DESC)` |
| `idx_site` | `sites` | `(site_id)` |
| `idx_unified_site` | `sites` | `(site, operadora_origem, uf)` |
| `idx_coordinate_quality_site_id` / `_evaluated_at` | `site_coordinate_quality` | por `site_id` e por `evaluated_at` |
| `idx_geospatial_status_coordinate_status` / `_grid_cell` / `_mapping_eligible` | `site_geospatial_status` | — |
| `idx_grid_cells_resolution` | `geospatial_grid_cells` | `(resolution)` |
| `idx_processing_runs_started_at` | `geospatial_processing_runs` | `(started_at)` |

Não há índice composto por `(latitude, longitude)` na tabela `sites` além do índice R-Tree dedicado (`site_spatial_index`) — consultas de fallback sem R-Tree (`WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`, vistas em `spatial-intelligence-engine.ts`) fariam varredura sequencial parcial se o R-Tree não existisse. Como o R-Tree existe e está populado, isso hoje é um risco latente, não ativo.

### Ausência de constraints e chaves estrangeiras formais

`site_trust_scores`, `site_evidence_center`, `site_satellite_validation`, `site_validation_history`, `site_notes`, `copernicus_scenes` **não têm `FOREIGN KEY` declarada** para `sites(id)`, apesar de todas terem uma coluna `site_id`. Apenas `site_geospatial_status` e `site_coordinate_quality` (parte do trabalho Stage 1 mais recente) declaram a FK explicitamente. Isso é uma inconsistência de rigor entre gerações de código do mesmo projeto — confirmada via `PRAGMA foreign_key_list(<tabela>)`, que retornou vazio para as tabelas mais antigas e populado para as duas mais novas.

Status: **CONFIRMADO NO BANCO** (consulta direta a `sqlite_master` e `PRAGMA`, modo somente leitura).

## 8.3 Fluxo de dados

```
Excel original (imutável)
   ↓  importers/multi_operator_import.py (Python, openpyxl, hash SHA-256 antes/depois)
SQLite `sites` + `import_audit` + `metadata`   [geo_score/risco/ori_score já calculados aqui]
   ↓  (opcional, não rodado em produção ainda)
scripts/geospatial_migrate.py / scripts/geospatial-spatial-index.mjs
   ↓
site_geospatial_status / site_coordinate_quality / geospatial_grid_cells   [0 linhas hoje]
   ↓
services/*-engine.ts  (Data Trust, Confidence, Copernicus, Sentinel Core, geoespacial)
   ↓
app/api/**/route.ts  (JSON)
   ↓
components/*.tsx  (React, client-side)
   ↓
app/api/export/route.ts  →  EXPORTACOES/*.csv, *.pdf
```

**Onde o fluxo está incompleto:** o segundo estágio (migração/preenchimento geoespacial) tem código pronto e testado isoladamente, mas as tabelas de destino (`site_geospatial_status`, `geospatial_grid_cells`, `site_coordinate_quality`) estão vazias no banco de produção — ou seja, o pipeline nunca rodou de ponta a ponta contra `leotechscan.db`, apenas contra dados de teste/memória. Isso é **CONFIRMADO NO BANCO** (contagem zero) e coerente com o fato de esses arquivos ainda estarem "untracked" no Git (trabalho em andamento, não finalizado).

**Onde o fluxo está duplicado:** os scores `geo_score`/`ori_score`/`risco` são calculados uma única vez no importador Python e gravados como colunas da tabela `sites`; separadamente, `services/sentinel-scoring.ts` recalcula LTS/TCI/OPI/SRI em runtime, em memória, a partir de agregados por município — são cálculos de escopo diferente (por site vs. por município) mas usam sinais sobrepostos (contagem de sites, cobertura), o que exige atenção para não apresentar dois números com nomes parecidos e origem diferente como se fossem a mesma coisa. Ver `05_SCORES_AND_INTELLIGENCE.md`.
