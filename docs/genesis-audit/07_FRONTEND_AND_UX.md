# 07 — Frontend e Experiência

## Escopo e limitação desta seção

Esta auditoria priorizou a leitura profunda do backend (rotas, serviços, banco). Os componentes React foram **localizados, catalogados por tamanho, e verificados quanto a erros de compilação via `npx tsc --noEmit`**, mas **não foram lidos linha a linha em profundidade** nesta passagem (com exceção de trechos inspecionados para confirmar os erros de sintaxe reportados). Isso é declarado explicitamente aqui para não confundir "não lido em detalhe" com "não existe" — ver `16_EVIDENCE_INDEX.md` para o que foi e não foi coberto.

## Páginas e componentes

| Arquivo | Tamanho | Papel (por nome/uso observado) | Estado de compilação (`tsc`) |
|---|---|---|---|
| `app/page.tsx` | 108 bytes | Página raiz única (app de página única, sem roteamento de múltiplas páginas) | OK |
| `app/layout.tsx` | 581 bytes | Layout raiz do Next.js App Router | OK |
| `components/Dashboard.tsx` | 24,5KB (maior componente) | Componente principal, orquestra os módulos de domínio | **QUEBRADO no working tree atual** — `tsc` reporta 5 erros de tag JSX não fechada (`main`, `div`, `footer`, `span`) nas linhas 126–153 |
| `components/MissionControl.tsx` | 7,8KB | UI de "Mission Control" | **QUEBRADO** — tags `div`/`section` não fechadas, linhas 39–62 |
| `components/CopernicusModules.tsx` | 6,1KB | UI de Copernicus | **QUEBRADO** — tags `section`/`div`/`span`/`strong` não fechadas, linhas 71–74 |
| `components/DataTrustModules.tsx` | 5,3KB | UI de Data Trust | **QUEBRADO** — tags não fechadas, linha 61–63 |
| `components/SentinelCoreModules.tsx` | 4,3KB | UI de Sentinel Core | **QUEBRADO** — linha 34–45 |
| `components/Sprint2BModules.tsx` | 6,8KB | UI de um "sprint" específico (nome de marco de desenvolvimento, não de domínio) | **QUEBRADO** — linha 52 |
| `components/Sprint3Modules.tsx` | 5,3KB | Idem | **QUEBRADO** — linha 47–51 |
| `components/Sprint4Modules.tsx` | 10,4KB | Idem | **QUEBRADO** — linha 98–100 |
| `components/AnalyticsPanels.tsx` | 2,7KB | Painéis analíticos | OK (não listado nos erros do `tsc`) |
| `components/CapabilityBadge.tsx` | 2,1KB | Selo/badge de capacidade (provavelmente ligado a `config/capabilities.json`) | OK |
| `components/Donut.tsx` | 1,1KB | Gráfico de rosca (implementação própria, sem biblioteca de gráficos externa) | OK |
| `components/MapView.tsx` | 1,4KB | Mapa Leaflet | OK |
| `components/OperatorView.tsx` | 5,5KB | Visão por operadora | OK |

**Nota de nomenclatura:** a existência de `Sprint2BModules.tsx`, `Sprint3Modules.tsx`, `Sprint4Modules.tsx` como nomes de componentes de produção (em vez de nomes de domínio como `AlertModules.tsx` ou `RolloutModules.tsx`) é um sinal de dívida técnica de organização — o nome do componente reflete quando foi construído, não o que ele faz. Isso dificulta a navegabilidade do código para alguém novo no projeto (incluindo a própria IA que vier a trabalhar na Fase Genesis).

## Estado de compilação — achado central desta seção

Dos 15 componentes em `components/`, **7 estão com erro de compilação JSX no estado atual (não commitado) do working tree**, confirmado por execução real de `npx tsc --noEmit` nesta auditoria (não é uma suposição — é saída de compilador real). Todos os 7 aparecem na lista de "modified" do `git status`, e a versão commitada (`git show HEAD:...`) desses mesmos arquivos não foi verificada individualmente contra o `tsc` (o compilador roda contra o working tree, não contra uma revisão específica do Git) — mas como a hipótese mais provável é truncamento por escrita interrompida (ver `01_ENVIRONMENT_AND_REPOSITORY.md` e `11_TESTS_AND_QUALITY.md`), é razoável supor que a versão commitada compilava.

Status: **CONFIRMADO POR TESTE** (execução real do compilador TypeScript nesta sessão, não uma inferência).

## Design system, tema, responsividade, acessibilidade

- **CSS versionado por marco:** `app/globals.css`, `app/enterprise-theme.css`, e seis arquivos `app/v11.css` até `app/v16.css` — sugere que temas visuais anteriores foram mantidos lado a lado em vez de substituídos/removidos. **NÃO FOI POSSÍVEL CONFIRMAR** se todos os seis ainda são importados/usados ou se são resíduo histórico (CSS morto) — verificação de uso não feita nesta passagem.
- **Responsividade, acessibilidade, estados de loading/vazio/erro:** **NÃO FOI POSSÍVEL CONFIRMAR** — exigiria leitura linha a linha de cada componente, fora do escopo desta passagem.
- **Testes de interface:** **NÃO IMPLEMENTADO** — nenhum arquivo de teste de componente (React Testing Library, Playwright, Cypress) foi encontrado; todos os 15 arquivos em `tests/` testam lógica de backend/serviços, nenhum testa componentes React.

## Regras de negócio no componente / cálculo no navegador

**NÃO FOI POSSÍVEL CONFIRMAR** com leitura direta nesta passagem (ver ressalva de escopo acima). O padrão observado nas rotas de API (que retornam payloads já processados e formatados, ex.: `stars()` em `sentinel-scoring.ts` já gera a representação visual "★★★☆☆" no backend) sugere uma intenção de manter lógica de apresentação no servidor, mas isso não foi verificado contra o código real dos componentes.

## Recomendação para a próxima rodada de auditoria

Esta seção é a menos coberta por evidência direta desta auditoria. Antes de qualquer decisão de arquitetura de frontend para o Sentinel-1 Enterprise, recomenda-se uma leitura dedicada e completa dos 15 componentes (particularmente os 7 quebrados, após reconciliação do working tree) e verificação de: uso real dos 6 arquivos CSS versionados, duplicação de fetch entre componentes, e presença/ausência de error boundaries do React.
