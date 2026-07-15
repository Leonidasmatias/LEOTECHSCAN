# 17 — Decision Log

Registro das decisões arquiteturais recomendadas por esta auditoria, com a justificativa baseada em evidência que fundamenta cada uma. Nenhuma destas decisões foi implementada — este documento é a base para decisão do time antes do início do Stage 0.

## D1 — Banco de dados: permanecer em SQLite, adicionar RTree

**Decisão recomendada:** manter SQLite como motor de banco principal; adicionar índice `RTree` nativo sobre coordenadas.
**Não recomendado agora:** SpatiaLite, DuckDB spatial, PostgreSQL/PostGIS.
**Justificativa:** volume atual (299.308 linhas, 161 MB) está confortavelmente dentro da capacidade do SQLite. A aplicação é local/single-process hoje (`node:sqlite`). RTree resolve o principal gargalo identificado (Phase H/K — ausência de índice espacial) sem introduzir um servidor de banco separado, gestão de conexão de rede, ou custo operacional adicional. PostGIS deve ser reavaliado somente se/quando o produto migrar para multiusuário concorrente com escrita frequente, ou quando processamento espacial avançado (interseção de polígono, geometria complexa) se tornar necessário — nenhum dos dois é o caso hoje.

## D2 — Processamento de satélite: iniciar com Python geospatial stack local, não SNAP/snappy

**Decisão recomendada:** para o Stage 5 (pipeline piloto), priorizar `rasterio`/`rioxarray`/`GDAL`/`pystac-client` sobre ESA SNAP/`snappy`.
**Justificativa (a ser confirmada tecnicamente no início do Stage 3, esta é uma recomendação inicial, não definitiva):** o projeto já usa Python para o importador (via `openpyxl`), então manter o pipeline de satélite em Python mantém consistência de stack. `snappy` (bindings Python do SNAP) tem histórico de instalação frágil e dependência pesada de Java; `rasterio`/`GDAL`/`pystac-client` são mais leves para o caso de uso inicial (metadata-first, conforme Stage 3 exige explicitamente "não iniciar download de cena em escala nacional nesta fase"). SNAP pode ser reavaliado no Stage 5 quando calibração radiométrica e correção de terreno completas forem de fato necessárias — essas operações são o ponto forte do SNAP.
**Ambiente de execução:** dado que a aplicação roda em Windows, avaliar WSL2 para rodar a stack Python geoespacial (GDAL tem instalação mais confiável em Linux) em vez de instalação nativa Windows; Docker é uma alternativa se WSL2 não for viável operacionalmente.

## D3 — Execução de jobs: fila leve em processo antes de Redis

**Decisão recomendada:** implementar uma fila simples (tabela SQLite própria de jobs, ou biblioteca em-processo) para o pipeline de satélite piloto (Stage 5); não introduzir Redis nesta fase.
**Justificativa:** o volume inicial do piloto (50 → 500 → 5.000 sites, conforme Stage 5/12) não justifica a complexidade operacional de um message broker dedicado. Redis deve ser reavaliado apenas se o monitoramento automatizado nacional (Stage 11) demonstrar necessidade real de fila distribuída entre múltiplos workers.

## D4 — Armazenamento de evidência: sistema de arquivos estruturado, não object storage

**Decisão recomendada:** armazenar artefatos de processamento (recortes de cena, rasters intermediários) em pastas estruturadas no sistema de arquivos local (ex.: `EXPORTACOES/satellite-evidence/{site_id}/{data}/`), não em object storage (S3-compatível).
**Justificativa:** a aplicação roda localmente hoje; object storage introduziria dependência de rede/custo de nuvem sem benefício claro no estágio piloto. Reavaliar quando/se o produto migrar para hospedagem em nuvem compartilhada.

## D5 — Autenticação: obrigatória antes de qualquer exposição além de localhost

**Decisão recomendada:** não expor a aplicação em rede compartilhada, VPN corporativa ampla ou internet até uma camada de autenticação (mesmo básica) existir.
**Justificativa:** achado de segurança R2 (Alta severidade) — 43 endpoints sem controle de acesso algum, incluindo exportação completa da base e endpoints de escrita.

## D6 — Gerenciador de pacotes: escolher um, remover o outro lockfile

**Decisão recomendada:** decidir entre npm ou pnpm como gerenciador oficial do projeto e remover o lockfile do outro.
**Justificativa:** achado R12 — ambiguidade atual gera risco de builds não reprodutíveis.

## D7 — Reimportação de base: não substituir schema de aplicação

**Decisão recomendada:** separar, no schema, as tabelas de dados-fonte (recriadas a cada importação) das tabelas de derivados de aplicação (Trust Score, Copernicus, grafo SIG, notas, auditoria — preservadas entre importações), e mudar a estratégia de "substituição atômica total do arquivo `.db`" para "atualização das tabelas de origem preservando as demais".
**Justificativa:** achado R4 — hoje uma reimportação completa apaga todo o trabalho derivado acumulado pela aplicação, o que é surpreendente e arriscado para o operador.

## D8 — Nomenclatura "Sentinel": desambiguar antes de qualquer material externo

**Decisão recomendada:** manter "Sentinel-1" exclusivamente para o satélite real da Copernicus; renomear "Sentinel Core"/"Sentinel Intelligence Graph" e "Sentinel Risk Index" para nomes que não usem a palavra "Sentinel".
**Justificativa:** achado R10 — confusão terminológica real entre três conceitos não relacionados dentro do mesmo produto.
