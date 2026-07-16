# 01 — Ambiente e Repositório

## 5.1 Sistema

Todas as informações abaixo foram coletadas via `mcp__remote-devices__device_bash`, que executa dentro de uma VM Linux que faz a ponte (bridge) com a pasta `C:\LEOTECHSCAN` da máquina Windows do usuário via FUSE (`mount` confirma: `... on /sessions/.../mnt/LEOTECHSCAN type fuse (rw,...)`).

**Status: CONFIRMADO EM EXECUÇÃO, com ressalva de escopo.** Os valores abaixo descrevem o ambiente da sessão de auditoria (a VM-ponte), não necessariamente idêntico ao ambiente Windows real onde o `node_modules` do projeto foi instalado e onde `npm test`/`npm run build` foram validados anteriormente pelo usuário (conforme `docs/stage-0/08_REMAINING_RISKS.md`, que documenta a mesma limitação para sessões anteriores). Não foi possível, a partir desta sessão, confirmar diretamente a versão do Node/npm/SO na máquina Windows do usuário.

| Item | Valor observado (VM-ponte) | Evidência |
|---|---|---|
| Sistema operacional (ponte) | Linux, Ubuntu 22.04 (kernel `6.8.0-124-generic`) | `uname -a` |
| Node.js | v22.22.3 | `node --version` |
| npm | 10.9.8 | `npm --version` |
| Git | 2.34.1 | `git --version` |
| Python | 3.12 (`python3`) | `which python3`; usado para consultas SQLite somente leitura |
| TypeScript | `^5.8.0` declarado em `devDependencies` (`package.json`); versão efetivamente instalada não confirmada nesta sessão (não há `node_modules/.package-lock.json` legível listado nesta auditoria) | `package.json` |
| Gerenciador de pacotes | **Ambíguo** — o repositório contém simultaneamente `package-lock.json` (77KB) e `pnpm-lock.yaml` (20KB) | `ls` na raiz de `APP` |
| Build tool | Next.js (`next build`, script em `package.json`) | `package.json` |
| Test tool | Vitest 2.1.0 (declarado), **não executável nesta sessão** | ver `11_TESTS_AND_QUALITY.md` |
| Lint | Nenhum script de lint (`eslint`, `biome`) encontrado em `package.json` | `package.json` (scripts: `dev`, `build`, `start`, `import`, `test`) |
| Formatação | Nenhuma ferramenta de formatação (`prettier`) declarada | `package.json` |
| Runtime principal | Node.js via Next.js App Router (`export const runtime = "nodejs"` em rotas de API) | ex.: `app/api/dashboard/route.ts:8` |
| Framework principal | Next.js `^15.5.0`, React `^19.1.0` | `package.json` |
| Banco de dados | SQLite via módulo nativo `node:sqlite` (experimental, embutido no Node.js — não é um pacote npm) | `lib/db.ts:1` (`import { DatabaseSync } from "node:sqlite"`) |

**Sem ferramenta de lint ou formatação configurada** é uma lacuna relevante para a Fase Genesis (padronização de código entre múltiplos contribuidores/IA).

## 5.2 Repositório

| Item | Valor | Evidência |
|---|---|---|
| `.git` existe | Sim | `ls` |
| Branch atual | `master` | `git branch --show-current` |
| Remotes | Nenhum configurado | `git remote -v` (saída vazia) |
| Commits totais | 2 | `git log --oneline -20` → `0b61fd7 Stage 0: finalize stabilization baseline`, `01ed583 Stage 0 Baseline` |
| Arquivos rastreados (`git ls-files`) | 177 | `git ls-files \| wc -l` |
| Alterações não commitadas (modified) | 19 arquivos | `git status --porcelain` |
| Arquivos não rastreados (untracked) | 14 (todos relacionados ao trabalho geoespacial "Stage 1" em andamento: `app/api/geospatial/`, `docs/stage-1/`, `scripts/geospatial-*`, `services/geospatial/`, 8 arquivos de teste `tests/geospatial-*`) | `git status --porcelain` |
| Tamanho total do repositório (`APP`) | 1,3 GB | `du -sh .` |
| Tamanho de `node_modules` | 1,1 GB (a maior parte do total) | `du -sh node_modules` |
| Tamanho do código+docs (excluindo `node_modules`, `.git`, `.next`) | ~1,1 MB | `du -sh --exclude=...` |

**Nenhum commit, checkout, reset ou stash foi executado por esta auditoria** — todas as informações acima vieram de comandos somente leitura (`git status`, `git log`, `git diff`, `git show HEAD:<arquivo>`, `git branch --show-current`, `git remote -v`).

### Estado exato do working tree no momento da auditoria

Arquivos modificados (não commitados), confirmados via `git status --porcelain`:

```
app/api/export/route.ts
app/api/geointelligence/route.ts
app/api/telecom-ai/route.ts
app/globals.css
components/CopernicusModules.tsx
components/Dashboard.tsx
components/DataTrustModules.tsx
components/MissionControl.tsx
components/SentinelCoreModules.tsx
components/Sprint2BModules.tsx
components/Sprint3Modules.tsx
components/Sprint4Modules.tsx
importers/multi_operator_import.py
next.config.ts
package-lock.json
package.json
services/copernicus-engine.ts
utils/csv.ts
vitest.config.ts
```

