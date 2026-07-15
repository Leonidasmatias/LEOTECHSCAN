# 09 — Sentinel-1 and Copernicus Audit (Fase Crítica)

Esta é a fase mais importante da auditoria. Todas as conclusões abaixo são baseadas em leitura linha-a-linha de `services/copernicus-engine.ts` (236 linhas, arquivo completo lido), `config/copernicus_rules.json` (arquivo completo lido), `services/satellite-validation-engine.ts`, `services/confidence-engine.ts`, e em consulta direta à tabela `copernicus_scenes` (1.270 linhas) e `site_satellite_validation` (271 linhas) no banco de produção (via cópia read-only).

## 1. O que existe de fato

- Um schema de banco bem definido (`copernicus_scenes`, `site_satellite_validation`) pronto para receber dados reais de catálogo Sentinel-1.
- Um arquivo de configuração (`config/copernicus_rules.json`) que já referencia corretamente os endpoints reais do Copernicus Data Space Ecosystem: `https://catalogue.dataspace.copernicus.eu/odata/v1/Products` (OData) e `https://catalogue.dataspace.copernicus.eu/stac` (STAC), além de endpoints futuros (Sentinel Hub, openEO).
- Uma função de validação de coordenada (`validateSiteCoordinates`) que verifica se a coordenada do site está dentro de um bounding-box plausível do Brasil e não é `(0,0)` — **esta parte é uma verificação real e útil**, ela roda antes de qualquer simulação.
- Uma fórmula de pontuação (`calculateSatelliteValidationScore`) e um texto de recomendação (`generateSatelliteRecommendation`) — determinísticos, documentados, coerentes com o que é realmente calculado.
- Textos de governança/disclaimer explícitos e tecnicamente corretos embutidos no próprio código e retornados pela API (ex.: `"Copernicus/Sentinel-1 apoia validacao territorial, nao substitui vistoria de campo e nao garante identificacao automatica de torre"`).

## 2. O que é simulado (achado central)

**100% dos dados de cena Sentinel-1 no banco são sintéticos.** Evidência direta, consultada no banco de produção:

```
scene_id: "MOCK_S1_TSHG01_20260616_ASCENDING"
metadata_json: {"mode":"mock_metadata_only","radiusKm":2,"lookbackDays":90,"noHeavyImageDownload":true}
```

Todas as 1.270 linhas de `copernicus_scenes` seguem este padrão — `provider` é sempre `"Copernicus Data Space Ecosystem"` (texto fixo do config, não resposta de API), `mission` sempre `"Sentinel-1"`, `product_type` sempre `"GRD"`, e o `scene_id` sempre começa com o prefixo literal `MOCK_S1_`.

A função geradora, `mockScenes()`, constrói as cenas inteiramente em memória a partir de aritmética de datas (`Date.now() - (index+1) * sceneSpacingDays * ...`) e de um padrão alternado de órbita ascendente/descendente — **nenhuma chamada de rede ocorre**.

### O achado mais crítico: a checagem de credenciais existe, mas não tem efeito nenhum

```ts
// services/copernicus-engine.ts, linha 125-126
const hasCredentials = Boolean(process.env.COPERNICUS_ACCESS_TOKEN || process.env.COPERNICUS_CLIENT_ID);
const scenes = hasCredentials ? mockScenes(site, radiusKm, lookbackDays) : mockScenes(site, radiusKm, lookbackDays);
```

Ambos os ramos do operador ternário chamam **a mesma função de mock**. Ou seja: mesmo que um operador configure `COPERNICUS_ACCESS_TOKEN` em produção acreditando estar habilitando a busca real no catálogo, **o sistema continuaria gerando cenas sintéticas exatamente como antes** — apenas o rótulo `mockMode`/`mock` no payload de resposta mudaria de `true` para `false`, criando uma falsa impressão de que dados reais estão sendo usados. Isso não é um bug sutil de lógica de negócio — é a ausência completa de um cliente HTTP real para o Copernicus, disfarçada por uma verificação condicional que não altera o comportamento.

**Confirmado por busca exaustiva no código**: nenhuma chamada `fetch()`, `axios`, `http.request` ou similar para qualquer domínio `copernicus.eu`, `sentinel-hub.com` ou `dataspace.copernicus.eu` existe em nenhum arquivo `.ts`/`.tsx` do projeto. Os únicos `fetch()` encontrados em todo o código são chamadas internas para rotas `/api/*` da própria aplicação Next.js (client → server-side da mesma origem).

## 3. Classificação por capacidade (conforme exigido pelo escopo da auditoria)

