# Leonidas Tech - LeoTechScan / Sentinel-1 V2

Dashboard local de inteligencia telecom para consolidacao de bases Excel em SQLite, leitura operacional em Next.js e visualizacao geografica com Leaflet.

## Sprint 2A - Mission Control + Dashboard Executivo

Implementado nesta sprint:

- Nova tela inicial `Mission Control`.
- KPIs executivos: sites, operadoras, municipios, UFs, registros, ultima importacao, status do banco, status das APIs, alertas e LTS medio.
- Dashboard executivo com comparativo TIM x VIVO, participacao por operadora, distribuicao por UF, rankings e exportacoes.
- Configuracao central em `APP/config/sentinel_rules.json`.
- Leonidas Telecom Score (LTS) por municipio.
- Territorial Coverage Index (TCI).
- Opportunity Potential Index (OPI).
- Sentinel Risk Index (SRI).
- ORI preservado a partir da camada V1.3.
- API `GET /api/mission-control`.
- API `GET /api/sites/[id]/intelligence`.
- Site Intelligence expandido com LTS, ORI, TCI, OPI, SRI, timeline, exportacao CSV/PDF e sites proximos.
- Exportacao PDF local sem servicos externos.
- Exportacao CSV para Mission Control e Site Intelligence.

Escopo intencionalmente nao implementado nesta sprint:

- Telecom AI.
- Rollout Intelligence.

## Sprint 2B - Telecom AI + Rollout Intelligence + Alert Center + Market Intelligence

Implementado nesta sprint:

- Aba `Telecom AI` com chat local baseado em regras sobre SQLite.
- Engine isolada em `services/telecom-ai-engine.ts`, preparada para futura integracao com LLM.
- Aba `Rollout Intelligence` com novos sites estimados, equipes, MOS, instalacoes e prioridade.
- Aba `Alert Center` com alertas de municipios sem 5G, baixa densidade, operadora unica, municipios criticos, prioritarios e sites sem coordenadas.
- Aba `Market Intelligence` com participacao de mercado, ranking de operadoras, presenca por UF e distribuicao tecnologica.
- Aba `Oportunidades` com Top 100 municipios prioritarios.
- Recomendacoes locais no Site Intelligence via `GET /api/site-recommendation`.
- Exportacoes CSV:
  - `telecom_ai_report.csv`
  - `rollout_intelligence.csv`
  - `market_intelligence.csv`
  - `alert_center.csv`
  - `municipios_prioritarios.csv`

### APIs Sprint 2B

- `GET /api/telecom-ai?q=...`
- `GET /api/rollout`
- `GET /api/alerts`
- `GET /api/market`
- `GET /api/opportunities`
- `GET /api/site-recommendation?id=...`

### Calculos Sprint 2B

- Telecom AI interpreta perguntas por regras locais e executa consultas SQLite.
- Rollout usa OPI, LTS, TCI e quantidade atual de sites para estimar novos sites, equipes, MOS e instalacoes.
- Alert Center combina SRI, ausencia de 5G, baixa densidade, operadora unica e dados incompletos.
- Market Intelligence agrega participacao por operadora, UF, municipio e tecnologia.

## Sprint 3 Enterprise - Fase 1

Implementado em modo local, preservando os dados importados e sem alterar planilhas Excel.

- Aba `Qualidade Cadastral` para sites sem coordenadas, endereco, municipio, UF, tecnologia, coordenadas invalidas e inconsistencias.
- Aba `Duplicidades` com deteccao sugestiva por mesma sigla, mesma coordenada, coordenadas proximas e mesmo endereco.
- Aba `Timeline Nacional` com ultima importacao, totais TIM/VIVO, municipios monitorados e eventos de importacao.
- Site Intelligence expandido como workspace operacional com historico, alertas/recomendacoes, sites proximos, exportacao CSV/PDF e observacoes locais em SQLite.

### APIs Sprint 3

- `GET /api/data-quality`
- `GET /api/duplicates`
- `GET /api/national-timeline`
- `GET /api/sites/[id]/notes`
- `POST /api/sites/[id]/notes`

### Exportacoes Sprint 3

- `qualidade_cadastral.csv`
- `possiveis_duplicidades.csv`
- `timeline_nacional.csv`

### Observacoes Operacionais

