# 15 — Implementation Backlog

Cada item segue o formato exigido: ID · Título · Objetivo de negócio · Objetivo técnico · Dependências · Riscos · Complexidade · Requisitos de dado · Requisitos de infraestrutura · Requisitos de segurança · Requisitos de teste · Critério de aceite · Estratégia de rollback · Evidência de conclusão · Prioridade · Sprint sugerido · Roda localmente? · Requer internet? · Requer credenciais Copernicus? · Requer armazenamento adicional? · Muda o banco? · Muda a UI atual?

## Backlog — Stage 0 (Stabilization)

### B0.1 — Inicializar repositório Git
- **Objetivo de negócio:** proteger o investimento de engenharia já feito contra perda de histórico.
- **Objetivo técnico:** `git init` em `APP`, commit inicial do estado atual, `.gitignore` já existe e deve ser revisado.
- **Dependências:** nenhuma. **Riscos:** nenhum (operação aditiva). **Complexidade:** Trivial.
- **Dados:** nenhum. **Infra:** nenhuma. **Segurança:** confirmar que `.gitignore` exclui `node_modules`, `.next`, `DATABASE/*.db*`, `EXPORTACOES/*` antes do primeiro commit.
- **Teste:** `git log` mostra 1 commit; `git status` limpo.
- **Aceite:** repositório existe, primeiro commit contém todo o código-fonte atual.
- **Rollback:** deletar `.git` (não destrutivo para o código).
- **Evidência:** `git log --oneline` no PR de revisão.
- **Prioridade:** P0. **Sprint:** 1. **Local:** sim. **Internet:** não. **Credenciais Copernicus:** não. **Armazenamento adicional:** desprezível. **Muda banco:** não. **Muda UI:** não.

### B0.2 — Corrigir lógica de decisão mock/real no Copernicus Engine
- **Objetivo de negócio:** eliminar risco de comunicação incorreta sobre capacidade satelital real (achado R1).
- **Objetivo técnico:** em `services/copernicus-engine.ts`, remover o ramo ternário inoperante (`hasCredentials ? mockScenes(...) : mockScenes(...)`); até que o cliente real exista (Stage 3), forçar sempre o caminho mock com `synthetic: true` explícito e visível em toda resposta de API.
- **Dependências:** nenhuma. **Riscos:** nenhum além de mudança de contrato de resposta de API (campo `mock` já existe, mas seu significado muda de "pode ser falso mesmo sendo sempre mock" para "sempre true até Stage 3").
- **Complexidade:** Trivial (poucas linhas).
- **Dados:** nenhum. **Infra:** nenhuma. **Segurança:** nenhuma nova.
- **Teste:** teste unitário confirmando que a resposta sempre contém `mock: true`/`synthetic: true` independentemente de variável de ambiente, até Stage 3.
- **Aceite:** nenhuma combinação de configuração produz uma resposta que implique dado real.
- **Rollback:** reverter commit.
- **Evidência:** diff do arquivo + teste unitário passando.
- **Prioridade:** P0. **Sprint:** 1. **Local:** sim. **Internet:** não. **Credenciais:** não. **Armazenamento:** não. **Muda banco:** não. **Muda UI:** talvez (rótulo "SIMULADO" mais visível).

### B0.3 — Mitigar CSV Formula Injection
- **Objetivo técnico:** em `utils/csv.ts` e no equivalente Python, prefixar com apóstrofo qualquer célula iniciando com `=+-@`.
- **Complexidade:** Trivial. **Prioridade:** P0. **Sprint:** 1. **Local:** sim. **Demais flags:** não/não/não/não/sim(código)/não(UI).
- **Teste:** teste unitário com string `=cmd|'/c calc'!A1` produzindo célula prefixada.
- **Aceite:** nenhuma célula exportada começa com caractere de fórmula sem neutralização.

### B0.4 — Sanitizar nome de arquivo de exportação
- **Objetivo técnico:** normalizar `site.site` (remover caracteres fora de `[A-Za-z0-9_-]`) antes de uso em `path.join`.
- **Complexidade:** Trivial. **Prioridade:** P0. **Sprint:** 1.

### B0.5 — Resolver ambiguidade de gerenciador de pacotes
- **Objetivo técnico:** escolher npm ou pnpm; remover o lockfile do outro; documentar decisão no README.
- **Complexidade:** Baixa. **Prioridade:** P1. **Sprint:** 1.

### B0.6 — Confirmar build de produção na máquina real
- **Objetivo técnico:** rodar `npm run build` (ou `pnpm build`) diretamente no Windows do usuário e registrar o resultado.
- **Complexidade:** Trivial. **Prioridade:** P0. **Sprint:** 1. **Nota:** esta auditoria não conseguiu confirmar isso de forma independente (ver `12_TEST_QUALITY_AUDIT.md`).

### B0.7 — Endpoint de health check
- **Objetivo técnico:** `GET /api/health` retornando status do banco (`PRAGMA quick_check`), contagem de sites, timestamp da última importação.
- **Complexidade:** Baixa. **Prioridade:** P1. **Sprint:** 1. **Muda banco:** não. **Muda UI:** sim (indicador de status hoje é estático, vira dinâmico).

### B0.8 — Smoke tests de API mínimos
- **Objetivo técnico:** suíte com Playwright/Vitest cobrindo os 43 endpoints com uma requisição de sucesso básica.
- **Complexidade:** Média. **Prioridade:** P1. **Sprint:** 2.

### B0.9 — Separar schema de origem e schema derivado na reimportação
- **Objetivo técnico:** ajustar `multi_operator_import.py` para não recriar tabelas derivadas (`site_trust_scores`, `copernicus_scenes`, etc.) ao substituir `sites`.
- **Complexidade:** Média. **Riscos:** requer teste cuidadoso de que a substituição atômica ainda preserva integridade. **Prioridade:** P0. **Sprint:** 2. **Muda banco:** sim.

