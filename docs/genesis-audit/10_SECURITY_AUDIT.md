# 10 — Auditoria de Segurança

Achados classificados por severidade: CRÍTICO, ALTO, MÉDIO, BAIXO, INFORMATIVO. Nenhum segredo é exibido por completo neste documento (não foi encontrado nenhum segredo no repositório — ver item de `.env` abaixo).

## CRÍTICO

**SEC-01 — Ausência total de autenticação e autorização.** Nenhuma das ~49 rotas de API (`app/api/**/route.ts`) verifica sessão, token, API key ou qualquer credencial. Busca por `authorization`, `jwt`, `session`, `Bearer`, `API_KEY` em todo o código lido não retornou nenhum uso real (apenas uma menção em comentário de `next.config.ts` afirmando explicitamente que os headers ali adicionados "do not add authentication, authorization, or rate limiting, and must never be [confundidos com isso]"). Isso inclui endpoints de **escrita** (`POST /api/data-trust/recalculate`, `POST /api/sites/[id]/notes`, `GET/POST /api/sentinel-core/build`) — qualquer pessoa com acesso de rede ao servidor pode disparar recálculo de scores em massa, escrever notas arbitrárias em um site, ou reconstruir o grafo de conhecimento. Esse achado é auto-reconhecido pelas auditorias anteriores do próprio projeto (`docs/stage-0/08_REMAINING_RISKS.md`: "No authentication or authorization anywhere (audit-v4 risk R2)"), portanto não é uma descoberta isolada desta auditoria — é uma lacuna conhecida e ainda não endereçada. Componente afetado: toda a camada `app/api/**`.

## ALTO

**SEC-02 — Nenhum rate limiting em nenhum endpoint.** Confirmado por ausência de qualquer middleware, contador ou dependência de rate limiting no código e no `package.json`. Combinado com SEC-01, qualquer endpoint (incluindo os de escrita e os de exportação, potencialmente pesados) pode ser chamado sem limite de frequência.

**SEC-03 — `lib/request-guard.ts` cobre apenas uma fração dos endpoints.** O próprio comentário do arquivo declara: "Coverage note: applied to the endpoints identified as highest-risk in the V4 audit ... Extending this to every one of the 43 documented endpoints is tracked as Stage 1+ backlog, not silently claimed here." Ou seja, a maioria das rotas aceita parâmetros de texto/número sem qualquer bound de tamanho confirmado nesta auditoria.

**SEC-04 — Escrita de texto livre sem sanitização confirmada.** `POST /api/sites/[id]/notes` (`services/site-notes.ts`) grava texto do usuário na coluna `note` de `site_notes`; não foi possível confirmar nesta auditoria (arquivo de 1KB, não lido linha a linha) se há limite de tamanho ou sanitização de conteúdo antes da gravação.

## MÉDIO

**SEC-05 — Working tree atual não confiável para deploy.** 19 arquivos modificados e não commitados, com evidência de conteúdo truncado em pelo menos um deles (`app/api/telecom-ai/route.ts`) no momento da auditoria — ver `11_TESTS_AND_QUALITY.md`. Isso não é uma vulnerabilidade de segurança per se, mas é um risco operacional: publicar este estado exato em produção quebraria o build.

**SEC-06 — Dois lockfiles de gerenciadores de pacote diferentes** (`package-lock.json` + `pnpm-lock.yaml`) podem levar a resolução de dependências divergente entre ambientes de desenvolvimento e produção, dependendo de qual gerenciador é usado em cada máquina.

**SEC-07 — Interpolação de nomes de coluna SQL a partir de literais internos, sem allowlist na própria função.** Ver `08_BACKEND_AND_APIS.md` — não há injeção de SQL hoje (nenhum call-site passa entrada de usuário como nome de coluna), mas as funções `group()`/`volume()`/`average()`/`criticalVolume()` em `app/api/dashboard/route.ts` não validam o argumento `column` internamente; um futuro call-site descuidado poderia introduzir injeção sem que a função protegesse contra isso.

**SEC-08 — `/api/system-health` publicamente acessível**, mencionado como preocupação nas auditorias anteriores (`docs/stage-0/08_REMAINING_RISKS.md`: "the new `GET /api/system-health` is reachable by anyone"). Não lido linha a linha nesta auditoria para confirmar exatamente quais informações internas ele expõe.

## BAIXO

**SEC-09 — Ausência de cabeçalhos de segurança HTTP confirmados de forma abrangente.** `next.config.ts` foi identificado como o local onde headers são adicionados (comentário explícito sobre CORS/auth), mas o conteúdo completo do arquivo (que também está entre os "modified" não commitados) não foi lido linha a linha nesta auditoria para listar exatamente quais headers (CSP, HSTS, X-Frame-Options) estão presentes.

**SEC-10 — CORS:** **NÃO FOI POSSÍVEL CONFIRMAR** a configuração exata (arquivo `next.config.ts` não lido linha a linha nesta passagem, e está entre os arquivos modificados não commitados).

## INFORMATIVO

**SEC-11 — Nenhum arquivo `.env` encontrado no repositório.** Busca por `.env*` na raiz de `APP` não retornou nenhum arquivo (apenas `next-env.d.ts`, que é um arquivo de declaração de tipos do TypeScript/Next.js, não um arquivo de variáveis de ambiente). Nenhum segredo, chave de API ou credencial foi encontrado em texto plano em nenhum arquivo lido nesta auditoria.

**SEC-12 — Banco aberto em modo `readOnly: true` + `PRAGMA query_only = ON` para a conexão de leitura** (`lib/db.ts::getDb`), e uma conexão separada e explícita (`getWritableDb`) para as poucas operações de escrita — uma boa prática de menor privilégio no nível da conexão de banco, mesmo sem controle de acesso HTTP acima dela.

**SEC-13 — Multi-tenant / segregação de clientes:** **NÃO IMPLEMENTADO** — não há conceito de tenant, cliente ou organização em nenhuma tabela do banco nem em nenhuma rota lida; o sistema é single-tenant por design atual.

**SEC-14 — Uploads:** **NÃO IMPLEMENTADO** — nenhuma rota de upload de arquivo (multipart/form-data) foi encontrada nas 49 rotas catalogadas; a única ingestão de dados externos é o importador Python rodado manualmente por linha de comando (`scripts/import_excel.py`, `importers/multi_operator_import.py`), fora do runtime HTTP da aplicação.

**SEC-15 — Endpoints administrativos:** não há um namespace `/api/admin/**` distinto — os endpoints de escrita mais sensíveis (`data-trust/recalculate`, `sentinel-core/build`, `sites/[id]/notes`) estão misturados no mesmo nível que os endpoints de leitura pública, sem nenhuma separação de superfície de risco.

## Resumo

| Severidade | Quantidade de achados |
|---|---|
| CRÍTICO | 1 |
| ALTO | 3 |
| MÉDIO | 4 |
| BAIXO | 2 |
| INFORMATIVO | 5 |

A ausência de autenticação (SEC-01) é, isoladamente, o maior bloqueador de prontidão Enterprise identificado nesta auditoria — é citado tanto em `00_EXECUTIVE_SUMMARY.md` quanto em `13_GENESIS_GAP_ANALYSIS.md` como pré-requisito antes de qualquer exposição do produto além de um ambiente local/confiável.
