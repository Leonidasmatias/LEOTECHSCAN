# 12 — Baseline de Performance

## O que pôde ser medido com segurança nesta auditoria

| Métrica | Valor | Como foi obtido |
|---|---|---|
| Tamanho do banco de dados | 185.020.416 bytes (185MB) principal + 57.832.472 bytes (58MB) de WAL + 32.768 bytes de SHM | `ls -la` no arquivo, leitura de metadados apenas |
| Linhas na tabela central (`sites`) | 299.308 | `SELECT COUNT(*)` somente leitura |
| Verificação de integridade do banco | `ok` | `PRAGMA integrity_check` (somente leitura, seguro) |
| Tamanho do repositório de código | 1,3GB total, 1,1GB é `node_modules` | `du -sh` |
| Maior arquivo de exportação já gerado | `sites_consolidados.csv`, 73.339.462 bytes (~73MB) | Listagem de diretório em `EXPORTACOES` |
| Maior arquivo de rota de API | `app/api/export/route.ts`, 23.980 bytes | Listagem de arquivo |
| Tempo de resposta de `tsc --noEmit` | Concluiu em menos de 90 segundos (timeout usado) | Execução real nesta sessão |

## O que NÃO pôde ser medido nesta auditoria, e por quê

- **Tempo de build (`next build`):** não executado. Motivo: mesma incompatibilidade de binário nativo Linux/Windows que impediu o Vitest (ver `11_TESTS_AND_QUALITY.md`) provavelmente afetaria o compilador SWC do Next.js também; e o working tree atual não compila (`tsc` retorna erros), então uma tentativa de build falharia por essa razão de qualquer forma, não seria uma medição válida de performance. Não tentado, para não gastar tempo em um resultado já sabido como inconclusivo.
- **Tempo de testes (`vitest`):** não executado (falha de startup, ver `11_TESTS_AND_QUALITY.md`).
- **Tempo de inicialização do servidor (`next dev`/`next start`):** não executado — rodar o servidor estaria na fronteira entre "somente leitura" e "potencialmente modificador" (abre conexão de escrita ao banco via `getWritableDb` na primeira chamada de certas rotas) e a missão pede para não realizar testes de carga; short-circuited para respeitar o princípio de cautela.
- **Tamanho do bundle de produção:** não determinável sem um build bem-sucedido.
- **Tempo de resposta de APIs críticas sob carga real:** não medido — a missão veda explicitamente testes de carga agressivos, e mesmo uma medição "leve" exigiria rodar o servidor (ver acima).
- **Consumo de memória:** não medido, mesma razão.

## Riscos de performance previsíveis por leitura de código (sem medição direta)

- **`/api/dashboard`** executa 7+ agregações SQL distintas por chamada sem filtro (`COUNT`, múltiplos `GROUP BY` sobre 299.308 linhas), mitigado por um cache em memória de 5 minutos — mas a primeira chamada após expirar o cache paga o custo total. O índice `idx_filters` cobre as colunas de filtro mais comuns; não há índice dedicado para os `GROUP BY` de agregação (`tecnologia`, `estado` etc. isoladamente), então o SQLite provavelmente usa `idx_filters` parcialmente ou faz varredura — **não confirmado por `EXPLAIN QUERY PLAN`** (não executado nesta auditoria por ser potencialmente mais invasivo que o escopo estritamente de leitura de metadados que foi priorizado; recomenda-se para a próxima rodada).
- **Consultas geoespaciais (Stage 1)** foram desenhadas com prefiltragem por R-Tree e limites explícitos em todos os pontos (ver `06_GEOSPATIAL_AND_MAPS.md`) — o próprio código documenta uma medição de performance anterior (Checkpoint 3, citada em comentários) que encontrou o teto real de `SQLITE_MAX_VARIABLE_NUMBER` = 32.766 neste build específico, e ajustou o chunking para 900 por segurança entre ambientes. Essa é a única medição de performance real e documentada (por terceiros, não por esta auditoria) encontrada no projeto.
- **Exportação (`/api/export`)** é a rota com maior risco de tempo de resposta alto, dado que `EXPORTACOES/sites_consolidados.csv` (73MB) sugere serialização de volume próximo ao total da base em pelo menos um fluxo de exportação — não confirmado com medição direta.

## Baseline recomendado para a Fase Genesis

Como esta auditoria não pôde medir build/testes/carga por limitação de ambiente, a primeira ação prática de performance na Fase Genesis deveria ser: rodar `npm run build`, `npm test` e um perfil básico de `/api/dashboard` e `/api/export` na máquina real do usuário (Windows, onde o `node_modules` foi instalado), com o working tree já reconciliado (ver `14_INCREMENTAL_IMPLEMENTATION_PLAN.md`, Fase 0), e registrar esses números como a baseline oficial — algo que nem esta auditoria nem, aparentemente, nenhuma anterior conseguiu produzir de forma completa (as anteriores tiveram o mesmo bloqueio de ambiente, ver `docs/stage-0/08_REMAINING_RISKS.md`).
