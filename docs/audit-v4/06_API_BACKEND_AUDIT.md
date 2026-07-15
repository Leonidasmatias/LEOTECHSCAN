# 06 — API and Backend Audit

**43 route handlers** encontrados sob `app/api/**/route.ts`, todos Next.js Route Handlers (`export async function GET/POST`). Nenhum usa middleware de autenticação, rate limiting ou validação de schema formal (ex.: Zod) — validação é feita ad-hoc por função.

## 1. Inventário completo de endpoints

| Método | Rota | Propósito | Paginação | Auth |
|---|---|---|---|---|
| GET | `/api/dashboard` | Dados agregados do dashboard principal | Sim (page/pageSize=30) + amostra de mapa (4.000 pts) + cache em memória (TTL 5 min) | Nenhuma |
| GET | `/api/mission-control` | KPIs e rankings de Mission Control | Não (agregados) | Nenhuma |
| GET | `/api/alerts` | Lista de alertas | Não (cap 500) | Nenhuma |
| GET | `/api/audit-trail` | Trilha de auditoria | Sim (`LIMIT` fixo 200) | Nenhuma |
| GET | `/api/copernicus/search` `/site` `/status` `/validation` | Simulação Copernicus/Sentinel-1 | N/A | Nenhuma |
| GET | `/api/data-quality` | Qualidade cadastral | Não (amostras `LIMIT 25` por categoria) | Nenhuma |
| GET/POST | `/api/data-trust`, `/data-trust/site`, `/data-trust/recalculate` | Data Trust Score | Recalculate aceita `limit` (default 500) | Nenhuma |
| GET | `/api/digital-twin/site` | Digital Twin de um site | N/A (1 site) | Nenhuma |
| GET | `/api/duplicates` | Candidatos a duplicata | Cap 100 | Nenhuma |
| GET | `/api/evidence-center/site`, `/export` | Dossiê de evidência | N/A | Nenhuma |
| GET | `/api/executive-reports` | Relatórios executivos (CSV) | Caps configuráveis via `sentinel_rules.json` | Nenhuma |
| GET | `/api/executive-workspace` | KPIs de diretoria | Não | Nenhuma |
| GET | `/api/export` | **Endpoint universal de exportação** (29 tipos via `?type=`) | Varia | Nenhuma |
| GET | `/api/geointelligence` | Sites num raio geográfico | Cap `maxSites` (config, default 500) | Nenhuma |
| GET | `/api/market` | Snapshot de mercado | Não | Nenhuma |
| GET | `/api/national-timeline` | Timeline nacional | `LIMIT 40`/`80` internos | Nenhuma |
| GET | `/api/opportunities` | Top oportunidades | Cap 100 | Nenhuma |
| GET | `/api/rollout` | Rollout intelligence | Não | Nenhuma |
| POST | `/api/scenario-planner`, `/strategic-planning` | Simulações | N/A | Nenhuma |
| GET/POST | `/api/sentinel-core/build`, `/insights`, `/municipality`, `/operator`, `/recommendations`, `/search`, `/site`, `/status` | Grafo SIG | `build` aceita `limit` (cap 5.000) | Nenhuma |
| GET | `/api/site-recommendation` | Recomendação por site | N/A | Nenhuma |
| GET/POST | `/api/sites/[id]/intelligence`, `/notes` | Detalhe/observações de site | N/A | Nenhuma |
| GET | `/api/strategic-planning` (ver acima) | | | |
| GET | `/api/telecom-ai` | Consulta em linguagem natural (regras) | `maxRows` config (12) | Nenhuma |
| GET | `/api/validation-history/site` | Histórico de validação | `LIMIT 100` | Nenhuma |

## 2. Validação de entrada

- Parâmetros de filtro (`estado`, `municipio`, `tecnologia`, etc.) são resolvidos via **allowlist fixa de colunas** (`FILTER_COLUMNS` em `lib/filters.ts`) — o nome da coluna nunca vem do usuário, apenas o valor, e o valor sempre é passado como parâmetro SQL (`?`). **Nenhuma vulnerabilidade de SQL Injection foi encontrada nos caminhos revisados** (`dashboard`, `export`, `filters.ts`, `duplicates-engine.ts`, `data-quality-engine.ts`).
- IDs de site (`?id=`) são convertidos com `Number(...)` antes de qualquer query — se o parâmetro não for numérico, vira `NaN`, e a query com `WHERE id = ?` simplesmente não encontra nada (comportamento seguro, mas sem mensagem de erro amigável específica).
- Não há validação de schema formal (Zod/Yup/io-ts) em nenhum endpoint — validação é sempre implícita (coerção de tipo + fallback), o que é frágil para manutenção futura à medida que mais parâmetros forem adicionados.

## 3. Paginação e limites