As observacoes do Site Workspace sao gravadas na tabela local `site_notes`. A tabela principal `sites` permanece preservada, sem exclusao automatica e sem alteracao dos arquivos Excel de origem.

## Sprint 4 - Sentinel-1 Enterprise V3

Sprint focada em apoio a decisao, simulacao e leitura executiva local.

- Aba `Digital Twin` com site tratado como ativo inteligente: dados, scores, alertas, notas, timeline, sites proximos, municipios vizinhos, risco, oportunidade e recomendacao estrategica.
- Aba `Strategic Planning` com simulacao de meta de novos sites por operadora, UF, tecnologia e horizonte.
- Aba `Scenario Planner` com comparativo antes/depois para LTS, TCI, OPI e market share.
- Aba `Advanced GIS` com raio configuravel, proximidade, clusters e camadas por tecnologia, LTS, OPI, SRI, alertas e oportunidades.
- Aba `Executive Reports` com relatorios locais em CSV/PDF.
- Aba `Executive Workspace` com KPIs nacionais, alertas, oportunidades, comparativo TIM x VIVO e timeline.

### APIs Sprint 4

- `GET /api/digital-twin/site?id=...`
- `POST /api/strategic-planning`
- `POST /api/scenario-planner`
- `GET /api/geointelligence?siteId=...&radiusKm=...`
- `GET /api/executive-reports?type=...&format=csv|pdf`
- `GET /api/executive-workspace`

### Exportacoes Sprint 4

Salvas em `C:\LEOTECHSCAN\EXPORTACOES`:

- `digital_twin_sites.csv`
- `strategic_planning.csv`
- `scenario_planner.csv`
- `advanced_geointelligence.csv`
- `executive_report_summary.csv`

As simulacoes e recomendacoes sao estimativas baseadas nos dados disponiveis no SQLite local.

## Sprint Copernicus 1 - Satellite Intelligence

Fundacao Copernicus/Sentinel-1 para validacao territorial em modo `metadata_only`.

- Configuracao oficial em `config/copernicus_rules.json`.
- Engine isolado em `services/copernicus-engine.ts`.
- Tabelas auxiliares `copernicus_scenes` e `site_satellite_validation`.
- Aba `Satellite Intelligence`.
- Secao `Copernicus / Sentinel-1 Validation` no Site Intelligence e no Digital Twin.
- Relatorio executivo `Copernicus Site Validation Report`.

### APIs Copernicus

- `GET /api/copernicus/status`
- `GET /api/copernicus/site?id=...`
- `GET /api/copernicus/search?siteId=...&radiusKm=...&lookbackDays=...`
- `GET /api/copernicus/validation?id=...`

### Exportacoes Copernicus

Salvas em `C:\LEOTECHSCAN\EXPORTACOES`:

- `copernicus_site_validation.csv`
- `copernicus_satellite_evidence.csv`

### Governanca Copernicus

Esta fase nao baixa imagens SAR grandes, nao promete deteccao automatica de torre e nao substitui vistoria de campo. A evidencia Sentinel-1 deve ser combinada com base TIM/VIVO, coordenadas, mapas e dados operacionais.

## Sprint 5 - Data Trust & Validation Engine

Camada de confianca, validacao e evidencias tecnicas auditaveis.

- `Data Trust Engine` com Trust Score 0-100, nivel e badge.
- `Confidence Engine` por dimensao: coordenada, endereco, municipio, operadora, tecnologia, satelite, cadastro e operacional.
- `Satellite Validation Engine` integrado as tabelas Copernicus metadata-only.
- `Telecom Evidence Center` com dossie tecnico por site.
- `Audit Trail` para validacoes, dossies, exportacoes e consultas.
- `Validation History` por site.
- Aba `Data Trust`.
- Trust Score no Site Intelligence e Digital Twin.

### APIs Sprint 5

- `GET /api/data-trust`
- `GET /api/data-trust/site?id=...`
- `POST /api/data-trust/recalculate`
- `GET /api/evidence-center/site?id=...`
- `GET /api/evidence-center/export?id=...&format=csv|pdf`
- `GET /api/validation-history/site?id=...`
- `GET /api/audit-trail`

### Tabelas Sprint 5

- `site_trust_scores`
- `site_validation_history`
- `site_evidence_center`
- `audit_trail`

### Exportacoes Sprint 5

