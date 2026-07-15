# 04 — Database Audit

**Método:** os três arquivos do banco (`leotechscan.db`, `-wal`, `-shm`) foram copiados para uma pasta temporária fora de `C:\LEOTECHSCAN` e consultados exclusivamente na cópia, com `PRAGMA query_only=1`. **O banco de produção não foi tocado.**

## 1. Arquivo e integridade

| Item | Valor |
|---|---|
| Caminho | `C:\LEOTECHSCAN\DATABASE\leotechscan.db` |
| Tamanho | 168.914.944 bytes (161 MB) |
| `-wal` | 57.832.472 bytes (não houve checkpoint recente) |
| `-shm` | 32.768 bytes |
| `PRAGMA integrity_check` | **`ok`** |

## 2. Schema — tabelas, índices, triggers, views

**16 tabelas de usuário** (mais `sqlite_sequence` e `sqlite_stat1`, internas do SQLite). **Nenhuma view. Nenhum trigger. Nenhuma foreign key declarada em nenhuma tabela.**

| Tabela | Linhas | Propósito |
|---|---|---|
| `sites` | **299.308** | Tabela principal, unificada TIM+VIVO |
| `metadata` | 6 | Metadados da última importação |
| `import_audit` | 2 | Auditoria de importação (1 por arquivo-fonte) |
| `site_notes` | 1 | Observações manuais do operador |
| `copernicus_scenes` | 1.270 | Cenas Sentinel-1 — **100% mock** (ver Phase I) |
| `site_satellite_validation` | 271 | Validação satelital — cobre **0,09%** dos 299.308 sites |
| `site_trust_scores` | 270 | Data Trust Score |
| `site_validation_history` | 270 | Histórico de validação |
| `site_evidence_center` | 55 | Dossiês de evidência gerados |
| `audit_trail` | 288 | Log de eventos de auditoria interna |
| `sig_nodes` | 2.497 | Nós do grafo Sentinel Core |
| `sig_edges` | 5.355 | Arestas do grafo |
| `sig_snapshots` | 1 | Snapshot único de build do grafo |
| `sig_insights` | 35 | Insights gerados por regra |

Índices existentes (todos em `sites`):

- `idx_filters` — `(estado, municipio, tecnologia, status_normalizado, detentor_infra, tipo_infra, operadora_classificada)`
- `idx_score` — `(geo_score DESC)`
- `idx_site` — `(site_id)`
- `idx_unified_site` — `(site, operadora_origem, uf)`

**Nenhum índice cobre `latitude`/`longitude`.** Não existe tabela virtual `RTree`, `FTS`, nem qualquer extensão espacial (`SpatiaLite` não está carregada). Toda consulta por raio geográfico (Digital Twin, Advanced GIS, mapa) faz varredura de faixa sobre `latitude`/`longitude` sem suporte de índice dedicado — mitigado apenas por `idx_filters`/`idx_score` quando esses campos também aparecem na cláusula `WHERE`.

## 3. Tabela `sites` — qualidade de dados

| Métrica | Valor |
|---|---|
| Total de registros | 299.308 |
| TIM | 298.341 (99,7%) |
| VIVO | 967 (0,3%) |
| Outras operadoras | 0 — apesar de `config/operator_rules.json` já suportar Claro/Oi/Algar/Outros, nenhum registro real dessas operadoras existe na base atual |
| Registros com latitude E longitude preenchidas | 299.308 (100% — nenhum `NULL`) |
| Coordenadas exatamente `(0,0)` | **1.320** |
| Coordenadas fora do bounding-box aproximado do Brasil (`lat -34..6`, `lon -75/-74..-32`) | **1.377** |
| Grupos de coordenada exatamente duplicada (mais de 1 registro na mesma lat/lon) | **48.767 grupos**, somando **265.247 registros envolvidos (≈88,6% da base)** |
| Grupos de `site_id`/nome de site duplicado | **13.589 grupos** |
| `municipio`, `uf`, `tecnologia`, `operadora_origem`, `endereco`, `ibge` nulos ou vazios | **0 em todos** — completude de campo textual é 100% |

### Interpretação do achado de coordenadas duplicadas