`git diff --stat` mostra um padrão incomum para essa lista: **41 inserções, 1.639 remoções** no total — a esmagadora maioria das mudanças são deleções de conteúdo, não adições. Uma inspeção direta de `app/api/telecom-ai/route.ts` (evidência completa em `11_TESTS_AND_QUALITY.md`) mostra que o arquivo modificado termina no meio de uma string (`console.error("telecom_ai_fa`, sem quebra de linha final), enquanto a versão commitada (`git show HEAD:...`) está completa e bem formada. Isso é consistente com uma gravação de arquivo interrompida (por um editor, processo de build/watch, ou outra sessão trabalhando no mesmo repositório), não com uma edição intencional de código. Esse achado é normativo para toda a auditoria de qualidade e testes (`11_TESTS_AND_QUALITY.md`) e para o registro de riscos (`15_RISK_REGISTER.md`).

Arquivos não rastreados (trabalho "Stage 1" em andamento, coerente com `docs/stage-1/*.md` já existentes):

```
app/api/geospatial/{clusters,nearest,radius,summary,viewport}/route.ts
docs/stage-1/{00_STAGE_1_SUMMARY,02_DOMAIN_MODEL,03_COORDINATE_QUALITY,04_SPATIAL_INDEX,05_NATIONAL_GRID,07_GEOSPATIAL_APIS,08_TEST_RESULTS}.md
scripts/geospatial-spatial-index.mjs
scripts/geospatial_migrate.py
services/geospatial/{brazil-bounds,compact-site,coordinate-quality-engine,national-grid,request-params,spatial-index-sql.d.mts,spatial-index-sql.mjs,spatial-intelligence-engine,spatial-query-utils}.ts
tests/geospatial-*.test.ts (8 arquivos)
```

Diferente dos arquivos "modified" acima, os arquivos untracked lidos nesta auditoria (`services/geospatial/spatial-query-utils.ts`, `services/geospatial/national-grid.ts`, `services/geospatial/spatial-intelligence-engine.ts`) estão **completos e bem formados** — o problema de truncamento observado é específico aos 19 arquivos "modified", não ao trabalho geoespacial novo.

## 5.3 Dependências

`package.json` (raiz de `APP`) declara um conjunto de dependências surpreendentemente pequeno para o tamanho do projeto:

```json
"dependencies": {
  "leaflet": "^1.9.4",
  "next": "^15.5.0",
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "react-leaflet": "^5.0.0"
},
"devDependencies": {
  "@types/leaflet": "^1.9.20",
  "@types/node": "^22.15.0",
  "@types/react": "^19.1.0",
  "@types/react-dom": "^19.1.0",
  "typescript": "^5.8.0",
  "vitest": "^2.1.0"
}
```

Status: **CONFIRMADO NO CÓDIGO** (arquivo lido diretamente).

Pontos relevantes:

- **Nenhuma dependência de banco de dados é declarada** — nenhum ORM, nenhum driver SQLite de terceiros (`better-sqlite3`, `sql.js` etc. não aparecem em `pnpm-lock.yaml` nem `package-lock.json` — buscas por `sqlite` em ambos os lockfiles não retornaram nenhuma linha). O acesso ao banco usa exclusivamente o módulo nativo `node:sqlite`, embutido no runtime do Node.js a partir da v22 (API ainda experimental na série 22.x). Isso é uma escolha deliberada e documentada (`lib/db.ts`), mas acopla o projeto a uma versão mínima específica do Node.js sem que isso esteja declarado em `engines` no `package.json` (campo `engines` ausente).
- **Biblioteca geoespacial/mapas:** `leaflet` + `react-leaflet` para renderização de mapa no cliente; nenhuma biblioteca de geoprocessamento server-side de terceiros (turf.js, proj4 etc.) — toda a matemática geoespacial (Haversine, grade, bounding box) é implementação própria em `services/geospatial/spatial-query-utils.ts` e `national-grid.ts`.
- **Nenhuma biblioteca de gráficos** de terceiros identificada (não há `recharts`, `chart.js`, `d3` no `package.json`); `components/Donut.tsx` sugere um gráfico de rosca implementado manualmente (não lido em profundidade nesta passada).
- **Nenhuma biblioteca de validação** (`zod`, `yup`) — validação de entrada é feita manualmente (`lib/request-guard.ts`, `services/geospatial/request-params.ts`).
- **Nenhuma biblioteca de IA/ML** de terceiros e nenhuma chamada a API externa de IA identificada em nenhum arquivo lido (ver `09_AI_AND_MACHINE_LEARNING.md`).
- **Exportação:** nenhuma biblioteca de geração de PDF/Excel de terceiros no `package.json` — `utils/pdf.ts` (1,5KB) sugere geração manual; `app/api/export/route.ts` (24KB, o maior arquivo de rota do projeto) contém a lógica de exportação CSV/PDF.
- **Dois lockfiles simultâneos** (`package-lock.json` e `pnpm-lock.yaml`) — indica uso inconsistente de gerenciador de pacotes (npm vs. pnpm) ao longo da vida do projeto. Isso é um risco de reprodutibilidade (ver `15_RISK_REGISTER.md`).
- **Nenhuma dependência com range de versão amplamente aberto** foi observada (todas usam `^`, nenhuma usa `*` ou está sem qualquer restrição) — mas nenhuma verificação online de versões desatualizadas foi feita (fora do escopo desta auditoria, conforme instrução).
- **Pacotes potencialmente desatualizados**: não determinável sem acesso à internet/registro npm nesta sessão (não obrigatório para esta auditoria).

Status geral desta seção: **CONFIRMADO NO CÓDIGO** para presença/ausência de dependências; **NÃO FOI POSSÍVEL CONFIRMAR** quanto a dependências desatualizadas ou não utilizadas em escala (não foi feita uma varredura de uso de cada import em todos os 177 arquivos rastreados).
