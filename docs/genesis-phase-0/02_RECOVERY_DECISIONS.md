# 02 — Recovery Decisions (per-file classification)

Methodology: every file below was individually diffed against `git show HEAD:<file>` (for tracked
files) before any decision was made. No file was reverted based solely on a `tsc` failure — full
diff context was read in every case. Recovery priority followed Option A (complete the change) >
Option B (restore only the broken section) > Option C (reapply over HEAD) > Option D (restore to
HEAD, only when the change has no proven value, per the mission's stated priority order).

## 18 files: pure truncation of HEAD content — Option D

For every file in this group, `git diff --numstat` showed a "1 insertion, N deletions" pattern
and the working-tree content was byte-for-byte a truncated prefix of `git show HEAD:<file>` (no
insertions beyond the truncation point). Restored via `git show HEAD:<file> > <file>` — a
lock-free object-database read, since `.git/index.lock` blocked `git checkout`/`git restore`.
Verified via SHA-256 match against HEAD on 4 spot-checked files (`app/api/export/route.ts`,
`package.json`, `services/copernicus-engine.ts`, `next.config.ts`).

| Arquivo | Tipo de alteração | Diferença contra HEAD | Estado de sintaxe (antes) | Possível intenção | Classificação | Decisão |
|---|---|---|---|---|---|---|
| `app/api/export/route.ts` | Truncamento puro | 0 conteúdo novo, corte no meio do arquivo | Inválido | Nenhuma (arquivo cortado, não editado) | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `app/api/geointelligence/route.ts` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `app/api/telecom-ai/route.ts` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `app/globals.css` | Truncamento puro | idem | N/A (CSS) | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `components/CopernicusModules.tsx` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `components/Dashboard.tsx` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `components/DataTrustModules.tsx` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `components/MissionControl.tsx` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `components/SentinelCoreModules.tsx` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `components/Sprint2BModules.tsx` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `components/Sprint3Modules.tsx` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `components/Sprint4Modules.tsx` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `importers/multi_operator_import.py` | Truncamento puro | idem | Inválido (Python) | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `next.config.ts` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `package-lock.json` | Truncamento puro | idem | Inválido (JSON) | idem | ARQUIVO GERADO | Opção D — restaurado ao HEAD |
| `package.json` | Truncamento puro | idem | Inválido (JSON) | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `services/copernicus-engine.ts` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |
| `utils/csv.ts` | Truncamento puro | idem | Inválido | idem | ALTERAÇÃO NÃO RELACIONADA | Opção D — restaurado ao HEAD |

## 1 file: genuine edit + truncation — Option A

| Arquivo | Tipo de alteração | Diferença contra HEAD | Estado de sintaxe (antes) | Dependências | Possível intenção | Classificação | Decisão |
|---|---|---|---|---|---|---|---|
| `vitest.config.ts` | Reescrita genuína do comentário + corte antes do corpo do código | Comentário reescrito por completo (explicando a remoção de `NODE_BUILTIN_EXTERNAL`), seguido de truncamento total do `export default defineConfig(...)` | Inválido (arquivo terminava em meio ao comentário) | `vitest/config`, `node:path` | Remover o workaround `NODE_BUILTIN_EXTERNAL` (que quebrava `tsc` — `ssr.external` não aceita `RegExp[]`), já que nenhum teste atual importa `node:sqlite` transitivamente | ALTERAÇÃO VÁLIDA MAS INCOMPLETA | Opção A — comentário original preservado integralmente; corpo `defineConfig` reconstruído a partir da própria intenção declarada no comentário (remover `NODE_BUILTIN_EXTERNAL` e os dois campos `external`, manter o restante) |

Full diff of the applied fix is in `working-tree.patch` (pre-repair) and can be reproduced via
`git diff vitest.config.ts` post-repair; the reconstructed body only removes the two `external`
blocks and the `NODE_BUILTIN_EXTERNAL` constant — it does not alter `test.environment`,
`test.include`, or the path alias.

## 2 additional truncated files found during this mission (untracked, no HEAD to compare against)

Neither file is tracked in git, so no `git show HEAD:<file>` comparison was possible. Both were
discovered via syntax-checker failure (`tsc --noEmit` for the first, `node --check` for the
second) during the batch typecheck pass, confirmed via SHA-256 comparison against the
mission-start snapshot to have already been in this truncated state before this session began.

| Arquivo | Tipo de alteração | Estado de sintaxe (antes) | Dependências | Possível intenção | Classificação | Decisão |
|---|---|---|---|---|---|---|
| `services/geospatial/spatial-intelligence-engine.ts` | Truncado no meio de uma instrução (linha 198, `const truncated = withinRadius.length > limit` sem `;` nem fechamento) | Inválido — `error TS1005: '}' expected` | `@/api/site-query`, `@/services/geospatial/national-grid`, `@/services/geospatial/spatial-query-utils` | Arquivo Stage 1 completo, cortado por evento desconhecido (mesma classe de corte dos 18 arquivos acima) | ARQUIVO TRUNCADO OU CORROMPIDO | Opção C — reconstruído a partir de uma leitura completa e verbatim deste mesmo arquivo (258 linhas), feita e registrada nesta mesma sessão de trabalho antes da compactação da conversa, durante a auditoria Genesis anterior. Backup do estado truncado (197 linhas) preservado em `RECOVERY_SNAPSHOTS/GENESIS_PHASE_0_20260716_125753Z/pre-repair-truncated-untracked/`. |
| `scripts/geospatial-spatial-index.mjs` | Truncado no meio de uma instrução (linha 179, `} else if (value` sem fechar) | Inválido — `SyntaxError: Unexpected end of input` (`node --check`) | `node:sqlite`, `node:util`, `../services/geospatial/spatial-index-sql.mjs` | Faltava inteiramente o ramo `--mode verify`, o ramo de erro para modo desconhecido, o fechamento do `try`, e a chamada a `main()` | ARQUIVO TRUNCADO OU CORROMPIDO | Opção C — reconstruído com base em evidência documentada explicitamente em `docs/stage-1/04_SPATIAL_INDEX.md` ("--mode verify -- confirms the indexed row count matches... exits non-zero on any mismatch"), e na função `verifySpatialIndex(db)` já completa no mesmo arquivo (linhas 136-158), cujo formato de retorno (`{ strategy, geocodedSites, indexedCount, countsMatch, integrityCheck }`) determina exatamente o que o ramo reconstruído consome. Backup do estado truncado (178 linhas) preservado no mesmo diretório de snapshot. |

## Files explicitly NOT touched

All 39 untracked Stage 1/audit files not listed above (5 geospatial API routes, 7 remaining
`services/geospatial/*` files, 8 geospatial test files, `services/geospatial/spatial-index-sql.d.mts`,
`scripts/geospatial_migrate.py`, all `docs/stage-1/*.md`, all `docs/genesis-audit/*.md`) were
verified via `tsc --noEmit` (for `.ts`), `node --check` (for `.mjs`), and `python3 -m py_compile`
(for `.py`) to already be syntactically complete — no changes were made to any of them.