Salvas em `C:\LEOTECHSCAN\EXPORTACOES`:

- `data_trust_scores.csv`
- `site_validation_history.csv`
- `telecom_evidence_center.csv`
- `audit_trail.csv`
- `site_technical_dossier.pdf`

O Trust Score e uma estimativa tecnica e nao substitui vistoria de campo, engenharia, operacao ou validacao presencial.

## Sprint 6 - Sentinel Core + Sentinel Intelligence Graph

Fundacao do Sentinel Core e do Sentinel Intelligence Graph (SIG), a camada central de conhecimento do LeoTechScan.

- Pasta isolada `sentinel-core/`.
- Modelo de nos e relacoes em SQLite auxiliar.
- Build incremental/sample do grafo.
- Inference Engine inicial.
- Recommendation Engine inicial.
- Knowledge Summary para site, municipio e operadora.
- Aba `Sentinel Core`.
- Card SIG no Mission Control.

### Tabelas SIG

- `sig_nodes`
- `sig_edges`
- `sig_snapshots`
- `sig_insights`

### APIs Sentinel Core

- `GET /api/sentinel-core/status`
- `POST /api/sentinel-core/build`
- `GET /api/sentinel-core/site?id=...`
- `GET /api/sentinel-core/municipality?municipio=...&uf=...`
- `GET /api/sentinel-core/operator?operadora=...`
- `GET /api/sentinel-core/recommendations?scope=...`
- `GET /api/sentinel-core/insights?scope=...`
- `GET /api/sentinel-core/search?q=...`

### Exportacoes SIG

Salvas em `C:\LEOTECHSCAN\EXPORTACOES`:

- `sentinel_graph_nodes.csv`
- `sentinel_graph_edges.csv`
- `sentinel_graph_insights.csv`
- `sentinel_graph_recommendations.csv`

O build inicial do SIG usa modo sample configuravel para nao travar a aplicacao com 299k registros.

## Sprint 7 - Enterprise UX/UI Revolution

Reformulacao visual Enterprise Dark para o conceito:

`LEONIDAS TECH / Sentinel-1 Enterprise / Telecom Intelligence Center`

### Design System

- Tema Enterprise Dark em `app/enterprise-theme.css`.
- Sidebar lateral fixa.
- Header tecnico fixo.
- Footer de status do sistema.
- Cards com glassmorphism discreto.
- Destaques ciano/azul.
- Estados criticos em vermelho, atencao em amarelo e positivos em verde.
- Painel lateral Site Intelligence em estilo ficha tecnica premium.

### Telas Reformuladas

- Mission Control como centro de comando.
- Mapa com maior destaque visual.
- Site Intelligence como painel lateral Enterprise.
- Sentinel Core com visual de cerebro SIG.
- Telecom AI com wrapper Enterprise.
- Data Trust com visual de confianca e evidencias.
- Copernicus/Satellite Intelligence com governanca visual.
- Strategic Planning e Scenario Planner com simulador executivo.
- Executive Reports como central de relatorios.

Esta sprint nao adiciona backend novo e nao altera SQLite/Excel.

## Sprint 1 - Sentinel-1 V2

Implementado nesta sprint:

- Arquitetura modular inicial em `core`, `database`, `importers`, `operator-engine`, `services`, `api`, `utils`, `exports` e `logs`.
- Importador multioperadora V1 para TIM e VIVO.
- Estrutura preparada para CLARO e ALGAR.
- SQLite consolidado com tabela principal `sites`.
- Busca por site, municipio, UF, operadora e endereco.
- Painel inicial Site Intelligence com dados do site, Google Maps e botoes de copia.
- Exportacoes iniciais:
  - `C:\LEOTECHSCAN\EXPORTACOES\auditoria_importacao.csv`
  - `C:\LEOTECHSCAN\EXPORTACOES\sites_consolidados.csv`
  - `C:\LEOTECHSCAN\EXPORTACOES\sites_por_operadora.csv`
- Auditoria de integridade dos Excel por hash antes/depois da importacao.
- Fallback somente leitura quando `C:\LEOTECHSCAN\BASE` estiver vazia.

## Regra oficial das bases

Local padrao:

```powershell
C:\LEOTECHSCAN\BASE
```

O importador procura primeiro arquivos `.xlsx` nesse diretorio e ignora temporarios do Excel iniciados por `~$`.

