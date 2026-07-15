# 01 — Filesystem and Repository Inventory

**Audit:** LeoTechScan / Sentinel-1 Enterprise — Auditoria Técnica V4
**Data da auditoria:** 15/07/2026
**Escopo:** `C:\LEOTECHSCAN` (raiz completa), leitura apenas, nenhuma alteração realizada.

## 1. Estrutura de alto nível confirmada

| Pasta | Existe | Tamanho aproximado | Observação |
|---|---|---|---|
| `C:\LEOTECHSCAN\APP` | Sim | 1.3 GB (1.1 GB `node_modules`, 207 MB `.next`, ~1 MB código-fonte) | Aplicação Next.js |
| `C:\LEOTECHSCAN\BACKUPS` | Sim | 596 MB | 9 arquivos `.zip` + 1 `.db` órfão |
| `C:\LEOTECHSCAN\BASE` | Sim | 0 bytes | **Vazia** — sistema opera em modo fallback |
| `C:\LEOTECHSCAN\DATABASE` | Sim | 217 MB | `leotechscan.db` + `-wal` + `-shm` |
| `C:\LEOTECHSCAN\EXPORTACOES` | Sim | 72 MB | 41 arquivos (CSV/PDF), mistura de exports "vivos" e históricos |
| `C:\LEOTECHSCAN\LOGS` | Sim | 29 KB | 4 logs texto + 5 notas de sprint em Markdown |
| `C:\LEOTECHSCAN\MAPAS` | Sim | 0 bytes | Vazia (apenas `.gitkeep`) |
| `BASE SPAZIO COM IBGE_n.xlsx` | Sim | 52.191.443 bytes | Fonte TIM |
| `VIVO SITES.xlsx` | Sim | 1.580.352 bytes | Fonte VIVO |

Total do projeto: **≈2.2 GB**. Estrutura corresponde exatamente ao esperado no prompt de auditoria; nenhuma pasta de alto nível está ausente ou com nome divergente.

## 2. `C:\LEOTECHSCAN\APP` em detalhe

Código-fonte próprio (excluindo `node_modules` e `.next`): **129 arquivos**, ~600 KB no total. Estrutura:

```
app/            rotas Next.js (App Router) + estilos globais
  api/          43 route handlers (ver 06_API_BACKEND_AUDIT.md)
components/     12 componentes React client-side
services/       17 módulos de regra de negócio (engines)
sentinel-core/  24 arquivos — grafo de conhecimento (SIG), inferência, recomendação
lib/            4 utilitários (db, filters, operator, types)
core/           1 arquivo (contrato de colunas unificadas)
database/       1 arquivo (constantes de schema)
config/         3 arquivos JSON (regras de score e operadora)
importers/      1 script Python (importador multi-operadora)
scripts/        3 scripts Python (import wrapper, auditoria e migração V13)
utils/          2 utilitários (CSV, PDF)
api/            1 arquivo (seletor de colunas SQL)
exports/, logs/, operator-engine/, sentinel-core/  READMEs de documentação de pasta (sem código)
```

