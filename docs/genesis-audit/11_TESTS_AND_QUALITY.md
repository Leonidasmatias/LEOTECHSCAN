# 11 — Testes e Qualidade

## Inventário de testes

15 arquivos em `tests/`, todos Vitest (`.test.ts`), nenhum teste de componente React:

```
capabilities-registry.test.ts        copernicus-engine-contract.test.ts
copernicus-truth.test.ts             csv.test.ts
export-path.test.ts                  request-guard.test.ts
geospatial-api-contract.test.ts      geospatial-brazil-bounds.test.ts
geospatial-compact-site.test.ts      geospatial-coordinate-quality.test.ts
geospatial-national-grid.test.ts     geospatial-request-params.test.ts
geospatial-spatial-engine-contract.test.ts
geospatial-spatial-index.test.ts     geospatial-spatial-intelligence-engine.test.ts
```

8 dos 15 são do trabalho geoespacial "Stage 1" ainda não commitado (`git status` os lista como `??`). Vários são "testes de contrato por inspeção de código-fonte" (ex.: `geospatial-spatial-engine-contract.test.ts`, `geospatial-api-contract.test.ts`) — um padrão explicitamente documentado no próprio código como resposta a uma limitação real: arquivos que importam `node:sqlite` (direta ou transitivamente) não podem ser coletados de forma confiável pelo pipeline do Vitest deste projeto (documentado em `docs/stage-0/05_TEST_BASELINE.md` e `docs/stage-1/08_TEST_RESULTS.md`), então esses testes leem o arquivo-alvo como texto e verificam padrões (ex.: "este arquivo importa e chama a função X, não reimplementa a lógica inline") em vez de importar e executar o módulo diretamente.

## Execução real nesta auditoria

**`npx vitest run --reporter=basic` — FALHOU NO STARTUP.** Comando classificado como somente-leitura na intenção (rodar testes já configurados, sem alterar nada) e executado. Erro real:

```
Error: Cannot find module '@rollup/rollup-linux-x64-gnu'. npm has a bug related to
optional dependencies (https://github.com/npm/cli/issues/4828).
```

Causa: `node_modules` foi instalado na máquina Windows do usuário (fora desta sessão); os binários nativos opcionais do Rollup/esbuild instalados são os da variante Windows, não Linux. Esta sessão de auditoria roda em uma VM Linux-ponte (ver `01_ENVIRONMENT_AND_REPOSITORY.md`). **Isto é uma limitação de ambiente desta sessão de auditoria, não uma falha do projeto** — o mesmo tipo de limitação já havia sido documentado por sessões anteriores (`docs/stage-0/05_TEST_BASELINE.md`, `docs/stage-1/08_TEST_RESULTS.md`, `docs/stage-1/05_NATIONAL_GRID.md`), que descreveram um bloqueio equivalente (registro npm inacessível) impedindo a mesma verificação. Nenhuma tentativa de instalar/reinstalar pacotes foi feita, por estar fora do escopo permitido desta missão.

Status: **NÃO FOI POSSÍVEL CONFIRMAR** execução real dos 15 arquivos de teste nesta sessão. O resultado "83/83 testes passaram" citado em `docs/stage-1/08_TEST_RESULTS.md` é uma execução feita pelo usuário em sua própria máquina — classificado aqui como **DOCUMENTADO, MAS NÃO CONFIRMADO** por esta auditoria (não temos como verificar independentemente que esse número reflete o estado atual do working tree, especialmente considerando o achado abaixo).

**`npx tsc --noEmit` — EXECUTOU COM SUCESSO (o comando, não o resultado) e retornou erros reais.** TypeScript não depende de binário nativo compilado, então rodou normalmente nesta VM Linux. Isso produziu evidência direta e verificável (não uma suposição) do estado atual do código:

