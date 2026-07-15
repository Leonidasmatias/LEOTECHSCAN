# 08 — GIS and Map Performance Audit

## 1. Stack de mapa

- `leaflet` `^1.9.4` + `react-leaflet` `^5.0.0`. Tile provider: **OpenStreetMap padrão** (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), com atribuição correta presente (`&copy; OpenStreetMap contributors`) — conforme exigido pela licença de uso de tiles do OSM.
- **Nenhuma biblioteca de clustering** está instalada (`package.json` não lista `leaflet.markercluster`, `react-leaflet-cluster` ou equivalente). `components/MapView.tsx` renderiza um `<CircleMarker>` individual por ponto recebido via props — sem agrupamento visual em zoom baixo.
- Mitigação atual de volume: o backend já limita o que é enviado ao mapa (não é responsabilidade do componente de mapa) — `/api/dashboard` envia no máximo 4.000 pontos (amostragem via `ORDER BY (id * 1103515245 + 12345) % 2147483647 LIMIT 4000`, um hash pseudo-aleatório determinístico, não um sample real de banco), e `/api/geointelligence` limita a `maxSites` (config, default 500, teto 500 mesmo se `radiusKm` for aumentado).

## 2. Filtragem espacial no servidor

Todas as consultas geográficas (`digitalTwinSite.nearby`, `geointelligence`, o cálculo de `pointWhere` em `/api/dashboard`) usam **bounding-box simples** (`WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`), convertendo raio em km para graus com a aproximação `radius / 111` (111 km ≈ 1 grau de latitude no equador). Isso é:

- **Impreciso em latitude alta**: a conversão não compensa a contração de longitude em graus conforme a latitude aumenta (deveria dividir por `cos(latitude)` para o componente de longitude) — no Brasil (latitudes até -33°), o erro é moderado mas não desprezível para raios pequenos perto do sul do país.
- **Sem índice espacial dedicado**: como confirmado na Phase D, não existe `RTree` nem qualquer índice sobre `(latitude, longitude)`. Toda consulta de bounding-box faz varredura das linhas que satisfazem outros filtros (`idx_filters`/`idx_score`, quando aplicável) e então filtra por coordenada sem suporte de índice — em uma tabela de quase 300 mil linhas, isso é uma varredura substancial por requisição.

## 3. Distância (Haversine)

`distanceKm()` em `services/enterprise-v3-engine.ts` implementa a fórmula de Haversine corretamente (raio da Terra 6.371 km, `2 * atan2(sqrt(a), sqrt(1-a))`) — usada para ordenar sites próximos após o filtro grosseiro de bounding-box. A abordagem (bounding-box grosseiro em SQL + Haversine preciso em JavaScript sobre o subconjunto já filtrado) é uma prática comum e razoável na ausência de suporte espacial nativo — mas depende de que o bounding-box SQL já tenha reduzido bastante o conjunto de linhas antes de chegar ao JavaScript, o que não é garantido sem índice espacial em áreas de alta densidade (ex.: São Paulo, com 72 mil sites).

## 4. Renderização e memória do navegador

- Modo "todos os pontos" do Mission Control passa o array `dashboard?.points` (até 4.000 itens) diretamente para `MapView`, que mapeia cada um para um `<CircleMarker>` React — para 4.000 marcadores sem clustering, isso é gerenciável na maioria dos navegadores modernos, mas já está no limite do razoável para renderização sem virtualização; se o cap for elevado no futuro (ou removido) sem introduzir clustering, há risco real de travamento do navegador.
- O modo "heatmap" reaproveita os mesmos `CircleMarker` com raio maior e opacidade baixa (`fillOpacity: .075`) em vez de usar uma camada de heatmap real (ex.: `leaflet.heat`) — funciona visualmente mas não é uma implementação de heatmap com kernel de densidade, é uma aproximação por sobreposição de círculos semitransparentes.

## 5. Projeção e normalização de coordenadas

Nenhuma normalização de projeção é aplicada — coordenadas são assumidas diretamente em WGS84 (graus decimais), consistente com o Leaflet padrão. Não há verificação de datum na importação (assume-se que as planilhas de origem já estão em WGS84; isso não foi verificado com o provedor de dados, é uma suposição herdada do formato de origem).

## 6. Índices geoespaciais / limites municipais

Nenhum uso de fronteiras municipais/UF em GeoJSON foi encontrado — agregações por município/UF são feitas puramente por texto (`GROUP BY municipio, uf`), não por geometria de polígono. A pasta `MAPAS` está vazia, confirmando que não há nenhum artefato de fronteira ou tile offline armazenado.

## 7. Recomendação de arquitetura de dados espaciais

Dado o volume atual (299.308 registros, crescimento incremental esperado, não exponencial) e o fato de a aplicação rodar **localmente em SQLite via `node:sqlite`**, a recomendação é uma evolução **em estágios, sem migração prematura**:

1. **Curto prazo (Stage 0/1 do roadmap):** adicionar um índice `RTree` do SQLite (módulo `rtree`, nativo do SQLite, não requer extensão externa) sobre `(latitude, longitude)` — ganho de performance significativo para bounding-box queries com esforço mínimo, sem trocar de banco.
2. **Médio prazo:** avaliar `SpatiaLite` somente se operações espaciais mais ricas forem necessárias (interseção de polígono, distância geodésica nativa em SQL) — acrescenta complexidade operacional (extensão nativa a carregar) que não parece justificada pelo uso atual (bounding-box + Haversine em aplicação já resolve o caso de uso).
3. **Não recomendado no momento:** migração para PostgreSQL/PostGIS ou DuckDB spatial. O volume atual (161 MB de banco, ~300 mil linhas) está confortavelmente dentro da capacidade do SQLite com os ajustes acima; migrar de banco agora introduziria custo operacional (servidor de banco separado, gestão de conexões, deploy) desproporcional ao ganho, considerando que a aplicação é local/single-user hoje. Esta decisão deve ser reavaliada se o produto migrar para multi-usuário concorrente ou escala nacional de processamento de imagens SAR (Stage 12).

## 8. Achados-chave desta fase

1. **Nenhum índice espacial existe** — é o maior risco de performance geoespacial identificado, e a correção (RTree) é de baixo esforço e alto retorno.
2. **Nenhum clustering de marcador** — aceitável no cap atual de 4.000 pontos, mas é um bloqueador claro para exibir a base completa de 299 mil sites sem travar o navegador.
3. Conversão raio-para-graus não compensa a latitude — imprecisão geométrica menor, mas real.
4. Recomendação: **SQLite + RTree agora; reavaliar PostGIS apenas se/quando a arquitetura evoluir para multiusuário ou processamento SAR em escala nacional.**
