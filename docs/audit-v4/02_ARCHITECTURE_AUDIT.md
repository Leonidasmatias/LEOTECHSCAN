# 02 — Application Architecture Audit

Todas as afirmações abaixo foram validadas lendo o código-fonte real (129 arquivos não gerados de `APP`), não a documentação. Onde a documentação diverge da implementação, isso é assinalado explicitamente aqui e detalhado em `03_DOCUMENTATION_TRACEABILITY.md`.

## 1. Stack confirmada

| Item | Valor confirmado | Evidência |
|---|---|---|
| Framework | Next.js `^15.5.0` | `package.json` |
| Router | **App Router** (`app/`), não Pages Router | `app/layout.tsx`, `app/page.tsx`, `app/api/**/route.ts` |
| React | `^19.1.0` | `package.json` |
| TypeScript | `^5.8.0`, `strict` não confirmado sem `tsconfig.json` completo (ver abaixo) | `tsconfig.json` |
| Gerenciador de pacotes | Ambíguo — `package-lock.json` (npm) e `pnpm-lock.yaml` coexistem | Achado da Phase A |
| Runtime de banco | `node:sqlite` (módulo nativo experimental do Node ≥22.5), classe `DatabaseSync` | `lib/db.ts` |
| Node exigido | ≥22.5 (para `node:sqlite`); ambiente de auditoria tinha Node v22.22.3 | `lib/db.ts` import, teste no ambiente |
| Mapa | `leaflet` + `react-leaflet` `^5.0.0`, sem plugin de clustering | `package.json`, `components/MapView.tsx` |
| Geração de PDF | Gerador próprio artesanal (nenhuma lib de PDF como `pdfkit`/`puppeteer`) | `utils/pdf.ts` |
| CSV | Função própria, sem lib externa | `utils/csv.ts` |
| Importação Excel | Python + `openpyxl`, fora do runtime Next.js | `importers/multi_operator_import.py` |

## 2. Scripts (`package.json`)

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "import": "python scripts/import_excel.py"
}
```

Não existem scripts de `test`, `lint`, `typecheck` ou `format` declarados em `package.json`. `npm run import` delega para um wrapper Python (`scripts/import_excel.py`, 252 bytes) que por sua vez invoca `importers/multi_operator_import.py`.

## 3. Variáveis de ambiente

Nenhum arquivo `.env*` existe no projeto. As únicas leituras de `process.env` encontradas em todo o código são:

- `COPERNICUS_ACCESS_TOKEN` / `COPERNICUS_CLIENT_ID` (`services/copernicus-engine.ts`) — usadas apenas para decidir um rótulo (`mockMode: true/false`); **não alteram o comportamento real da busca de cenas** (ver `09_SENTINEL_COPERNICUS_AUDIT.md`, achado crítico).
- `LEOTECHSCAN_DB` (`lib/db.ts`) — permite apontar para um banco alternativo; se ausente, cai para `DATABASE/leotechscan.db` relativo ao `cwd`.

Não há `NEXTAUTH_SECRET`, chaves de API de terceiros, strings de conexão ou segredos de qualquer tipo configuráveis via ambiente. Nenhuma credencial foi encontrada hardcoded no código.

## 4. Camadas da aplicação (mapa real)

```
UI (app/page.tsx → components/Dashboard.tsx, 20 abas client-side)
   │  fetch() interno para mesma origem
   ▼
API Routes (app/api/**/route.ts — 43 route handlers, Next.js Route Handlers)
   │  chamadas de função direta (sem camada HTTP intermediária)
   ▼
Services / Sentinel-Core (services/*.ts, sentinel-core/**/*.ts — 41 módulos)
   │  SQL parametrizado via node:sqlite
   ▼
lib/db.ts (getDb() somente-leitura / getWritableDb() leitura-escrita)
   │
   ▼
DATABASE/leotechscan.db (SQLite único arquivo)

Importadores (fora do runtime web, executados manualmente via CLI Python)
   BASE*.xlsx / VIVO SITES.xlsx → importers/multi_operator_import.py → leotechscan.db

