# 11 — Performance and Scalability Audit

## 1. Contexto de escala atual

- 299.308 registros em `sites`, banco de 161 MB, processo único Node.js local (`next dev`/`next start`), SQLite via `node:sqlite` (`DatabaseSync`), sem cluster de workers, sem fila de background job.
- `getDb()` abre o banco em modo `readOnly: true` com `PRAGMA query_only = ON; PRAGMA cache_size = -64000` (64 MB de cache de página) — configuração razoável para leitura.
- `getWritableDb()` abre em modo leitura-escrita com `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000` — WAL é a escolha correta para permitir leituras concorrentes durante escritas pontuais (notas, recálculo de trust score, build do grafo).

## 2. Consultas de maior risco identificadas

| Rota | Padrão de consulta | Risco |
|---|---|---|
| `/api/dashboard` | ~9 agregações (`COUNT`, `GROUP BY`, `ORDER BY`) sobre `sites` filtradas dinamicamente, mais amostragem de 4.000 pontos por `ORDER BY (hash) LIMIT 4000` | Amostragem por hash exige ordenar/varrer a tabela inteira que satisfaz o filtro a cada cache-miss — mitigado por cache de 5 min, mas o primeiro request após expirar o cache é caro |
| `/api/mission-control`, `/api/rollout`, `/api/market` | Agregações por município (`GROUP BY municipio, uf`) sobre toda a tabela, sem cache | Recalculado a cada chamada — sem TTL de cache, esses são os endpoints mais expostos a latência repetida sob uso intenso |
| `services/enterprise-v3-engine.ts` (`digitalTwinSite`, `geointelligence`) | Bounding-box sem índice espacial + Haversine em JS sobre o resultado | Sem RTree, o filtro de coordenada não é coberto por índice — ver `08_GIS_AUDIT.md` |
| `services/duplicates-engine.ts` | 4 consultas `GROUP BY ... HAVING COUNT(*) > 1` sobre toda a tabela (mesma sigla, mesma coordenada, coordenadas próximas arredondadas, mesmo endereço) | Cada uma é uma varredura completa; aceitável como operação sob demanda (não está no caminho de toda página), mas não deve ser chamada em polling frequente |
| `sentinel-core/graph/graph-builder.ts` (`buildGraph`) | `JOIN` de `sites` com `site_trust_scores` e `site_satellite_validation`, limitado a `Math.min(5000, limit)` | Já limitado deliberadamente ("modo sample" documentado) — correto para não travar com 299 mil sites, mas significa que o grafo nunca representa a base inteira sem uma reengenharia de processamento incremental/em lote |

## 3. Geração de relatórios (CSV/PDF)

- Exports que usam `statement.iterate(...)` com stream para arquivo (branch final de `export/route.ts`) são a abordagem correta para volume alto — não carregam todas as linhas em memória de uma vez, escrevem em streaming com backpressure (`await once(output, "drain")`).
- Exports que usam `.all()` (carregam tudo em array antes de escrever, ex.: `copernicusCsvRows`, `dataTrustCsvRows`, ambos com `LIMIT 500`/`LIMIT 1000`) são seguros pelo limite explícito de linhas.
- Geração de PDF (`utils/pdf.ts`) é limitada a 44 linhas por página e não suporta múltiplas páginas — adequado apenas para resumos curtos, não para relatórios extensos; se "Executive Reports" precisar crescer em conteúdo, uma biblioteca de PDF real será necessária (ver `02_ARCHITECTURE_AUDIT.md`).

## 4. Banco de dados — lock contention

- `getDb()` (somente leitura) e `getWritableDb()` (leitura-escrita) são conexões **separadas e persistentes** dentro do processo (variáveis de módulo `db`/`writableDb`, inicializadas uma vez). Com WAL habilitado na conexão de escrita, leituras na conexão somente-leitura não devem bloquear em uso normal de único processo.
- Não foi possível testar contention sob concorrência real (múltiplos usuários simultâneos) nesta auditoria, pois isso exigiria carga sintética contra uma instância rodando — recomenda-se um teste de carga dedicado no Stage 0 antes de qualquer uso multiusuário.

## 5. Processamento em segundo plano

**Não existe** nenhum mecanismo de fila/job em background (nem in-process, nem SQLite queue, nem Redis). Toda operação — incluindo recálculo de Trust Score em lote (`recalculateDataTrust`, default `limit=500`) e build do grafo Sentinel Core — roda **de forma síncrona dentro do próprio request HTTP**. Isso significa que uma chamada a `POST /api/data-trust/recalculate` com um `limit` alto bloqueia o processo Node inteiro (single-threaded para JS) até terminar, degradando todas as outras requisições concorrentes durante esse período.

## 6. Limite prático da arquitetura atual

Com a configuração atual (processo único, sem fila, sem índice espacial, cache apenas no dashboard), a arquitetura suporta confortavelmente:

- **Uso single-user local** (o caso de uso documentado) sem qualquer ajuste.
- **Poucos usuários simultâneos** (2–5) em rede local, com degradação perceptível em endpoints não cacheados sob uso concorrente pesado (ex.: vários usuários abrindo Mission Control ao mesmo tempo, cada um disparando as mesmas agregações não cacheadas).
- **Não está pronta hoje** para: dezenas de usuários simultâneos, processamento de imagens SAR em lote (que exigiria fila de jobs e armazenamento de artefato dedicado — Stage 5+), ou monitoramento automatizado nacional agendado (Stage 11) sem introduzir um mecanismo de fila e um worker separado do processo web.

## 7. Recomendação de evolução em estágios (sem substituição prematura)

1. **Agora:** adicionar índice RTree (coordenadas), estender cache em memória (TTL) para `/api/mission-control`, `/api/rollout`, `/api/market`; mover recálculo em lote para execução assíncrona fora do ciclo de request-resposta (ex.: endpoint dispara e retorna imediatamente, processamento continua em um `setImmediate`/worker thread simples, com endpoint de status para consulta).
2. **Médio prazo:** introduzir uma fila leve (SQLite queue própria, ou `better-queue`/similar em processo) para o pipeline de satélite (Stage 5), evitando ainda a necessidade de Redis.
3. **Longo prazo, condicionado a validação de necessidade real:** Redis para cache compartilhado e fila, apenas se/quando a aplicação for multiusuário com múltiplas instâncias — não introduzir por antecipação.

## 8. Achados-chave desta fase

1. O maior risco de performance imediato é a **ausência de cache em endpoints de agregação pesada além do dashboard** — fácil de mitigar reaproveitando o mesmo padrão de `Map` TTL já implementado.
2. Recálculos em lote síncronos dentro do request HTTP são um risco de bloqueio do processo — devem se tornar assíncronos antes de qualquer uso com mais de um usuário simultâneo.
3. A ausência de índice espacial (já registrada na Phase H) também é o principal fator limitante de performance para consultas geográficas em escala.
4. Não há dados empíricos de tempo de resposta sob carga real — recomenda-se benchmark dedicado no Stage 0 antes de fixar metas de SLA.
