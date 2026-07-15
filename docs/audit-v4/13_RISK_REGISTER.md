# 13 — Risk Register

Consolidação de todos os riscos identificados nas Phases A–L, ordenados por severidade combinada (impacto × probabilidade × facilidade de exploração/ocorrência).

| # | Risco | Origem (Phase) | Severidade | Probabilidade | Ação recomendada | Stage do roadmap |
|---|---|---|---|---|---|---|
| R1 | Copernicus/Sentinel-1 é 100% simulado; verificação de credenciais não tem efeito no comportamento — risco de comunicação institucional incorreta sobre capacidade real | I | **Crítica (comunicação/reputação)** | Certa (já ocorre hoje se não corrigida a narrativa) | Não comunicar "integração Copernicus ativa" externamente até Stage 3 estar implementado de verdade; corrigir a lógica condicional inoperante no código | Stage 0 (narrativa) + Stage 3 (código) |
| R2 | Ausência total de autenticação em 43 endpoints de API | J | Alta | Alta, se exposto além de localhost | Bloquear exposição em rede compartilhada até autenticação básica existir | Stage 0 |
| R3 | Nenhum teste automatizado, nenhum CI/CD, nenhum Git — qualquer mudança futura carece de rede de segurança | B, L | Alta | Certa (estrutural) | Inicializar repositório Git imediatamente; estabelecer smoke tests e lint básico | Stage 0 |
| R4 | Reimportação da base apaga (via substituição atômica do arquivo `.db`) todas as tabelas satélite (Trust Score, Copernicus, grafo SIG, notas, auditoria) construídas pela aplicação | E | Alta | Média (ocorre a cada reimportação completa) | Separar schema de importação (dados-fonte) do schema de derivados de aplicação; migrar para merge incremental em vez de substituição total | Stage 0/1 |
| R5 | 88,6% dos registros de `sites` compartilham coordenada exata com outro registro — não investigado se é duplicata real ou co-localização legítima | D | Média-Alta | Certa (já existe) | Investigação dedicada antes de qualquer deduplicação automática; tratar como "requer revisão manual" | Stage 1 |
| R6 | CSV/Excel Formula Injection em campos de texto livre exportados (`site_notes`) | J | Média | Baixa-Média (requer usuário mal-intencionado com acesso à UI) | Neutralizar caracteres líderes de fórmula antes de exportar | Stage 0 |
| R7 | Path traversal potencial em nome de arquivo de exportação (`site.site` não sanitizado) | F, J | Média | Baixa (depende de dado futuro malformado) | Sanitizar identificador antes de uso em path | Stage 0 |
| R8 | Ausência de rate limiting em endpoints custosos (export, recalculate, build) | J | Média | Média | Rate limiting básico por IP/sessão | Stage 0 |
| R9 | Ausência de índice espacial (RTree) — consultas geográficas fazem varredura completa | H, K | Média | Certa sob uso continuado | Adicionar RTree sobre `(latitude, longitude)` | Stage 1 |
| R10 | Confusão terminológica: "Sentinel" usado para 3 conceitos não relacionados (satélite, grafo de conhecimento, índice de risco de mercado) | G | Média | Certa (já existe) | Renomear ao menos 2 dos 3 usos antes de qualquer material voltado a stakeholder externo | Stage 0/4 |
| R11 | Scores determinísticos (LTS/TCI/OPI/SRI/Trust) apresentados com falsa precisão estatística | G, C | Média | Certa (já existe) | Adicionar indicação visual clara de "estimativa baseada em regras" no mesmo nível de destaque do número | Stage 4 |
| R12 | Dois lockfiles conflitantes (`package-lock.json` + `pnpm-lock.yaml`) | A | Baixa-Média | Certa (já existe) | Escolher um gerenciador de pacotes oficial e remover o outro lockfile | Stage 0 |
| R13 | `.next` de build desatualizado frente ao código-fonte atual; build de produção não pôde ser reconfirmado nesta auditoria | A, L | Baixa-Média | Média | Rebuild e validação manual imediata na máquina do usuário | Stage 0 |
| R14 | Backups manuais (`.zip`) defasados (parados na V1.3, 4 sprints atrás) e redundantes (cada um inclui cópia de 52 MB do Excel) | A | Baixa | Certa (já existe) | Rotina de backup automatizada e mais leve (excluir fonte de dados já preservada em `BASE`/raiz) | Stage 0 |
| R15 | Cobertura de validação satelital e do grafo Sentinel Core é de frações mínimas da base (0,09% e ~0,8% respectivamente) — qualquer relato de "cobertura nacional" seria incorreto hoje | D, I | Baixa (se comunicado corretamente) / Alta (se comunicado incorretamente) | Depende da comunicação | Rotular claramente como "amostra" em toda a UI e relatórios até processamento em lote nacional existir | Stage 2/4 |
| R16 | Ausência de processamento em background — recálculos síncronos bloqueiam o processo Node único durante a execução | K | Baixa-Média | Média sob uso concorrente | Mover operações de lote para execução assíncrona | Stage 1 |
| R17 | Sem WAL checkpoint periódico — arquivo `-wal` de 55 MB pendente | D, J | Baixa | Baixa | `PRAGMA wal_checkpoint` periódico | Stage 0 |
| R18 | Nenhuma auditoria de vulnerabilidades de dependências (`npm audit`) executada | J | Baixa | Desconhecida (não auditado) | Rodar `npm audit`/`pnpm audit` assim que o gerenciador oficial for decidido | Stage 0 |
| R19 | Suporte a operadoras Claro/Algar existe na configuração mas não no importador — inconsistência latente | E | Baixa | Baixa (só se materializa ao adicionar nova fonte) | Alinhar `operator_rules.json` e `multi_operator_import.py` antes de aceitar novas fontes | Stage 1+ |
| R20 | Parsing numérico de coordenadas zera silenciosamente valores inválidos (`0.0` em vez de nulo), potencialmente contribuindo para as 1.320 coordenadas `(0,0)` | E | Baixa | Certa (já existe) | Distinguir "zero informado" de "falha de parse" com log de contagem | Stage 1 |

## Observação metodológica

Nenhum risco "Crítico" de segurança/técnico (no sentido de exploração imediata contra dados de produção) foi encontrado — o item mais grave (R1, Copernicus simulado) é um risco de **integridade de comunicação/governança**, não uma falha técnica explorável. Isso reflete positivamente a disciplina geral do time que construiu o projeto, mesmo com as lacunas estruturais (testes, CI, autenticação) que precisam ser endereçadas antes da evolução para V4.
