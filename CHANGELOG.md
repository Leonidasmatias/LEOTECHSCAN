# Changelog — Leonidas Tech · LeoTechScan

## LeoTechScan V1.3 — Operator Intelligence — 23/06/2026

**Status:** Implementação e validação local  
**Base:** 298.341 registros  
**Banco:** SQLite derivado; leitura operacional somente leitura

### Adicionado

- Campo `OPERADORA_CLASSIFICADA` com regras externas configuráveis
- Incorporação de `STATION_ID` ao SQLite derivado
- Cards TIM, Vivo, Claro, Oi, Algar e Não Identificados
- Cobertura territorial por operadora
- ORI: 40% GEO SCORE, 20% status, 20% altura e 20% tipo de infraestrutura
- TCI normalizado por população, sites, tecnologias e cobertura territorial
- Aba Operator Intelligence com rankings de volume, cobertura, ORI e TCI
- Modo Heatmap nacional no mapa Leaflet
- Exportações Operator Intelligence, ORI Ranking e TCI Ranking CSV

### Preservado

- Executive Risk View V1.2 e todas as funcionalidades V1/V1.1
- Filtros, mapa por pontos, tabela e exportações CSV anteriores
- Planilha original inalterada
- Abertura do SQLite com `readOnly` e `PRAGMA query_only = ON`

### Escopo

A classificação é heurística, configurável e auditável por `operator_rule`. Sem evidência, o registro é marcado `Não Identificado`. Ainda não há integração externa de satélite.

**Backup anterior à evolução:** `C:\LEOTECHSCAN\BACKUPS\LeoTechScan-V1.2-ANTES-V1.3.zip`

**Backup oficial do marco:** `C:\LEOTECHSCAN\BACKUPS\LeoTechScan-V1.3-OPERATOR-INTELLIGENCE.zip`

## LeoTechScan V1.2 — Executive Risk View — 23/06/2026

**Versão:** LeoTechScan V1.2  
**Data:** 23/06/2026  
**Status:** Validado localmente  
**Subtítulo:** Telecom Infrastructure Intelligence  
**Banco:** SQLite derivado em modo somente leitura

**Recursos do marco:** Risk Overview, Infrastructure Intelligence, Executive Report CSV e layout escuro executivo.  
**Observação:** ainda sem integração externa de satélite.

### Adicionado

- Tela inicial executiva com seis indicadores comerciais
- Risk Overview com distribuição de sites por nível de risco e percentual crítico
- Top 10 estados e municípios por quantidade de sites críticos
- Infrastructure Intelligence com detentores, tipos, altura média e maiores estruturas
- Exportação `Executive Report CSV` com resumo, ranking crítico, territórios críticos e detentores
- Identidade visual escura executiva para demonstração comercial

### Preservado

- Todas as funcionalidades das versões V1 e V1.1
- Filtros combináveis, mapa Leaflet e tabela detalhada
- Rankings GEO SCORE e analíticos
- Exportações de ranking GEO SCORE e sites críticos
- Excel original somente leitura e SQLite com `query_only`

### Escopo

A V1.2 oferece uma visão executiva de risco e infraestrutura. Ainda não existe integração com imagens ou dados externos de satélite.

**Backup anterior à evolução:** `C:\LEOTECHSCAN\BACKUPS\LeoTechScan-V1.1-ANTES-V1.2.zip`

**Backup oficial do marco:** `C:\LEOTECHSCAN\BACKUPS\LeoTechScan-V1.2-EXECUTIVE-RISK-VIEW.zip`

## LeoTechScan V1.1 — Telecom Intelligence Dashboard — 23/06/2026

**Status:** Implementação e validação local  
**Base:** `BASE SPAZIO COM IBGE_n.xlsx`  
**Banco:** SQLite derivado em modo somente leitura

### Adicionado

- Top 20 municípios por quantidade de registros e sites únicos
- Top 20 estados por quantidade de registros e sites únicos
- Distribuições por tecnologia, status, detentor e tipo de infraestrutura
- Ranking das maiores estruturas por `ALTURA_DA_ESTRUTURA`
- Altura média por estado e por detentor de infraestrutura
- Card executivo de sites críticos conforme GEO SCORE
- Exportação CSV do ranking GEO SCORE e dos sites críticos, respeitando filtros ativos
- Persistência local dos CSVs em `C:\LEOTECHSCAN\EXPORTACOES`
- Organização visual em Visão Geral, Inteligência Telecom, Ranking GEO, Mapa e Tabela

### Preservado

- Dashboard e filtros da V1
- Mapa Leaflet e tabela detalhada
- Ranking GEO SCORE
- Planilha Excel original somente leitura
- SQLite aberto com `readOnly` e `PRAGMA query_only = ON`

### Escopo

A V1.1 é uma camada de inteligência analítica telecom local. Ainda não há integração com imagens ou dados externos de satélite.

**Backup anterior à evolução:** `C:\LEOTECHSCAN\BACKUPS\LeoTechScan-V1-ANTES-V1.1.zip`

## LeoTechScan V1 — 23/06/2026

**Status:** Validado localmente  
**Base:** `BASE SPAZIO COM IBGE_n.xlsx`  
**Registros importados:** 298.341  
**Banco derivado:** SQLite

### Funcionalidades validadas

- Dashboard executivo
- Filtros por UF, município, tecnologia, status, detentor e tipo de infra
- Mapa Leaflet
- Tabela detalhada
- Ranking GEO SCORE
- Planilha original somente leitura
- Build de produção aprovado
- Localhost com resposta HTTP 200 OK

### Integridade do marco

Esta versão registra o primeiro marco oficial validado do LeoTechScan. Nenhuma funcionalidade foi alterada durante o registro. O arquivo Excel original permanece como fonte somente leitura e o SQLite é uma base derivada regenerável.

**Backup oficial:** `C:\LEOTECHSCAN\BACKUPS\LeoTechScan-V1-VALIDADO.zip`