Se `BASE` estiver vazia, usa fallback somente leitura para:

```powershell
C:\LEOTECHSCAN\BASE SPAZIO COM IBGE_n.xlsx
C:\LEOTECHSCAN\VIVO SITES.xlsx
```

O fallback fica registrado em:

```powershell
C:\LEOTECHSCAN\LOGS\importacao_sentinel_v2.log
```

Os arquivos Excel nunca sao modificados, movidos, renomeados ou salvos pelo sistema.

## SQLite consolidado

Banco:

```powershell
C:\LEOTECHSCAN\DATABASE\leotechscan.db
```

Tabela principal:

- `id`
- `site`
- `operadora_origem`
- `municipio`
- `uf`
- `regional`
- `latitude`
- `longitude`
- `endereco`
- `status`
- `projeto`
- `tecnologia`
- `tipo_site`
- `data_importacao`
- `arquivo_origem`

Colunas legadas da V1.3 tambem sao preservadas para nao quebrar Executive Risk View, Operator Intelligence, mapa, ranking e exportacoes existentes.

## Como executar

```powershell
cd C:\LEOTECHSCAN\APP
npm run dev
```

Acesse:

```text
http://localhost:3000
```

Para producao local:

```powershell
cd C:\LEOTECHSCAN\APP
npm run build
npm start
```

## Como importar bases

Com Python disponivel no Windows:

```powershell
cd C:\LEOTECHSCAN\APP
python scripts\import_excel.py
```

Parametros opcionais:

```powershell
python scripts\import_excel.py --base-dir "C:\LEOTECHSCAN\BASE" --database "C:\LEOTECHSCAN\DATABASE\leotechscan.db" --log "C:\LEOTECHSCAN\LOGS\importacao_sentinel_v2.log" --export-dir "C:\LEOTECHSCAN\EXPORTACOES"
```

Tambem e possivel informar fontes explicitas:

```powershell
python scripts\import_excel.py --source "C:\LEOTECHSCAN\BASE SPAZIO COM IBGE_n.xlsx" --source "C:\LEOTECHSCAN\VIVO SITES.xlsx"
```

## Estrutura do projeto

- `app/` - rotas Next.js e estilos.
- `components/` - dashboard, mapa, paineis e visoes.
- `core/` - contrato interno de site consolidado.
- `database/` - constantes de schema do SQLite.
- `importers/` - importador multioperadora V2.
- `operator-engine/` - documentacao e reserva do motor de operadoras.
- `services/` - normalizacao de linhas de site para a API.
- `api/` - seletores e contratos auxiliares de API.
- `utils/` - utilitarios compartilhados.
- `exports/` - documentacao das exportacoes da sprint.
- `logs/` - documentacao dos logs da sprint.
- `config/` - regras de operadora da V1.3 preservadas.
- `scripts/` - wrappers operacionais.

## Validacao da Sprint 1

Ambiente validado em 27/06/2026:

- `npm install`: nao necessario; dependencias existentes e sem alteracao no `package.json`.
- Importacao V2 executada com fallback.
- SQLite populado com `299.308` registros.
- TIM: `298.341` registros e `281.310` sites unicos.
- VIVO: `967` registros e `904` sites unicos.
- `auditoria_importacao.csv` gerado.
- `sites_consolidados.csv` gerado.
- `sites_por_operadora.csv` gerado.
- Hash antes/depois igual para `BASE SPAZIO COM IBGE_n.xlsx`.
- Hash antes/depois igual para `VIVO SITES.xlsx`.
- `npm run build`: aprovado.

## Pendencias

- Validar visualmente em navegador todos os fluxos de painel e copia em ambiente do usuario.
- Instalar ou configurar Python no Windows, se o comando `python` nao estiver disponivel fora do runtime do Codex.
- Expandir regras nativas para CLARO e ALGAR quando as bases forem entregues.
- Avaliar deduplicacao entre operadoras quando houver site compartilhado.

## Proxima sprint sugerida

- API dedicada para detalhe de site por `id`.
- Historico de importacoes com comparativo entre execucoes.
- Deduplicacao geografica por coordenada e municipio.
- Regras configuraveis do Multi Operator Engine fora do codigo Python.
- Painel avancado por operadora com divergencias, cobertura e qualidade cadastral.
