# 10 — Security Audit

## Sumário de classificação

| Severidade | Quantidade |
|---|---|
| Crítica | 0 |
| Alta | 1 |
| Média | 4 |
| Baixa | 3 |
| Informativa | 3 |

## Achados

### ALTA — Ausência total de autenticação e autorização

Nenhum dos 43 endpoints de API exige autenticação. Não há sessão, JWT, API key, cookie de autenticação ou controle de acesso baseado em papel em nenhum lugar do código (`APP` inteiro pesquisado por `auth`, `middleware`, `session` — zero resultados além de manifests internos gerados pelo Next.js). Isso inclui endpoints que:
- Exportam a base completa de sites (`/api/export?type=ranking`).
- Recalculam scores em lote (`POST /api/data-trust/recalculate`).
- Reconstroem o grafo de conhecimento (`POST /api/sentinel-core/build`).
- Gravam observações arbitrárias no banco (`POST /api/sites/[id]/notes`).

**Risco real:** enquanto a aplicação rodar exclusivamente via `npm run dev`/`npm start` vinculada a `localhost`, o risco prático é baixo (superfície de ataque limitada à própria máquina). **O risco se torna crítico no momento em que a aplicação for exposta em uma rede compartilhada, VPN corporativa ou internet** sem uma camada de proxy/autenticação na frente. Recomenda-se tratar isso como bloqueador antes de qualquer exposição além de `localhost` (Roadmap Stage 0).

### MÉDIA — CSV/Excel Formula Injection (CWE-1236)

`utils/csv.ts` e o gerador Python (`write_csv`) escapam corretamente aspas duplas e quebras de linha, mas não neutralizam células cujo conteúdo comece com `=`, `+`, `-` ou `@` — caracteres que o Excel/LibreOffice interpretam como início de fórmula ao abrir o arquivo. O campo mais exposto é `site_notes.note` (texto livre digitado pelo operador via UI, exportado em `telecom_evidence_center.csv` e outros). **Mitigação recomendada:** prefixar com um apóstrofo (`'`) qualquer célula cujo primeiro caractere esteja em `=+-@` antes de serializar para CSV, em `utils/csv.ts` e no script Python equivalente.

### MÉDIA — Path traversal potencial em nomes de arquivo de exportação

Em `app/api/export/route.ts`, os branches `site-csv`/`site-pdf` (e outros) constroem o nome do arquivo de saída interpolando `site.site` — um valor de texto vindo da planilha Excel importada — diretamente em `path.join(exportDir, `site-${site.site}-${stamp()}.csv`)`, sem sanitização de caracteres de caminho (`..`, `/`, `\`). Hoje o dado vem de uma fonte semi-confiável (planilha do operador de telecom), mas nenhuma validação impede que um valor futuro contenha esses caracteres. **Mitigação recomendada:** normalizar/sanitizar `site.site` (remover ou substituir caracteres fora de `[A-Za-z0-9_-]`) antes de usá-lo em qualquer nome de arquivo.

### MÉDIA — Ausência completa de rate limiting

Nenhum endpoint impõe limite de requisições. Endpoints custosos (`/api/export`, `/api/sentinel-core/build`, `/api/data-trust/recalculate`) podem ser chamados repetidamente sem controle, criando risco de negação de serviço (esgotamento de I/O de disco e CPU) mesmo por um único cliente mal-intencionado ou um script cliente com bug (loop de retry sem backoff).

### MÉDIA — Nenhum cabeçalho de segurança HTTP configurado

`next.config.ts` (148 bytes) não define `headers()` customizados. Nenhum `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` ou `Strict-Transport-Security` foi encontrado. Baixo risco imediato dado o uso local, mas deve ser corrigido antes de qualquer exposição em rede.

### BAIXA — Dependências não auditadas nesta sessão

Não foi possível rodar `npm audit`/verificação de CVE de dependências dentro do escopo desta auditoria (ambiente de auditoria não replicou o `node_modules` do Windows de forma auditável sem potencialmente alterar lockfiles). Recomenda-se rodar `npm audit --production` (ou `pnpm audit`, dependendo de qual lockfile for adotado como fonte da verdade — ver achado da Phase A) como parte do Stage 0.

### BAIXA — Dois lockfiles conflitantes

`package-lock.json` e `pnpm-lock.yaml` coexistem — não é uma vulnerabilidade por si só, mas cria risco de builds não reprodutíveis / dependências divergentes entre ambientes de desenvolvimento, o que indiretamente dificulta auditoria de segurança de dependências (não fica claro qual árvore de dependência resolvida é a "real").

### BAIXA — WAL do SQLite não checkpointado (55 MB pendente)

Não é uma vulnerabilidade de segurança per se, mas overhead de arquivo `-wal` não checkpointado pode acumular indefinidamente sob uso contínuo sem reinício do processo; recomenda-se `PRAGMA wal_checkpoint` periódico ou `PRAGMA journal_mode` revisado como parte da rotina operacional (Stage 0).

### INFORMATIVA — Sem child_process / execução de comando

Nenhum uso de `child_process`, `execSync`, ou `spawn` foi encontrado no runtime Next.js — os scripts Python são executados manualmente pelo operador via linha de comando, nunca invocados automaticamente pela aplicação web. Isso elimina uma classe inteira de risco de injeção de comando no runtime da aplicação.

### INFORMATIVA — Nenhuma credencial ou segredo exposto

Nenhum arquivo `.env`, chave de API, token ou string de conexão hardcoded foi encontrado em nenhum arquivo de código-fonte, configuração ou log revisado.

### INFORMATIVA — SQL Injection: não encontrado

Todas as consultas parametrizáveis revisadas (`lib/filters.ts`, `services/*.ts`, rotas de API) usam parâmetros SQL (`?`) para valores de usuário; nomes de coluna são sempre resolvidos por allowlist fixa no código (`FILTER_COLUMNS`), nunca diretamente do input do usuário. Nenhuma vulnerabilidade de SQL Injection foi encontrada nos caminhos revisados.

## Achados-chave desta fase

1. A ausência de autenticação é o risco dominante — mas é proporcional ao escopo atual (ferramenta local). O ponto de decisão é: **antes de qualquer exposição em rede compartilhada, autenticação básica (mesmo que simples, ex.: Basic Auth por proxy reverso) é obrigatória.**
2. Os dois achados de injeção (CSV formula e path traversal em nome de arquivo) são de baixo esforço de correção e devem entrar no Stage 0 (Stabilization) do roadmap.
3. Boas práticas já presentes (parametrização SQL consistente, ausência de `child_process`, ausência de segredos hardcoded) reduzem a superfície de risco geral do projeto de forma significativa — a base de código não é insegura por negligência generalizada, é insegura especificamente por ausência de controle de acesso, que é a lacuna estrutural mais importante a fechar.
