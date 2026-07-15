# 16 — Acceptance Criteria & Scientific Validation Plan

## 1. Critérios de aceite por estágio (resumo executável)

| Stage | Critério de aceite mínimo |
|---|---|
| 0 | `git log` mostra histórico; `npm run build` confirmado com sucesso na máquina real; smoke tests de API passam para os 43 endpoints; `/api/health` retorna status do banco; achados R1–R8 do Risk Register corrigidos ou explicitamente aceitos como risco residual documentado |
| 1 | 100% dos 299.308 sites têm uma classificação de `site_geospatial_status`; consulta de bounding-box usando RTree comprovadamente mais rápida que a baseline atual (benchmark documentado); mapa não trava com clustering habilitado até o total de sites elegíveis |
| 2 | Novo schema de registro satelital criado e populado a partir dos dados existentes (1.270 cenas, 271 validações) sem perda de dado, com flag `synthetic=true` preservada |
| 3 | Ao menos 1 site real retorna cena Sentinel-1 real (não `MOCK_`) via busca autenticada no Copernicus Data Space Ecosystem; nenhuma imagem pesada é baixada |
| 4 | Sentinel Radar Map exibe os 11 status de evidência exigidos para uma amostra piloto; nenhum rótulo de "torre removida" aparece sem uma cadeia de evidência associada |
| 5 | Pipeline completo (16 etapas) executa de ponta a ponta para o piloto de 50 sites sem erro não tratado; cada execução grava proveniência completa |
| 6 | Cada indicador de mudança gerado registra cenas de entrada, versão de algoritmo, parâmetros, confiança e limitações conhecidas |
| 7 | Workspace de revisão humana permite registrar uma das 8 decisões exigidas para 100% dos casos do piloto |
| 8 | Timeline por site distingue visualmente as 5 categorias (observado/derivado/inferência/conclusão humana/confirmação de campo) |
| 9 | Digital Twin V4 não exibe nenhum score sem link para a fórmula e dado de origem |
| 10 | Ao menos uma fonte multissensor adicional (ex.: Sentinel-2) integrada e cruzada com o piloto Sentinel-1 |
| 11 | Monitoramento agendado roda por ao menos 30 dias corridos sem intervenção manual, respeitando quota e sem notificação abaixo do threshold de confiança definido |
| 12 | Expansão de piloto (500 → 5.000 sites) executada com custo, tempo e taxa de erro documentados e dentro de orçamento aprovado antes de qualquer expansão nacional |

## 2. Plano de validação científica para detecção de mudança Sentinel-1

**Princípio geral: nenhum número de acurácia é inventado nesta auditoria.** Os valores abaixo são placeholders de estrutura de plano — os números reais de precisão/recall só podem ser determinados após execução do piloto com ground truth real.

### 2.1 Requisitos de ground truth

- Amostras positivas: sites com mudança física conhecida e documentada (ex.: desativação, remoção, nova construção confirmada por vistoria de campo ou registro operacional).
- Amostras negativas: sites estáveis, sem mudança conhecida no período de observação.
- Cobertura obrigatória de: sites urbanos e rurais; variação sazonal (pelo menos 2 estações do ano representadas); eventos relacionados a chuva; eventos de inundação conhecidos, se disponíveis; variação agrícola (sites próximos a áreas de cultivo); casos de descasamento de órbita (comparar cenas de órbitas diferentes deliberadamente para medir ruído introduzido); variação de horário de aquisição; erros de geolocalização conhecidos (incluir deliberadamente ao menos um caso de coordenada imprecisa para medir robustez).

### 2.2 Métricas obrigatórias a serem medidas (não estimadas)

Precisão (precision), recall (sensibilidade), taxa de falso positivo, taxa de falso negativo, calibração de confiança (o score de confiança reportado deve corresponder à taxa real de acerto observada), e concordância entre revisores humanos (inter-rater agreement) quando mais de um revisor avaliar os mesmos casos.

### 2.3 Limiares mínimos de aceitação do piloto

Esta auditoria **não define números de precisão/recall mínimos** porque isso exigiria conhecimento de domínio de negócio (qual taxa de falso positivo é operacionalmente aceitável para o time de campo) que não foi fornecido. Recomenda-se que o Technical Product Manager e o time de operações de campo definam esses limiares **antes** do início do Stage 5, com base no custo de uma verificação de campo desnecessária (custo de falso positivo) versus o custo de uma mudança real não detectada (custo de falso negativo).

### 2.4 Regra científica inegociável

Em nenhuma fase do produto — piloto, produção ou monitoramento nacional — o sistema deve alegar identificação direta e confiável de torres, antenas, shelters, cercas ou cabos individuais a partir de Sentinel-1 isoladamente, em escala nacional. Sentinel-1 deve ser comunicado como camada de **indicador de mudança para priorização de revisão humana**, nunca como fonte de confirmação visual direta. Confirmação visual direta requer imagem óptica de resolução muito alta ou verificação de campo (Stage 10).

## 3. Governança de score (aplicável a todos os scores existentes e futuros)

Todo score numérico exposto ao usuário (LTS, TCI, OPI, SRI, ORI, Trust Score, Confidence, score de mudança futuro) deve satisfazer: fórmula documentada e auditável (já é o caso hoje, em `config/*.json`); fonte de dado rastreável até a linha/tabela de origem; rótulo visual explícito de que é uma estimativa baseada em regras, não uma métrica validada externamente, até que validação estatística real (Seção 2) exista para aquele score específico.