```
.next/types/routes.d.ts(110,9): error TS1005: '}' expected.
.next/types/validator.ts(414,39): error TS1005: '>' expected.
app/api/export/route.ts(221,63): error TS1005: ']' expected.
app/api/geointelligence/route.ts(16,38): error TS1005: '}' expected.
app/api/telecom-ai/route.ts(15,33): error TS1002: Unterminated string literal.
components/CopernicusModules.tsx — 6 erros de tag JSX não fechada
components/Dashboard.tsx — 5 erros de tag JSX não fechada
components/DataTrustModules.tsx — 6 erros
components/MissionControl.tsx — 3 erros
components/SentinelCoreModules.tsx — 3 erros
components/Sprint2BModules.tsx — 4 erros
components/Sprint3Modules.tsx — 4 erros
components/Sprint4Modules.tsx — 4 erros
package.json(24,8): error TS1002: Unterminated string literal.
services/copernicus-engine.ts(246,36): error TS1002: Unterminated string literal.
services/geospatial/spatial-intelligence-engine.ts(198,48): error TS1005: '}' expected.
```

Total: erros em 3 rotas de API, 7 componentes, `package.json`, e 2 arquivos de serviço — **todos** os arquivos com erro (exceto os dois em `.next/types`, que são gerados automaticamente pelo Next.js e não código-fonte) **coincidem exatamente com a lista de 19 arquivos "modified" não commitados** do `git status` (ver `01_ENVIRONMENT_AND_REPOSITORY.md`). Isso não é coincidência — é a mesma causa raiz.

## Achado central: evidência de truncamento, não de má qualidade de autor

Comparação direta feita nesta auditoria (comando `git diff -- app/api/telecom-ai/route.ts` e `git show HEAD:app/api/telecom-ai/route.ts`):

- Versão commitada (`HEAD`): 18 linhas, completa, bem formada, termina com `}` fechando a função.
- Versão no working tree (não commitada): termina abruptamente em `console.error("telecom_ai_fa` — uma string TypeScript literalmente cortada no meio, sem a linha de fechamento da função, e o Git reporta "\ No newline at end of file".

Uma segunda verificação (dois `md5sum` do mesmo arquivo com 5 segundos de intervalo) confirmou que o arquivo **está estável no estado truncado** agora — ou seja, não é um piscar momentâneo sendo lido pela auditoria, é o conteúdo real e persistente do arquivo neste momento. Isso é consistente com uma gravação que foi interrompida (por um editor, uma ferramenta de build/watch, ou uma outra sessão de trabalho no mesmo repositório) e nunca foi retomada, não com um erro de digitação de um desenvolvedor.

**Isso é reportado como um bloqueio (Seção 24 da missão), não contornado:** esta auditoria não tentou "corrigir" nem investigar mais a fundo a causa exata (fora do escopo somente-leitura). O que se pode afirmar com confiança: (a) o estado exato do working tree no momento desta auditoria não compila; (b) a causa mais provável, por evidência direta, é truncamento de gravação, não erro de lógica; (c) recomenda-se ao usuário verificar, na sua própria máquina, se algum processo (editor, IA, script) estava gravando esses arquivos no momento em que esta auditoria rodou, e revalidar o estado do working tree antes de qualquer commit.

## Lint e formatação

**NÃO IMPLEMENTADO** — nenhum script de lint (`eslint`) ou formatação (`prettier`) está declarado em `package.json`, e nenhum arquivo de configuração correspondente (`.eslintrc*`, `.prettierrc*`) foi encontrado na listagem de arquivos do repositório.

## Cobertura de testes

**NÃO FOI POSSÍVEL CONFIRMAR** um número de cobertura (nenhuma ferramenta de cobertura configurada nem executada). Qualitativamente: os 15 testes existentes cobrem principalmente a camada geoespacial (matemática pura) e alguns contratos de serviço (`copernicus`, `capabilities-registry`, `csv`, `export-path`, `request-guard`) — não há nenhum teste para `services/sentinel-scoring.ts`, `services/data-trust-engine.ts`, `services/confidence-engine.ts`, nem para nenhuma das 37 rotas de API não lidas em profundidade nesta auditoria.

## Testes ignorados / comportamento não determinístico

**NÃO FOI POSSÍVEL CONFIRMAR** (a suíte não pôde ser executada nesta sessão). O código lido não mostra nenhum `.skip()`/`.todo()` nos arquivos de teste abertos.