Arquivos de configuração de projeto: `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `.gitignore`, `README.md` (14,5 KB), `CHANGELOG.md` (5 KB).

Arquivos gerados/temporários encontrados na raiz de `APP`: `sprint5.out.log` (191 bytes), `sprint5.err.log` (0 bytes — vazio, sem erros registrados).

### 2.1 Dependências (`node_modules`)

- 1,1 GB em disco, 25 pacotes de topo (inclui `@img` — binário nativo do `sharp`, usado pelo pipeline de imagem do Next.js).
- `package.json` declara apenas 5 dependências diretas (`leaflet`, `next`, `react`, `react-dom`, `react-leaflet`) e 5 devDependencies de tipos + `typescript`.
- **Achado:** dois lockfiles coexistem — `package-lock.json` (32,7 KB, npm) **e** `pnpm-lock.yaml` (20,8 KB, pnpm). Isso indica que o projeto já foi instalado com ambos os gerenciadores em algum momento, criando risco de builds não determinísticos dependendo de qual gerenciador for usado. Nenhum `pnpm` executável foi encontrado no ambiente de auditoria para confirmar qual lockfile está realmente em uso.

### 2.2 Build (`.next`)

- 207 MB, com timestamp de build mais antigo (28/06/2026) — não corresponde à data do commit mais recente de código (`README.md` foi atualizado por último). Ou seja, **o build em disco está desatualizado** em relação ao código-fonte atual.
- Uma tentativa de rebuild (`npm run build`) foi iniciada nesta auditoria em background para validação, mas o ambiente de execução da auditoria não sustenta processos em segundo plano entre chamadas de ferramenta (o processo Node foi encerrado antes de gerar saída além do banner inicial). Um `npx tsc --noEmit` foi executado com sucesso e **não retornou nenhum erro de tipo**. Ver `12_TEST_QUALITY_AUDIT.md` para detalhes e ressalvas.

## 3. Controle de versão (Git)

**Não existe repositório Git em nenhum ponto de `C:\LEOTECHSCAN`.** `git status` a partir de `APP` retorna `fatal: not a git repository`, e uma busca recursiva por diretórios `.git` (excluindo `node_modules`) não encontrou nenhum. Não há branches, não há histórico de commits, não há `.gitignore` versionado de fato (o arquivo existe mas não há repositório para ele governar).

Na ausência de Git, o projeto usa **backups manuais em `.zip`** como único mecanismo de controle de versão/rollback (ver seção 4).

## 4. `BACKUPS` — inventário

9 arquivos `.zip`, todos entre 66 MB e 71 MB, nomeados por marco de versão:

| Arquivo | Tamanho | Data |
|---|---|---|
| `LeoTechScan-V1-ANTES-V1.1.zip` | 66.060.965 | 24/06 |
| `LeoTechScan-V1-VALIDADO.zip` | 66.060.965 | 24/06 |
| `LeoTechScan-V1.1-ANTES-V1.2.zip` | 66.069.301 | 24/06 |
| `LeoTechScan-V1.1-VALIDADO.zip` | 66.069.301 | 24/06 |
| `LeoTechScan-V1.2-ANTES-V1.3.zip` | 66.077.098 | 24/06 |
| `LeoTechScan-V1.2-EXECUTIVE-RISK-VIEW.zip` | 66.077.098 | 24/06 |
| `LeoTechScan-V1.2-VALIDADO.zip` | 66.076.891 | 24/06 |
| `LeoTechScan-V1.3-OPERATOR-INTELLIGENCE.zip` | 70.938.688 | 24/06 |
| `leotechscan-v1.2-pre-v1.3.db` | 91.435.008 | 24/06 (arquivo `.db` solto, não compactado) |

Cada `.zip` inclui uma cópia completa de `BASE SPAZIO COM IBGE_n.xlsx` (52 MB) dentro do pacote — ou seja, ~470 MB dos 596 MB de `BACKUPS` são cópias redundantes da mesma planilha de origem repetidas em cada snapshot. Não há backups depois da V1.3 (24/06), enquanto o código e `CHANGELOG.md` documentam sprints até a Sprint 7 (15/07) — **os backups estão defasados em relação ao estado atual do código em pelo menos 4 sprints.**

## 5. `DATABASE` — inventário

- `leotechscan.db`: 168.914.944 bytes (161 MB)
- `leotechscan.db-wal`: 57.832.472 bytes (55 MB) — write-ahead log não fez checkpoint recentemente
- `leotechscan.db-shm`: 32.768 bytes

Análise de conteúdo completa em `04_DATABASE_AUDIT.md`. Nenhuma alteração foi feita: a auditoria copiou os três arquivos para um diretório temporário isolado (`/tmp`, fora da pasta do projeto) e consultou exclusivamente a cópia, em modo `PRAGMA query_only=1`.

## 6. `EXPORTACOES` — inventário

41 arquivos, destaques:

- `sites_consolidados.csv` — **73.339.462 bytes**, maior arquivo da pasta; dump quase completo da tabela `sites` gerado diretamente pelo importador Python (não pela API web).
- `sentinel_graph_nodes.csv` (502 KB) e `sentinel_graph_edges.csv` (558 KB) — export do grafo SIG.
- Diversos CSVs com timestamp no nome (`executive-report-*`, `mission-control-*`, `sites-criticos-*`, `site-TSHG01-*`) — evidência de que exports antigos não são limpos automaticamente; a pasta acumula exports "vivos" (sobrescritos) e "históricos" (com timestamp) lado a lado, sem rotina de retenção/expiração.
- 3 PDFs pequenos (`comparativo_tim_vivo.pdf` 774 bytes, `copernicus_site_validation.pdf` 1.268 bytes, `site_technical_dossier.pdf` 1.263 bytes) — tamanho consistente com o gerador de PDF artesanal de página única encontrado em `utils/pdf.ts` (ver `06_API_BACKEND_AUDIT.md`).

## 7. `LOGS` — inventário

- `importacao.log` (331 bytes), `importacao_sentinel_v2.log` (511 bytes), `migracao-v13.log` (743 bytes) — logs de execução do importador, pequenos e consistentes com poucas execuções.
- 5 documentos Markdown de planejamento de sprint (`checkpoint_sentinel_v2.md`, `sprint_4_enterprise_v3.md`, `sprint_5_data_trust_validation_engine.md`, `sprint_6_sentinel_core_sig.md`, `sprint_7_enterprise_ux_ui.md`) e uma proposta (`copernicus_satellite_intelligence_proposal.md`). Estes são notas de planejamento interno, não logs de aplicação — tecnicamente arquivados no lugar errado (deveriam estar em `APP/docs` ou similar), mas seu conteúdo é consistente com o que foi de fato implementado no código (ver `03_DOCUMENTATION_TRACEABILITY.md`).

## 8. `MAPAS` — inventário

Vazia (apenas `.gitkeep`, 1 byte). Não há tiles offline, GeoJSON pré-processado ou qualquer artefato geoespacial armazenado. A pasta existe apenas como placeholder estrutural.

## 9. `BASE` — inventário

**Vazia.** O importador (`multi_operator_import.py`) está atualmente operando em modo fallback, lendo diretamente `C:\LEOTECHSCAN\BASE SPAZIO COM IBGE_n.xlsx` e `C:\LEOTECHSCAN\VIVO SITES.xlsx` na raiz do projeto — comportamento documentado e intencional (ver `README.md`), confirmado pelo campo `fallback_used=True` na tabela `metadata` e `fallback_usado=1` em ambas as linhas de `import_audit`.

## 10. Classificação de arquivos

| Categoria | Exemplos | Observação |
|---|---|---|
| Código-fonte | `APP/app/**`, `APP/services/**`, `APP/sentinel-core/**` | 129 arquivos, ver Phase B |
| Configuração | `package.json`, `tsconfig.json`, `next.config.ts`, `config/*.json` | Sem `.env`; nenhuma variável sensível versionada |
| Fonte de dados | `BASE SPAZIO COM IBGE_n.xlsx`, `VIVO SITES.xlsx` | Somente leitura, hash verificado (ver Phase E) |
| Saída gerada | `DATABASE/leotechscan.db`, `EXPORTACOES/*.csv`, `.next/` | Regenerável a partir da fonte |
| Cache | `.next/`, `db-wal`/`db-shm` | Regenerável |
| Backup | `BACKUPS/*.zip` | Manual, defasado |
| Temporário | `sprint5.*.log` | Pequeno, inofensivo |
| Legado | `leotechscan-v1.2-pre-v1.3.db` (91 MB, solto em `BACKUPS`), `scripts/audit_operator_v13.py`, `scripts/migrate_operator_v13.py`, `operator-engine/README.md` (pasta vazia, só documentação) | Preservados intencionalmente por compatibilidade, mas sem uso ativo confirmado no fluxo atual |
| Desconhecido | Nenhum arquivo não identificável encontrado | — |

## 11. Achados-chave desta fase

1. **Nenhum controle de versão Git existe** — todo o histórico depende de backups `.zip` manuais e defasados (parados na V1.3, 4 sprints atrás do código atual).
2. **Dois lockfiles conflitantes** (`package-lock.json` + `pnpm-lock.yaml`) — ambiguidade sobre qual gerenciador de pacotes é a fonte da verdade.
3. **`BASE` está vazia** — o sistema depende do fallback para os arquivos-fonte na raiz; se algum dia esses dois arquivos forem movidos para dentro de `BASE`, o comportamento de descoberta muda automaticamente (por design, mas é um ponto de atenção operacional).
4. **`.next` desatualizado** frente ao código-fonte mais recente — build em disco não reflete Sprint 7.
5. **`EXPORTACOES` sem rotina de retenção** — mistura de arquivos "vivos" sobrescritos e snapshots históricos com timestamp, crescendo indefinidamente.
6. **Backups redundantes** — cada `.zip` de backup inclui uma cópia integral do Excel de 52 MB, inflando `BACKUPS` desnecessariamente.