265.247 registros (88,6%) compartilham coordenada exata com pelo menos outro registro. Isso **não é necessariamente erro de importação** — é plausível que múltiplas linhas representem tecnologias/elementos distintos fisicamente colocados na mesma torre/endereço (o próprio `services/duplicates-engine.ts` já trata isso como candidato "sugestivo", não como erro confirmado). Ainda assim, o volume é alto o suficiente para exigir investigação dedicada antes de qualquer decisão de deduplicação automática — recomenda-se que o Roadmap Stage 1 trate isso como "requer revisão manual" em vez de "duplicata confirmada".

### Distribuição por UF (top 10)

SP 72.156 · RJ 34.163 · MG 26.300 · PR 21.273 · RS 17.542 · BA 16.465 · SC 13.689 · PE 11.665 · CE 10.702 · GO 9.021

### Distribuição por tecnologia

LTE 110.126 · UMTS 44.179 · GSM 34.777 · IP 29.428 · MULTI-TECNOLOGIA 28.061 · NR 17.322 · HIBRIDO 10.786 · WDM 4.575 · RAI 4.382 · PTN 3.479 · RAE 3.192 · TDMA 3.023 · NÃO INFORMADA 2.923 · NGN 1.091 · INFRA 662

### Distribuição por arquivo de origem

`BASE SPAZIO COM IBGE_n.xlsx` → 298.341 · `VIVO SITES.xlsx` → 967 (soma = total, confirmando que não há registros de nenhuma outra fonte).

## 4. `metadata` — snapshot da última importação

```
schema_version = 2.0-sprint1
imported_at    = 2026-06-27T04:21:17.929965+00:00
source_name    = BASE SPAZIO COM IBGE_n.xlsx, VIVO SITES.xlsx
row_count      = 299308
fallback_used  = True
operators      = {"TIM": 298341, "VIVO": 967}
```

## 5. `import_audit` — prova de integridade de importação

Duas linhas, uma por arquivo-fonte, cada uma com `sha256_antes` **igual a** `sha256_depois` e `excel_inalterado = 1`. Isso **confirma tecnicamente** que a última execução do importador não alterou os arquivos Excel de origem — consistente com a regra de segurança do projeto.

## 6. Tabelas referenciadas pelo código mas com cobertura baixa

- `site_satellite_validation` e `copernicus_scenes` só têm dados para uma fração mínima da base (271 e cenas ligadas a poucas dezenas de sites, respectivamente, versus 299.308 sites elegíveis). O código gera esses dados **sob demanda, um site por vez**, quando o usuário abre o Site Intelligence/Evidence Center de um site específico — não há processo em lote que cubra a base inteira. Isso é esperado no estágio atual (evita travar a aplicação), mas significa que qualquer estatística agregada de "cobertura satelital" hoje é sobre uma amostra ínfima, não sobre a base nacional.
- `sig_nodes`/`sig_edges` (grafo Sentinel Core) cobrem apenas a amostra do último build (limite configurável, até 5.000 sites) — documentado corretamente no `CHANGELOG.md` como "modo sample".

## 7. Riscos de schema

- **Sem foreign keys**: nenhuma tabela satélite (`site_trust_scores`, `copernicus_scenes`, etc.) impõe integridade referencial com `sites.id` no nível do banco — a integridade depende inteiramente da disciplina do código da aplicação.
- **Sem soft-delete / versionamento de linha**: não há coluna de exclusão lógica nem histórico de mudança de schema (`schema_version` existe só como string solta em `metadata`, não como número comparável por migração).
- **WAL não checkpointado**: 55 MB de `-wal` pendente sugere que o processo da aplicação não está encerrando graciosamente ou não há checkpoint periódico configurado — risco baixo de perda de dados, mas indica falta de rotina operacional de manutenção do banco.

## 8. Achados-chave desta fase

1. Integridade estrutural do banco está **ok** e o import documenta corretamente sua própria integridade via hash.
2. A cobertura de satélite/grafo é **extremamente baixa** frente ao total de sites — qualquer comunicação sobre "cobertura nacional de Sentinel-1" hoje seria factualmente incorreta.
3. Falta de índice espacial é o maior risco de performance identificado nesta fase (detalhado em `08_GIS_AUDIT.md` e `11_PERFORMANCE_AUDIT.md`).
4. O volume de coordenadas duplicadas (88,6% dos registros) precisa de investigação dedicada — não deve ser tratado como duplicata confirmada sem revisão humana.