A maioria dos endpoints agregados usa `LIMIT` explícito nas queries SQL, o que é positivo. `/api/dashboard` é o mais bem cuidado: pagina a tabela detalhada (30/página), limita pontos de mapa a 4.000 via amostragem pseudo-aleatória, e cacheia por 5 minutos em um `Map` em memória (com um LRU aproximado — remove a entrada mais antiga quando passa de 40 chaves em cache). **Atenção:** o cache é um `Map` global em memória do processo Node — em um cenário com múltiplos workers/processos (ex.: `next start` com cluster, ou deploy futuro serverless), cada instância teria seu próprio cache, o que é aceitável para uso local single-process mas não escala para múltiplas instâncias sem um cache compartilhado (Redis).

## 4. Endpoint de exportação (`/api/export`) — revisão de risco

Analisado em detalhe (225 linhas). Pontos relevantes:

- **Sem autenticação**, portanto qualquer chamador na rede que alcance a aplicação pode disparar exportação de **toda a tabela `sites`** (branch padrão do `GET`, sem `type` reconhecido nos 29 valores aceitos, retorna erro 400 — mas os tipos válidos incluem rankings completos sem paginação, ex.: `type=ranking` gera um CSV via `statement.iterate(...)` percorrendo **todas** as linhas que atendem ao filtro, potencialmente as 299.308).
- **Risco de path traversal / escrita fora do diretório esperado**: em `kind === "site-csv" | "site-pdf"` e em outros branches, o nome do arquivo gerado usa `site.site` (identificador do site vindo diretamente da planilha importada) diretamente interpolado (`site-${site.site}-${stamp()}.csv`) antes de `path.join(exportDir, filename)`. Embora `site.site` hoje venha de uma fonte semi-confiável (arquivo Excel do operador, não input direto de usuário anônimo da web), **nenhuma sanitização impede caracteres como `..` ou separadores de caminho** caso um valor malicioso apareça em uma planilha futura. Classificado como risco **Médio** — mitigar sanitizando o identificador antes de usá-lo em nome de arquivo.
- **Uso de `flag: "wx"` (escrita exclusiva)** em vários branches (`mission-control-csv`, `site-csv`, `operator-intelligence`, `executive`) — se dois exports do mesmo tipo forem disparados no mesmo segundo (mesmo `stamp()`), a segunda chamada falha com `EEXIST` em vez de sobrescrever ou gerar nome único. Risco **Baixo**, mas afeta confiabilidade sob uso concorrente.
- **CSV/Excel formula injection**: `utils/csv.ts` e o equivalente Python (`write_csv`) escapam corretamente aspas e quebras de linha (RFC 4180), mas **não neutralizam caracteres líderes de fórmula** (`=`, `+`, `-`, `@`). Campos como `site_notes.note` (texto livre inserido pelo operador via UI) são exportados via `telecom-evidence-center.csv`/similares sem essa proteção. Se um valor começar com `=`, o Excel/LibreOffice pode interpretá-lo como fórmula ao abrir o CSV exportado. Risco **Médio** (Excel/CSV Formula Injection, CWE-1236) — recomenda-se prefixar campos que comecem com `=`, `+`, `-`, `@` com um apóstrofo ou aspas simples neutralizantes antes de escrever.
- Toda escrita em disco ocorre em `path.resolve(process.cwd(), "..", "EXPORTACOES")` — fixo, não influenciável por parâmetro de request, o que é positivo.

## 5. Autenticação, autorização, rate limiting

**Nenhum dos 43 endpoints exige autenticação.** Não existe sessão, cookie, JWT, API key ou qualquer outro mecanismo de controle de acesso. Isso é consistente com o propósito documentado (`npm run dev` + `localhost:3000`, ferramenta de uso local/pessoal), mas representa um risco crítico caso a aplicação seja exposta em rede compartilhada ou publicada sem uma camada de proxy/autenticação adicional. Nenhum rate limiting existe em nenhuma rota — um cliente poderia, em teoria, martelar `/api/export?type=ranking` repetidamente sem controle.

## 6. Logging e observabilidade

Logging é esparso: `console.error`/`console.info` pontuais em `dashboard/route.ts` e `export/route.ts` (ex.: `csv_export_created`, `csv_export_failed`, `dashboard_read_failed`). Não há logging estruturado (JSON), não há correlação de request ID, não há integração com nenhum serviço de observabilidade.

## 7. Cache

Apenas `/api/dashboard` implementa cache (em memória, 5 min TTL). Os demais endpoints recalculam a cada chamada — para endpoints que fazem múltiplas agregações sobre 299 mil linhas (ex.: `/api/mission-control`, `/api/rollout`), isso é uma fonte relevante de latência sob uso repetido (ver `11_PERFORMANCE_AUDIT.md`).

## 8. Achados-chave desta fase

1. Nenhuma vulnerabilidade de SQL Injection confirmada — uso consistente de parâmetros e allowlists de coluna é uma boa prática já presente no código.
2. **Ausência total de autenticação** é o maior risco estrutural desta camada — aceitável apenas enquanto a ferramenta permanecer estritamente local/single-user.
3. Risco médio de **path traversal em nomes de arquivo de export** e de **CSV formula injection** em campos de texto livre — ambos corrigíveis com pouco esforço (Stage 0 do roadmap).
4. Falta de validação de schema formal e de rate limiting são dívidas técnicas que devem ser resolvidas antes de qualquer exposição multiusuário.
