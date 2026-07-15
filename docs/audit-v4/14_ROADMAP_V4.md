# 14 — Roadmap V4: Sentinel-1 Enterprise / National Telecom Site Radar

Este roadmap é construído **inteiramente sobre os achados evidenciados nas Phases A–L** deste documento de auditoria. Ele prioriza fundação sobre IA avançada, conforme exigido: nenhum estágio de detecção de mudança ou monitoramento nacional começa antes de a fundação geoespacial e a integração real de catálogo existirem e serem validadas.

## Visão de longo prazo (não implementada ainda)

Mapear todos os sites com coordenada válida; associar cada site elegível a metadados e evidência de satélite reais; buscar cenas Sentinel-1 para cada site elegível; manter histórico satelital temporal por site; detectar mudanças estatisticamente relevantes ao redor da coordenada do site; criar um radar nacional de monitoramento de infraestrutura telecom; priorizar sites que requerem revisão humana; manter evidência, confiança e proveniência para cada conclusão; suportar um Digital Twin por site; **nunca** alegar reconhecimento direto de torre via Sentinel-1 isoladamente.

---

## STAGE 0 — Stabilization and Truth Baseline

**Por quê:** a auditoria encontrou zero testes, zero CI, zero Git, uma verificação de credenciais Copernicus inoperante, e ausência de autenticação. Nenhum estágio seguinte deve começar sobre essa base instável.

Objetivos: corrigir defeitos críticos/altos do Risk Register (R1–R8, R12, R13); inicializar repositório Git; estabelecer build reproduzível confirmado na máquina real; validar integridade do banco (já feito nesta auditoria — `ok`); validar todas as rotas documentadas; separar informação real/simulada/inferida na comunicação do produto; criar registro de capacidades; criar baseline de testes; criar procedimento de backup/recuperação; preservar o produto em funcionamento.

Entregáveis: build estável confirmado; banco validado; registro de capacidades (baseado na tabela da Phase B/C desta auditoria); plano de remediação de risco; suíte de teste baseline (smoke tests de API); endpoint de health check do sistema (`/api/health` — não existe hoje).

## STAGE 1 — National Site Geospatial Foundation

Objetivos: mapear todo site com coordenada válida; identificar e colocar em quarentena coordenadas inválidas (as 1.320 em `(0,0)` e as 1.377 fora do bounding-box do Brasil, já identificadas na Phase D); implementar consultas por viewport/bounding-box eficientes (RTree — Decisão D1); implementar clustering de marcador; parar de enviar todos os 299.308 registros ao navegador (já parcialmente mitigado — formalizar); criar status de elegibilidade geoespacial por site; criar índices espaciais; criar benchmarks de performance de mapa.

Classificações obrigatórias por site: Elegível para mapeamento · Coordenada inválida · Coordenada ausente · Fora do limite nacional esperado · Coordenada duplicada · Coordenada suspeita · Requer revisão manual (aplicável em especial aos 48.767 grupos de coordenada duplicada identificados na Phase D).

## STAGE 2 — Satellite Asset Registry

Objetivos: criar o registro de satélite para cada site elegível, usando o schema proposto na Seção 11 do prompt original (`satellite_providers`, `satellite_collections`, `satellite_scenes`, `site_scene_matches`, `satellite_processing_jobs`, `satellite_processing_artifacts`, `satellite_evidence`, `satellite_change_events`) — ver ERD completo em `15_IMPLEMENTATION_BACKLOG.md`. As tabelas já existentes (`copernicus_scenes`, `site_satellite_validation`) devem ser migradas/mapeadas para este modelo mais rico, preservando os 1.270 registros de cena e 271 registros de validação já existentes (mesmo sendo simulados — rotulá-los explicitamente como `synthetic=true` na migração, nunca apagá-los silenciosamente).

## STAGE 3 — Copernicus Data Space Integration (real)

**Este é o estágio que corrige o achado crítico R1.** Objetivos: configuração segura de credenciais (fora do código, via variável de ambiente já preparada); ciclo de vida de token OAuth2; busca real de catálogo (OData/STAC, endpoints já corretos em `copernicus_rules.json`); validação de interseção com o site; filtro de data; filtro de coleção Sentinel-1; priorização de modo IW; disponibilidade VV/VH; metadados de órbita ascendente/descendente; paginação; retry; consciência de rate limit; cache local de metadados; trilha de auditoria de query. **Manter metadata-first — não iniciar download de cena nacional nesta fase.** A função `mockScenes()` deve ser mantida apenas como fallback explícito de desenvolvimento/demonstração (claramente rotulado `synthetic: true` em todo payload), nunca mais como caminho único de execução.

## STAGE 4 — Sentinel Radar Map

