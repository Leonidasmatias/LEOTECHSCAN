# 06 — Geoespacial e Mapas

## Biblioteca de mapas e coordenadas

- **Biblioteca cliente:** `leaflet` `^1.9.4` + `react-leaflet` `^5.0.0` (`package.json`). `components/MapView.tsx` (1,4KB) é o componente de mapa; não lido linha a linha nesta auditoria.
- **Sistema de coordenadas:** WGS84 implícito (latitude/longitude decimais, sem projeção declarada) — coerente com o uso de Leaflet e Haversine puro, sem qualquer biblioteca de projeção cartográfica.
- **Nenhuma dependência externa de tiles/mapa-base** foi encontrada no `package.json` (Leaflet tipicamente consome tiles via URL, ex. OpenStreetMap, configurado em runtime no componente — não confirmado nesta auditoria por não ter lido `MapView.tsx` linha a linha). **NÃO FOI POSSÍVEL CONFIRMAR** a fonte cartográfica exata (OSM, Mapbox, outro) nem se há dependência de internet em runtime para renderizar os tiles.

## Distância, curvatura terrestre e precisão

Status: **CONFIRMADO NO CÓDIGO** (arquivo `services/geospatial/spatial-query-utils.ts` lido integralmente).

- A distância usa **Haversine real**, com raio da Terra `EARTH_RADIUS_KM = 6371` km — portanto **considera a curvatura terrestre** corretamente (não é distância planar/euclidiana). Fórmula: `2 * atan2(sqrt(a), sqrt(1-a)) * R`, com `a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)`.
- **Unidade:** quilômetros, com arredondamento a 3 casas decimais no resultado exposto (`toFixed(3)`).
- **Aproximação usada para bounding box a partir de um raio** (`radiusToBoundingBox`): `radiusKm / 111` graus — uma aproximação grosseira (111km ≈ 1 grau no equador), **documentada explicitamente no código** como reutilização deliberada da mesma aproximação já usada em `services/enterprise-v3-engine.ts`, para não ter duas fontes de verdade divergentes. Isso significa que bounding boxes ficam ligeiramente maiores que o círculo real fora do equador (mais grosseiro perto dos polos) — comportamento aceito e documentado, não corrigido por projeção.
- **Tratamento de coordenadas inválidas:** `services/geospatial/coordinate-quality-engine.ts` classifica exaustivamente: ausente, fora de -90/90 (latitude) ou -180/180 (longitude), par idêntico lat=lon (suspeita de erro de digitação), zero exato (0,0), fora do retângulo delimitador do Brasil, ou suspeita de troca lat/lon (quando trocar os dois cairia dentro do Brasil). Todas as classificações têm razão textual associada (`reasons`).
- **Tratamento de coordenadas duplicadas:** duas camadas — `services/duplicates-engine.ts` (mais antigo, consulta direta ao banco) e o novo `coordinate-quality-engine.ts`, que recebe flags `isDuplicateExact`/`isDuplicateDense` já calculadas por fora (deliberadamente não reimplementa a detecção, para não haver duas lógicas divergentes — documentado no comentário do arquivo).
- **Tratamento de sites sem coordenadas:** classificados como status `missing`, não elegíveis para mapeamento nem para busca de satélite (`eligibleForMapping: false`, `eligibleForSentinel: false`).
- **Delimitação do Brasil:** `services/geospatial/brazil-bounds.ts` (não lido linha a linha nesta passagem, mas referenciado e usado por `coordinate-quality-engine.ts` via `classifyBrazilBounds`/`suspectedLatLonSwap`) — usa um retângulo delimitador (bounding box), não um polígono real do território (uma simplificação aceitável para triagem, mas que pode classificar como "dentro do Brasil" pontos em países vizinhos que caem dentro do retângulo).

## Bounding boxes, clusters e agregações

- **Validação de bounding box** (`validateBoundingBox`): verifica que os 4 valores são números finitos, que estão nos intervalos válidos de lat/lon, e que `north > south` e `east > west`. **Bounding boxes cruzando o antimeridiano (west > east) são explicitamente rejeitados como não suportados** — documentado no código como limitação conhecida e aceitável (irrelevante para o Brasil).
- **Clustering:** grade fixa determinística (`services/geospatial/national-grid.ts`), não geohash nem H3 — decisão documentada explicitamente: implementar geohash/H3 exigiria uma nova dependência npm, e a sessão que escreveu esse código não podia instalar/verificar pacotes novos (mesma limitação de ambiente que esta auditoria também enfrenta, ver `01_ENVIRONMENT_AND_REPOSITORY.md`). A grade tem 4 resoluções (~111km, ~11km, ~1.1km, ~111m) e cada ponto recebe um id de célula legível (`g2:-1580:-4789`), fácil de depurar manualmente.
- **Agregação em clusters:** `aggregateIntoGridClusters` é determinística e independente da ordem de entrada (soma incremental por célula, centro = média das coordenadas na célula) — confirmado por comentário no código referenciando um teste dedicado com entrada embaralhada.

