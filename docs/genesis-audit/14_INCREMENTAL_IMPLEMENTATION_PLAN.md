# 14 — Plano Incremental de Implementação

**Nenhuma destas fases foi implementada nesta auditoria.** Este documento é apenas uma proposta de sequência segura, derivada das lacunas identificadas em `13_GENESIS_GAP_ANALYSIS.md` e dos bloqueios registrados em `11_TESTS_AND_QUALITY.md`.

## Fase 0 — Preservação e baseline

- **Objetivo:** ter uma baseline commitada, íntegra e que compila, antes de qualquer outra mudança.
- **Arquivos afetados futuramente:** os 19 arquivos hoje "modified" no working tree (`app/api/export/route.ts`, `app/api/geointelligence/route.ts`, `app/api/telecom-ai/route.ts`, `app/globals.css`, 7 componentes, `importers/multi_operator_import.py`, `next.config.ts`, `package.json`, `package-lock.json`, `services/copernicus-engine.ts`, `utils/csv.ts`, `vitest.config.ts`), e os 14 arquivos "untracked" do trabalho geoespacial Stage 1.
- **Dependências:** nenhuma — é a primeira fase.
- **Riscos:** reconciliar os arquivos truncados incorretamente (ex.: aceitar a versão truncada como "definitiva") apagaria trabalho real. Recomenda-se comparar cada um dos 19 arquivos contra `git show HEAD:<arquivo>` e contra a intenção original (ex.: o trabalho geoespacial Stage 1, se for a mudança pretendida, precisa ser reaplicado de forma completa, não a partir do estado truncado atual).
- **Testes:** rodar `npm test` e `npx tsc --noEmit` na máquina real do usuário (não nesta sessão) até ambos passarem limpos.
- **Critérios de aceite:** `git status` limpo ou com apenas mudanças intencionais e completas; `npx tsc --noEmit` sem erros; `npm test` executando (mesmo que nem todos passem, precisa ao menos rodar).
- **Rollback:** os backups em `C:\LEOTECHSCAN\BACKUPS\` (incluindo `LeoTechScan-Stage0-PreImplementation-20260715T143837Z.zip` e o backup de banco `leotechscan-db-backup-20260715T143837Z.db`) já fornecem um ponto de rollback conhecido.
- **Fora de escopo:** qualquer nova funcionalidade.

## Fase 1 — Contratos e modelo canônico

- **Objetivo:** consolidar o schema hoje fragmentado (`importers/multi_operator_import.py`, `database/schema.ts`, `services/data-trust-engine.ts::ensureDataTrustTables`) em uma única fonte de verdade versionada.
- **Arquivos afetados futuramente:** `database/schema.ts` (hoje 5 linhas — passaria a ser o schema real), possivelmente um novo diretório de migrações.
- **Dependências:** Fase 0 concluída.
- **Riscos:** qualquer migração real sobre `leotechscan.db` (185MB, 299.308 linhas em produção) deve ser feita sobre uma cópia de backup primeiro, nunca diretamente.
- **Testes:** testes de schema que confirmem que a definição única corresponde ao banco real existente.
- **Critérios de aceite:** uma única definição de schema referenciada por todo o código; nenhuma tabela criada por `CREATE TABLE IF NOT EXISTS` espalhada em código de serviço.
- **Rollback:** backup de banco pré-migração.
- **Fora de escopo:** mudar tipos de coluna existentes ou dado já importado.

## Fase 2 — Proveniência e snapshots

- **Objetivo:** estender o padrão de proveniência já existente (`import_audit`, hash SHA-256) para cobrir recálculos de score e mudanças de configuração (`config/*.json`), e formalizar uma cadência de snapshot histórico além do único `sig_snapshots` atual.
- **Arquivos afetados futuramente:** `services/data-trust-engine.ts`, `services/sentinel-scoring.ts`, novo mecanismo de snapshot.
- **Dependências:** Fase 1.
- **Riscos:** volume de histórico crescendo sem estratégia de retenção (mesma lição já aprendida em `scripts/backup_database.py`, que documenta explicitamente que retenção é decisão manual, não automática).
- **Testes:** verificar que um recálculo de score é rastreável a uma versão de algoritmo e a um timestamp.
- **Critérios de aceite:** qualquer score no banco pode ser explicado (qual fórmula, qual versão, quando).
- **Rollback:** reverter para o estado sem versionamento de algoritmo é possível a qualquer momento (é aditivo).
- **Fora de escopo:** reprocessamento retroativo de scores antigos.

## Fase 3 — Sentinel Intelligence Core Foundation

- **Objetivo:** decidir e, se aprovado, implementar de fato as entidades/adapters de `sentinel-core/` hoje reduzidos a stubs de 60–150 bytes.
- **Arquivos afetados futuramente:** `sentinel-core/entities/*.ts`, `sentinel-core/adapters/*.ts`.
- **Dependências:** Fase 1 (modelo canônico) — as entidades deveriam referenciar o schema consolidado, não o fragmentado atual.
- **Riscos:** reescrever essa camada sem entender por que ela foi deixada como stub (pode ter sido uma decisão deliberada de escopo, não uma omissão) — recomenda-se checar `docs/stage-0` e `docs/stage-1` por menção explícita antes de assumir que é dívida técnica não intencional.
- **Testes:** os testes de contrato já existentes (`tests/geospatial-spatial-engine-contract.test.ts` como modelo) são um bom padrão a replicar para as novas entidades.
- **Critérios de aceite:** cada entidade/adapter faz algo além de reexportar uma função já existente.
- **Rollback:** reverter para os stubs atuais (sem perda, pois eles não fazem nada hoje).
- **Fora de escopo:** IA/ML real (ver Fase 6 em diante e `09_AI_AND_MACHINE_LEARNING.md`).

## Fase 4 — Data Trust Engine (cobertura completa)

- **Objetivo:** rodar `recalculateDataTrust` contra 100% dos 299.308 sites (hoje: 270, 0,09%).
- **Arquivos afetados futuramente:** nenhum código novo necessariamente — principalmente uma execução em lote controlada.
- **Dependências:** Fase 0.
- **Riscos:** custo de processamento em lote sobre 299.308 linhas; deve ser medido antes (ver `12_PERFORMANCE_BASELINE.md`) para evitar travar o processo de escrita (`getWritableDb`) por tempo excessivo.
- **Testes:** conferir que `site_trust_scores` e `site_validation_history` chegam a ~299.308 linhas sem erro, e que a distribuição de badges (Platinum/Gold/Silver/Bronze/Critical) é plausível.
- **Critérios de aceite:** `SELECT COUNT(*) FROM site_trust_scores` ≈ `SELECT COUNT(*) FROM sites`.
- **Rollback:** a tabela é aditiva (histórico em `site_validation_history`); pode ser truncada e recalculada sem perda de `sites`.
- **Fora de escopo:** mudar a fórmula de confiança nesta fase.

## Fase 5 — Telecom DNA

- **Objetivo:** definir do zero este conceito, que não existe hoje em nenhuma forma (`13_GENESIS_GAP_ANALYSIS.md`).
- **Arquivos afetados futuramente:** a definir — não há ponto de partida no código atual.
- **Dependências:** Fases 1–4 (precisa de dados confiáveis e modelo canônico consolidado como insumo).
- **Riscos:** maior risco de todas as fases por ser 100% nova — recomenda-se um design document dedicado antes de qualquer código.
- **Testes:** a definir junto com o design.
- **Critérios de aceite:** a definir.
- **Rollback:** trivial (nada existe ainda para reverter).
- **Fora de escopo:** qualquer coisa além da definição/design nesta fase inicial.

## Fase 6 — Risk, Opportunity e Confidence (consolidação)

- **Objetivo:** unificar as três noções de "risco" hoje fragmentadas (`risco`/`ori_risk` no import, `risk` no dashboard, `SRI` municipal) em um Risk Engine único e explícito, e formalizar Opportunity Engine no nível de site (hoje só municipal).
- **Arquivos afetados futuramente:** `services/sentinel-scoring.ts`, `app/api/dashboard/route.ts`, `importers/multi_operator_import.py`.
- **Dependências:** Fase 1 (schema único), Fase 4 (Confidence/Trust cobrindo 100% da base).
- **Riscos:** mudar a definição de "risco" pode invalidar relatórios/exports já entregues a stakeholders (`EXECUTIVE-REPORT-*.csv` já gerados) — versionar a mudança explicitamente.
- **Testes:** testes de regressão comparando o risco antigo vs. novo para uma amostra conhecida.
- **Critérios de aceite:** um único "Risk Score" documentado, com escopo (site vs. município) explícito.
- **Rollback:** manter os campos antigos (`risco`, `ori_risk`) como legado até a migração ser validada.
- **Fora de escopo:** Priority Engine (fase seguinte).

## Fase 7 — Decision Services

- **Objetivo:** criar a camada de composição de decisão que hoje não existe (`13_GENESIS_GAP_ANALYSIS.md`), reaproveitando os engines já existentes (Risk, Opportunity, Confidence, Recommendation) em vez de reescrevê-los.
- **Arquivos afetados futuramente:** novo diretório `decision-services/` (proposto), consumindo `services/*-engine.ts` e `sentinel-core/*`.
- **Dependências:** Fases 3–6.
- **Riscos:** acoplamento excessivo se a camada de composição depender de detalhes internos dos engines em vez de suas interfaces públicas.
- **Testes:** testes de contrato (padrão já estabelecido no projeto) confirmando que Decision Services delega, não reimplementa.
- **Critérios de aceite:** uma decisão de negócio (ex.: "priorizar expansão no município X") é rastreável aos engines que a compuseram.
- **Rollback:** camada é aditiva sobre os engines existentes; reverter é remover o novo diretório sem afetar o restante.
- **Fora de escopo:** UI para essas decisões (fase seguinte).

## Fase 8 — Integração progressiva das interfaces

- **Objetivo:** trazer a Experience Layer (componentes React) de volta a um estado estável e íntegro (ver `07_FRONTEND_AND_UX.md`), e então integrar as novas capacidades das fases anteriores à UI.
- **Arquivos afetados futuramente:** `components/**`, começando pelos 7 hoje quebrados.
- **Dependências:** Fase 0 obrigatoriamente; as demais fases conforme cada capacidade for exposta na UI.
- **Riscos:** UI e backend evoluindo em ritmos diferentes sem contrato de API estável — mitigar reaproveitando o padrão de "rota fina, lógica no serviço" já usado em `app/api/geospatial/viewport/route.ts`.
- **Testes:** testes de componente (hoje inexistentes — esta fase deveria introduzir os primeiros).
- **Critérios de aceite:** `npx tsc --noEmit` limpo para todos os componentes; ao menos um teste de fumaça por página.
- **Rollback:** componente a componente, revertendo para a última versão commitada estável.
- **Fora de escopo:** redesign visual (a missão desta auditoria e, por extensão, esta fase, não incluem redesign).