Novo aplicativo principal ("Sentinel Radar" — nome a ser escolhido evitando a colisão terminológica identificada em R10). Mapa exibindo status baseado em evidência: Nenhuma busca satelital realizada · Nenhuma cena elegível encontrada · Metadados satelitais disponíveis · Baseline estabelecida · Nova aquisição disponível · Processamento pendente · Indicador de mudança detectado · Mudança em revisão · Mudança confirmada por humano · Falso positivo · Erro de processamento. **Nunca usar rótulos como "torre removida" sem evidência adequada** (reforça a regra científica da Phase I). Filtros: operadora, UF, município, tecnologia, status do site, status satelital, última aquisição, score de mudança, confiança, status de revisão, Data Trust, risco, arquivo de origem.

## STAGE 5 — Pilot Sentinel-1 Processing Pipeline

Piloto controlado, não processamento nacional. Seleção: 50 sites → 500 → 5.000, com critérios de coordenada válida, diversidade geográfica, áreas urbanas/rurais, histórico de site conhecido, disponibilidade de múltiplas cenas, sites manualmente verificáveis. Pipeline: seleção de cena → seleção de baseline → seleção de comparação → checagem de compatibilidade de órbita → checagem de compatibilidade de polarização → pré-processamento → calibração → tratamento de speckle → correção de terreno → co-registro → extração de área de interesse → cálculo de feature de backscatter → score de mudança → armazenamento de artefato → geração de evidência → revisão humana. Ver Decisão D2 para escolha inicial de tecnologia (Python geospatial stack; SNAP reavaliado quando calibração/correção de terreno completas forem necessárias).

## STAGE 6 — Temporal Change Detection

Indicadores de mudança (não identificação de objeto): delta VV, delta VH, mudança de razão VV/VH, mudança de textura local, anomalia temporal, score de disturbio de superfície, indicador de inundação, indicador de atividade de construção, indicador de mudança relacionada a vegetação, indicador de mudança de área de acesso, score de confiança. Cada resultado registra: cenas de entrada, versão do algoritmo, parâmetros, tempo de processamento, janela espacial, método de baseline, confiança, limitações conhecidas, estado de revisão.

## STAGE 7 — Human Validation Workspace

Interface de revisão técnica mostrando: localização do site, dados do site, aquisições antes/depois, camadas derivadas de SAR, heatmap de mudança, metadados de aquisição/órbita, parâmetros de processamento, sites próximos, notas do site, Data Trust, alertas históricos, decisão e comentários do revisor. Resultados de revisão: mudança relevante confirmada, mudança provavelmente relevante, incerto, variação ambiental natural, artefato de processamento, problema de geolocalização, falso positivo, requer verificação de campo.

## STAGE 8 — Site Satellite Timeline

Timeline por site separando explicitamente: metadado satelital observado, indicador numérico derivado, inferência de máquina, conclusão humana, confirmação de campo. Eventos: buscas de cena, aquisições disponíveis, baseline selecionada, execuções de comparação, indicadores de mudança, revisões, confirmações, rejeições, erros de processamento, mudanças de algoritmo.

## STAGE 9 — Digital Twin V4

Upgrade do Digital Twin atual (hoje classificado como "rule-based prototype" na Phase B) para incluir: registro mestre do site, dados de operadora, contexto geográfico, histórico satelital, histórico de mudança, Data Trust, Evidence Center, alertas, notas, sites próximos, informação operacional, recomendações, validações humanas, proveniência de processamento. **Nenhum score pode existir sem fórmula explicável e dado de origem rastreável** — requisito já parcialmente atendido hoje (todas as fórmulas atuais são auditáveis em `config/*.json` e código), mas deve ser formalizado como contrato de produto.

## STAGE 10 — Multisource Confirmation

Após validação do piloto Sentinel-1: avaliar Sentinel-2, Landsat, OpenStreetMap, IBGE, MapBiomas, SRTM/Copernicus DEM, limites municipais, malha viária, mapas de inundação, clima, imagem comercial de resolução mais alta (onde legal/financeiramente viável), fotos de campo enviadas por usuário. Sentinel-1 é a camada de radar — nunca a única fonte de evidência.

## STAGE 11 — Automated Monitoring

Somente após o piloto demonstrar precisão aceitável (ver `16_ACCEPTANCE_CRITERIA.md`): checagens agendadas de catálogo, detecção de novas aquisições, fila de jobs de processamento, reuso de cenas em cache, priorização de sites de alto risco, alertas, rastreamento de falhas, retry seguro, quotas, observabilidade de job, notificação somente quando critérios de threshold/confiança forem atendidos.

## STAGE 12 — National Scale

Escalar gradualmente: piloto 50 → 500 → 5.000 → um município → uma UF → uma operadora → múltiplas UFs → cobertura de metadados nacional → processamento nacional seletivo. **Não recomendar processamento de pixel nacional antes de custo, armazenamento, performance e precisão estarem comprovados** no piloto.

---

## Nota de honestidade sobre estimativas

Nenhuma duração em semanas/sprints é atribuída aos estágios acima nesta auditoria, pois isso dependeria de tamanho de equipe e disponibilidade que não foram fornecidos. O detalhamento item-a-item com prioridade P0–P3 e sprint sugerido está em `15_IMPLEMENTATION_BACKLOG.md`.