Exportadores (dentro do runtime web, app/api/export/route.ts)
   leotechscan.db → CSV/PDF → EXPORTACOES/*.csv|*.pdf (grava em disco E devolve como download)

Serviços externos: NENHUM integrado de fato.
   - Copernicus Data Space Ecosystem: apenas URLs de referência em config; nenhuma chamada HTTP real (ver Phase I).
   - OpenStreetMap: único serviço externo genuinamente chamado, via tiles do Leaflet (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) no navegador do usuário.
```

Não existe camada de autenticação, gateway de API, fila de mensagens, cache distribuído (Redis) ou serviço de background job. Todo o processamento é síncrono, dentro do processo único do `next dev`/`next start`.

## 5. Inventário de módulos por classificação de maturidade

| Módulo / Feature | Classificação | Evidência |
|---|---|---|
| Import Excel → SQLite | **Totalmente implementado** | `importers/multi_operator_import.py`, hash SHA-256 antes/depois confirmado no banco |
| Dashboard / Mission Control / Executive Risk View | **Totalmente implementado** | `app/api/dashboard`, `app/api/mission-control`, `components/Dashboard.tsx` |
| Filtros, busca, paginação | **Totalmente implementado** | `lib/filters.ts`, parametrizado, sem risco de injeção |
| Mapa Leaflet (pontos/heatmap) | **Parcialmente implementado** — funciona, mas sem clustering e sem índice espacial; amostragem fixa de 4.000 pontos | `components/MapView.tsx`, `app/api/dashboard/route.ts` |
| Operator Intelligence (ORI/TCI) | **Totalmente implementado** (regra determinística, não ML) | `lib/operator.ts`, `scripts/migrate_operator_v13.py` |
| Telecom AI | **Rule-based prototype** — casamento de palavras-chave em português roteando para SQL fixo; **não é IA/LLM** apesar do nome | `services/telecom-ai-engine.ts` |
| Rollout / Strategic Planning / Scenario Planner | **Rule-based prototype** — fórmulas determinísticas de distribuição proporcional | `services/rollout-engine.ts`, `services/enterprise-v3-engine.ts` |
| Alert Center | **Totalmente implementado** (regras de threshold fixas) | `services/alert-engine.ts` |
| Data Quality / Duplicate Detection | **Totalmente implementado** (heurísticas SQL) | `services/data-quality-engine.ts`, `services/duplicates-engine.ts` |
| National Timeline | **Totalmente implementado**, mas de granularidade limitada (baseado em `import_audit`, só 2 linhas hoje) | `services/national-timeline-engine.ts` |
| Digital Twin | **Rule-based prototype** — agrega scores e sites próximos por bounding-box; não é um "gêmeo digital" com simulação física | `services/enterprise-v3-engine.ts` |
| Data Trust Engine / Confidence Engine | **Rule-based prototype** — soma ponderada de 8 dimensões de completude de dados; não valida veracidade externamente | `services/data-trust-engine.ts`, `services/confidence-engine.ts` |
| Evidence Center / Audit Trail | **Totalmente implementado** como registro estruturado; "evidência" é metadado interno, não prova de campo | `services/evidence-center-engine.ts`, `services/audit-trail.ts` |
| Copernicus / Satellite Intelligence | **Mocked** — 100% dados sintéticos, nenhuma chamada de rede real (ver Phase I) | `services/copernicus-engine.ts`, `config/copernicus_rules.json` |
| Sentinel Core / Sentinel Intelligence Graph (SIG) | **Rule-based prototype** — grafo de nós/arestas construído por JOIN SQL determinístico + 3 regras de inferência fixas | `sentinel-core/graph/*.ts`, `sentinel-core/inference/inference-engine.ts` |
| Inference Engine | **Rule-based prototype** — 3 regras fixas (`LOW_TRUST_SITE`, `MISSING_COPERNICUS`, `OPERATOR_CONCENTRATION`), sem aprendizado | `sentinel-core/inference/inference-engine.ts` |
| Recommendation Engine | **Rule-based prototype** — lista estática + 3 queries SQL | `sentinel-core/recommendation/recommendation-engine.ts` |
| Autenticação / Autorização | **Não encontrado** | Busca completa por `auth`, `middleware`, `session` — nenhum resultado além de manifests internos do Next.js |
| Logging estruturado de aplicação | **Não encontrado** (apenas `console.error`/`console.info` pontuais e o log do importador Python) | grep em todo `APP` |
| Testes automatizados | **Não encontrado** | Nenhum `*.test.*`, `*.spec.*`, `__tests__`, config de Jest/Vitest/Playwright |
| CI/CD | **Não encontrado** | Nenhum `.github/workflows`, nenhum YAML de pipeline |
| Lint / Format | **Não encontrado** | Nenhum `.eslintrc*`, `eslint.config.*` ou `.prettierrc*` |
| Backup e recuperação | **Rule-based/manual** — snapshots `.zip` manuais, sem automação, defasados | Phase A |

## 6. Componentes de servidor vs. cliente

Todos os 12 arquivos em `components/` começam com `"use client"` — a aplicação é **100% client-rendered** para a interface interativa; o único componente server-side é o `app/layout.tsx`/`app/page.tsx` de entrada. Isso é consistente com uma ferramenta de uso interno/local (via `npm run dev` + `localhost:3000`) e não uma aplicação otimizada para SSR/SEO — o que é apropriado para o caso de uso declarado, mas deve ser mantido em mente se houver planos de expor a ferramenta publicamente.

## 7. Achados-chave desta fase

1. A arquitetura é consistente e coerente: uma aplicação Next.js local, single-tenant, sem autenticação, apoiada em SQLite via `node:sqlite`, com camada de serviços bem separada por domínio funcional.
2. **Nenhum recurso de "IA"/"machine learning" é de fato IA/ML.** Todos os módulos com nomes como "Telecom AI", "Sentinel Core", "Inference Engine", "Recommendation Engine" são regras determinísticas e fórmulas ponderadas configuráveis via JSON (`config/*.json`). Isso deve ser comunicado claramente antes de qualquer divulgação comercial do produto.
3. A ausência total de testes, CI/CD, lint e Git é o maior risco estrutural para evolução seguro do produto — qualquer mudança futura não tem rede de segurança automatizada.
4. `tsconfig.json` e `next.config.ts` são minimalistas (563 e 148 bytes respectivamente) — nenhuma configuração customizada de segurança (headers, CSP) ou de build foi encontrada além do padrão gerado pelo `create-next-app`.