## Backlog — Stage 1 (Geospatial Foundation)

### B1.1 — Índice RTree sobre coordenadas
- **Objetivo técnico:** `CREATE VIRTUAL TABLE sites_rtree USING rtree(id, minLat, maxLat, minLon, maxLon)`, populado a partir de `sites`, mantido sincronizado via trigger ou rebuild pós-importação.
- **Complexidade:** Média. **Prioridade:** P0. **Sprint:** 3. **Muda banco:** sim. **Rollback:** `DROP TABLE sites_rtree` (não afeta `sites`).
- **Aceite:** consulta de bounding-box usando RTree retorna resultado idêntico à consulta atual, com tempo de execução mensuravelmente menor (benchmark antes/depois).

### B1.2 — Classificação de elegibilidade geoespacial por site
- **Objetivo técnico:** nova coluna/tabela `site_geospatial_status` com os 7 valores exigidos (elegível, inválida, ausente, fora do limite, duplicada, suspeita, requer revisão).
- **Complexidade:** Média. **Prioridade:** P0. **Sprint:** 3. **Muda banco:** sim (nova tabela).
- **Dados:** usa os achados já quantificados na Phase D (1.320 zeradas, 1.377 fora do Brasil, 48.767 grupos duplicados).

### B1.3 — Clustering de marcador no mapa
- **Objetivo técnico:** adicionar `react-leaflet-cluster` (ou equivalente) a `components/MapView.tsx`.
- **Complexidade:** Baixa. **Prioridade:** P1. **Sprint:** 3. **Muda UI:** sim.

### B1.4 — Debounce de busca
- **Objetivo técnico:** debounce de 300-500ms em `Dashboard.tsx` antes de disparar `fetch`.
- **Complexidade:** Trivial. **Prioridade:** P2. **Sprint:** 2.

## Backlog — Stage 2 (Satellite Asset Registry)

### B2.1 — Novo schema de registro satelital
- **Objetivo técnico:** criar `satellite_providers`, `satellite_collections`, `satellite_scenes`, `site_scene_matches`, `satellite_processing_jobs`, `satellite_processing_artifacts`, `satellite_change_events` (ver ERD abaixo); migrar dados de `copernicus_scenes`/`site_satellite_validation` preservando-os com flag `synthetic=true`.
- **Complexidade:** Alta. **Prioridade:** P1. **Sprint:** 4-5. **Muda banco:** sim (aditivo, não destrutivo).
- **Rollback:** tabelas novas podem ser removidas sem afetar `sites`/dados de origem.

## Backlog — Stage 3 (Copernicus real)

### B3.1 — Cliente HTTP real OData/STAC Copernicus Data Space
- **Objetivo de negócio:** entregar a capacidade que hoje é apenas simulada.
- **Objetivo técnico:** implementar autenticação OAuth2 (token endpoint do Copernicus Data Space Ecosystem), cliente de busca OData com filtro de coleção/data/geometria, cache local de resposta.
- **Dependências:** B2.1 (schema pronto para receber dados reais). **Riscos:** rate limit desconhecido até teste real; requer credenciais que a organização ainda não possui confirmadamente.
- **Complexidade:** Alta. **Requer internet:** sim. **Requer credenciais Copernicus:** sim.
- **Segurança:** token nunca em log; renovação automática; armazenamento seguro de client secret (fora do repositório, via variável de ambiente já preparada).
- **Teste:** teste de integração contra ambiente sandbox/real do Copernicus com um site de coordenada conhecida.
- **Aceite:** busca real retorna cenas com `scene_id` real (não prefixo `MOCK_`), footprint real, sem nenhum download de imagem pesada.
- **Prioridade:** P1. **Sprint:** 6-7. **Muda banco:** não (usa schema de B2.1). **Muda UI:** sim (rótulo muda de "simulado" para "real" quando aplicável).

## ERD Proposal (Stage 2 — não implementado, apenas proposto)

```
sites (existente, 299.308 linhas)
  ├─< site_geospatial_status (1:1, nova — Stage 1)
  ├─< site_scene_matches (1:N, nova — Stage 2)
  │      >─ satellite_scenes (N:1)
  │             >─ satellite_collections (N:1)
  │                    >─ satellite_providers (N:1)
  ├─< satellite_processing_jobs (1:N, nova — Stage 5)
  │      ├─< satellite_processing_artifacts (1:N)
  │      └─< satellite_change_events (1:N)
  │             └─< satellite_evidence (1:N)
  ├─< site_satellite_timeline (1:N, nova — Stage 8, agrega eventos das tabelas acima)
  ├─< site_reviews (1:N, nova — Stage 7)
  │      └─< review_decisions (1:N)
  ├─< site_trust_scores (existente)
  ├─< site_validation_history (existente)
  ├─< site_evidence_center (existente)
  ├─< site_notes (existente)
  └─< audit_trail (existente, referenciado por entity_id)

algorithm_versions (nova — Stage 6, referenciada por satellite_change_events.algorithm_version_id)
processing_profiles (nova — Stage 6, parâmetros nomeados de pipeline)
data_sources (nova — Stage 10, catálogo de fontes multissensor)
```

**Estratégia de migração:** todas as tabelas novas são aditivas (nenhuma tabela existente é removida ou tem coluna removida). `copernicus_scenes` e `site_satellite_validation` são preservadas como estão e passam a ser referenciadas (não substituídas) pelo novo modelo até que uma migração de dados explícita e reversível seja executada — nunca como parte de uma reimportação de Excel (ver B0.9).