| Capacidade | Estado |
|---|---|
| Busca de metadados (metadata-only) | **Simulado** — nenhuma busca real ocorre |
| Autenticação real Copernicus Data Space | **Não implementado** — variáveis de ambiente são lidas mas não usadas para autenticar nada |
| Busca real no catálogo Sentinel-1 | **Não implementado** |
| Validação de footprint de cena | **Não implementado** (não há geometria de cena real para validar) |
| Filtro por órbita | **Simulado** — órbitas alternam artificialmente entre ASCENDING/DESCENDING por índice, não refletem órbitas reais |
| Filtro por polarização | **Simulado** — sempre `"VV,VH"` fixo |
| Filtro por tipo de produto | **Simulado** — sempre `"GRD"` fixo |
| Filtro por modo de aquisição | **Não implementado** (modo IW não é sequer mencionado no config) |
| Filtro temporal | **Parcialmente simulado** — o parâmetro `lookbackDays` é real e afeta a quantidade de cenas mockadas geradas, mas não filtra nada real |
| Download de cena | **Não implementado** (`allowDownload: false` no config, e nenhum código de download existe) |
| Download parcial de asset | **Não implementado** |
| Pré-processamento / Calibração / Speckle filtering / Terrain correction / Co-registro | **Não implementado** — nenhuma dependência de processamento SAR (GDAL, rasterio, SNAP, snappy) existe no projeto |
| Detecção de mudança / Análise de coerência / Comparação de backscatter | **Não implementado** |
| Armazenamento de evidência | **Implementado, mas armazena metadados sintéticos**, não evidência real |
| Provenance / Log de processamento | **Parcialmente implementado** — `audit_trail` registra eventos de aplicação, mas não há log de chamadas de API externa real (porque elas não existem) |
| Retry / Quota handling | **Não implementado** (não há chamada de rede para reter ou limitar) |

## 4. Separação exigida pela auditoria

1. **O que existe:** schema de banco, config de regras, fórmula de pontuação determinística, validação de coordenada, textos de governança corretos.
2. **O que é simulado:** 100% dos dados de cena e de validação satelital atualmente no banco.
3. **O que é apenas metadata-only por design (mesmo quando/se implementado de verdade):** a arquitetura já está corretamente desenhada para nunca baixar imagens SAR pesadas (`allowDownload: false`) — isso é uma decisão de design correta a preservar mesmo quando a integração real for construída.
4. **O que requer credenciais:** a autenticação real do Copernicus Data Space Ecosystem (OAuth2/token) — hoje as variáveis de ambiente existem mas não são usadas para autenticar nada de fato.
5. **O que requer serviços externos:** qualquer chamada real ao endpoint OData/STAC do Copernicus Data Space Ecosystem — nenhuma foi implementada.
6. **O que requer engenharia nova significativa:** todo o pipeline de processamento SAR (calibração, correção de terreno, coerência, detecção de mudança) — nenhuma linha desse pipeline existe hoje; isso é trabalho novo do zero (Roadmap Stages 3–6).
7. **O que Sentinel-1 pode realisticamente detectar** (uma vez implementado de verdade): indicadores temporais de mudança, disturbio de superfície, sinais de atividade de construção, inundação, mudanças relacionadas a umidade do solo, mudanças amplas de vegetação/cobertura do solo, mudanças de área de acesso onde a resolução permitir — priorização para revisão humana.
8. **O que Sentinel-1 não pode detectar de forma confiável sozinho, em escala nacional:** identificação direta e individual de torres, antenas, shelters, cercas ou cabos. Nenhuma alegação nesse sentido foi encontrada no código ou na documentação atual — e nenhuma deve ser feita no futuro sem imagem óptica/resolução muito alta complementar (Roadmap Stage 10).

## 5. Cobertura real no banco

- `site_satellite_validation`: 271 linhas para 299.308 sites elegíveis (coordenada válida) — **cobertura de 0,09%**. Os registros são gerados sob demanda, um por vez, quando um usuário abre a tela de Site Intelligence/Evidence Center de um site específico — não existe (nem é chamado) nenhum processo em lote/nacional.
- Qualquer comunicação institucional que sugira "validação satelital nacional" ou "cobertura Sentinel-1 da base completa" seria **factualmente incorreta** no estado atual do sistema.

## 6. Achados-chave desta fase

1. **Achado crítico #1:** a checagem de credenciais Copernicus não tem efeito no comportamento — o sistema sempre simula, independentemente de configuração. Isso deve ser corrigido antes de qualquer comunicação que mencione "modo real disponível mediante configuração de credenciais", pois essa afirmação não é verdadeira hoje.
2. **Achado crítico #2:** nenhuma chamada de rede real para Copernicus/Sentinel Hub existe em lugar nenhum do código.
3. O design é **honesto no texto** (`mock_metadata_only`, disclaimers corretos) mas **a lógica de decisão de modo (mock vs. real) é enganosa por ser inoperante** — os dois problemas devem ser tratados com prioridades distintas: o texto já está certo, o código de decisão precisa ser corrigido ou removido até que a integração real exista.
4. A base de dados e o config estão **bem desenhados para receber a integração real** no futuro (Roadmap Stage 3) sem grande refatoração de schema — o trabalho pendente é majoritariamente a construção do cliente HTTP real e do pipeline de processamento SAR, não o redesenho do modelo de dados.