## Performance, limites e risco de travamento

Status: **CONFIRMADO NO CÓDIGO** para os limites; **NÃO FOI POSSÍVEL CONFIRMAR** medição de carga real nesta auditoria (nenhum teste de carga foi executado, por instrução explícita da missão de não realizar testes agressivos).

- **Nenhuma rota geoespacial permite retorno ilimitado.** Todos os limites são clampados: `DEFAULT_BBOX_LIMIT=2000`/`MAX_BBOX_LIMIT=5000` para viewport; `DEFAULT_RADIUS_LIMIT=500`/`MAX_RADIUS_LIMIT=2000` para raio; `DEFAULT_NEAREST_LIMIT=20`/`MAX_NEAREST_LIMIT=200` para "sites próximos"; clusters usam uma amostra maior (`MAX_CLUSTER_CANDIDATES=50000`, porque só precisam de lat/lon, não da linha inteira).
- **Prefiltragem por índice espacial:** consultas de bounding box primeiro perguntam ao R-Tree (`site_spatial_index`) quais ids têm bounding box sobreposto, e só então buscam as linhas completas desses ids — evitando varredura sequencial da tabela `sites` inteira (299.308 linhas) na maioria dos casos. Existe fallback para busca direta em `sites` por `latitude BETWEEN ... AND longitude BETWEEN ...` caso o R-Tree não exista, mas isso não usa o índice composto (`idx_filters` não inclui lat/lon), então o fallback seria mais lento — **hoje é um risco latente, não ativo**, pois o R-Tree está de fato populado para as 299.308 linhas (confirmado por `SELECT COUNT(*) FROM site_spatial_index` = 299.308).
- **Chunking de SQL `IN (...)`:** `chunkArray` limita cada lote de ids a 900 (constante `MAX_SQL_IN_CLAUSE_SIZE`), deliberadamente abaixo do limite histórico mais restritivo do SQLite (999 antes da versão 3.32.0), mesmo tendo confirmado empiricamente 32.766 como teto real deste build — decisão documentada como proteção contra builds mais antigos de SQLite em outros ambientes.
- **Busca por "sites próximos" (nearest):** usa raio expansível (10, 30, 75, 150, até `maxRadiusKm` default 200km), parando assim que encontra candidatos suficientes — evita sempre varrer o raio máximo.
- **Renderização de milhares de pontos no navegador:** o dashboard já limita a amostra de pontos do mapa a 4.000 (`LIMIT 4000` em `app/api/dashboard/route.ts`, com uma ordenação pseudo-aleatória via `(id * 1103515245 + 12345) % 2147483647` para não sempre mostrar os mesmos IDs baixos) — mitigação explícita contra travamento do navegador ao tentar desenhar 299.308 marcadores de uma vez. **Não foi possível confirmar nesta auditoria** se o componente `MapView.tsx` faz alguma forma adicional de clusterização visual (Leaflet.markercluster ou similar) — biblioteca não aparece no `package.json`, o que sugere que não.
- **Limite real medido:** nenhum, por decisão de escopo (a missão veda testes de carga agressivos). O que existe é o desenho estrutural dos limites acima, não uma medição empírica de latência sob carga.

## APIs geoespaciais e seus contratos (confirmados no código, ainda não commitados no Git)

| Rota | Função delegada | Limite | Validação |
|---|---|---|---|
| `GET /api/geospatial/viewport` | `getSitesInBoundingBox` | 2000 (max 5000) | `parseBoundingBox`, `parseOptionalPositiveInt` — retorna 400 com razões se inválido |
| `GET /api/geospatial/radius` | `getSitesWithinRadius` | 500 (max 2000) | Idem padrão de validação |
| `GET /api/geospatial/nearest` | `getNearestSites` | 20 (max 200) | Idem |
| `GET /api/geospatial/clusters` | `getClustersInBoundingBox` | amostra até 50.000 pontos (lat/lon apenas) | Idem |
| `GET /api/geospatial/summary` | `getCoordinateQualitySummary` / `getGridSummary` | 500 (max 2000) para grade | Consulta `site_geospatial_status`, hoje vazia — **retornaria resultado vazio em produção** |

Todas as cinco rotas acima são **arquivos reais e completos no disco**, mas **não commitadas no Git** (`git status` as lista como `??`) e **as tabelas de que dependem para status geoespacial estão vazias em produção** — ou seja, o contrato de API está pronto e testável isoladamente, mas o dado que ele serviria ainda não existe na base real. Classificação: **CONFIRMADO NO CÓDIGO, NÃO CONFIRMADO EM EXECUÇÃO CONTRA DADOS REAIS**.
