# 05 — Excel Import Pipeline Audit

**Fontes inspecionadas:** `importers/multi_operator_import.py` (662 linhas efetivas, revisado por completo), `scripts/import_excel.py` (wrapper de 252 bytes), `scripts/migrate_operator_v13.py`, `scripts/audit_operator_v13.py`.

## 1. Descoberta de arquivos-fonte

```python
def find_sources(base_dir, explicit_sources=None):
    if explicit_sources: return [...], False
    base_files = sorted(p for p in base_dir.glob("*.xlsx") if not p.name.startswith("~$"))
    if base_files: return base_files, False
    fallback = [p for p in FALLBACK_FILES if p.exists()]
    return fallback, True
```

- Prioridade 1: arquivos `--source` explícitos via CLI.
- Prioridade 2: qualquer `.xlsx` em `C:\LEOTECHSCAN\BASE`, ignorando temporários do Excel (`~$*`).
- Prioridade 3 (fallback): `BASE SPAZIO COM IBGE_n.xlsx` e `VIVO SITES.xlsx` na raiz do projeto, **somente se `BASE` estiver vazia**.
- **Confirmado nesta auditoria:** `BASE` está vazia agora, então o sistema está de fato rodando no modo fallback (3), como registrado em `metadata.fallback_used=True`.

## 2. Seleção de planilha e mapeamento de cabeçalho

- Lê apenas a **primeira aba** de cada arquivo (`workbook[workbook.sheetnames[0]]`) — se um arquivo futuro tiver dados relevantes em outras abas, eles seriam ignorados silenciosamente (nenhum aviso é logado sobre abas extras).
- Detecção de operadora por nome de arquivo + presença de colunas-assinatura (`detect_operator`): `VIVO` se o nome contém "VIVO" ou existe coluna `PMO_SIGLA`/`SCIENCE_ENDERECO`; `TIM` se o nome contém "TIM" ou existe `SITE_ID`; `CLARO`/`ALGAR` teriam suporte por nome de arquivo mas **nenhuma coluna de mapeamento foi implementada para eles** (só TIM e VIVO têm função `mapped_*`) — se um arquivo Claro/Algar for adicionado hoje, o importador o classificaria como `NAO_IDENTIFICADO` e o puraria (linha "file_skipped_unknown_operator").
- TIM exige 21 colunas obrigatórias (`TIM_COLUMNS`); se qualquer uma faltar, a importação **falha explicitamente** (`RuntimeError`) em vez de importar parcialmente — comportamento seguro (falha ruidosa, não silenciosa).
- VIVO usa um esquema de "primeira coluna disponível entre várias candidatas" (`first(row, "PMO_SIGLA", "SIGLA_LOGICA_REFERENCIA", ...)`) — mais tolerante a variações de layout, mas também mais silencioso sobre qual coluna efetivamente foi usada linha a linha (não fica registrado por linha, só a lista agregada de colunas ausentes por arquivo).

## 3. Parsing de coordenadas e localização numérica

```python
def number(value, default=0.0):
    if value in (None, ""): return default
    try: return float(str(value).replace(" ", "").replace(",", "."))
    except (TypeError, ValueError): return default
```

Trata separador decimal brasileiro (vírgula) convertendo para ponto antes do `float()`. **Falha silenciosa**: qualquer valor não conversível vira `0.0` sem log de aviso por linha — isso explica plausivelmente parte das **1.320 coordenadas exatamente `(0,0)`** encontradas no banco (ver `04_DATABASE_AUDIT.md`). Recomenda-se que valores não parseáveis sejam marcados distintamente de "zero informado de fato" (ex.: usar `NULL` em vez de `0.0` como padrão, ou logar contagem de falhas de parse por arquivo).

## 4. Datas, linhas vazias, duplicatas

- Linhas totalmente vazias são ignoradas (`if not any(value is not None for value in raw): continue`).
- Não há deduplicação em tempo de importação — linhas idênticas ou quase-idênticas do Excel são inseridas como estão; a deduplicação é responsabilidade exclusiva do `duplicates-engine.ts` em tempo de leitura (sugestiva, não corretiva).
- Datas: o único campo de data efetivamente gerado é `imported_at` (timestamp UTC ISO da execução), não há parsing de datas de campo de origem (a base não trouxe colunas de data de instalação, por exemplo).

## 5. Hash e proteção do Excel original

- `fingerprint()` calcula SHA-256 em streaming (chunks de 1 MB) **antes e depois** da leitura de cada arquivo.
- O workbook é aberto com `load_workbook(path, read_only=True, data_only=True, keep_links=False)` — modo somente leitura do `openpyxl`, sem gravação.
- **Confirmado no banco:** ambas as linhas de `import_audit` têm `sha256_antes == sha256_depois` e `excel_inalterado=1` — prova técnica de que a última execução não alterou os arquivos-fonte.
- Esta auditoria também não alterou os arquivos: nenhuma operação de escrita foi realizada sobre `BASE SPAZIO COM IBGE_n.xlsx` ou `VIVO SITES.xlsx` (apenas leitura via `device_list_dir`/`device_stage_files`, que são somente leitura por natureza).

## 6. Transação, atomicidade e recuperação parcial

- O importador escreve para um arquivo **temporário** (`database.with_suffix(".tmp.db")`), removendo qualquer `.tmp.db` pré-existente antes de começar.
- Inserções em lote de **5.000 linhas por commit** (`conn.executemany(...); conn.commit()`).
- Ao final, índices são criados, `PRAGMA optimize` é executado, e o arquivo temporário **substitui atomicamente** o banco de produção (`temp.replace(database)` — operação atômica de sistema de arquivos no mesmo volume).
- **Efeito prático:** cada execução do importador é, na prática, uma **reconstrução completa** do banco, não uma atualização incremental. Isso garante que uma falha no meio do processo nunca corrompe o banco em produção (o `.tmp.db` seria descartado/sobrescrito na próxima tentativa), mas também significa que **não existe importação incremental** — toda tabela satélite (`site_trust_scores`, `copernicus_scenes`, etc.) construída sobre o banco anterior seria perdida ao rodar uma nova importação completa, pois o arquivo inteiro é substituído. **Isso é um risco operacional real**: reimportar a base hoje apagaria as 1.270 cenas Copernicus, os 270 Trust Scores e o grafo Sentinel Core já calculados, pois essas tabelas não existem no `CREATE_SQL` do importador (elas são criadas via `CREATE TABLE IF NOT EXISTS` pelos próprios serviços de aplicação na primeira vez que rodam, não pelo importador).
- Falhas são logadas via `logging.exception` e relançadas (`raise`) — o processo termina com código de erro visível, não falha silenciosamente.

## 7. Performance com ~300 mil registros

- Lotes de 5.000 linhas por commit é uma escolha razoável para SQLite (evita transação única gigante, mas também evita overhead de commit por linha).
- `openpyxl` em modo `read_only=True` usa streaming (`iter_rows`), não carrega a planilha inteira em memória de uma vez — apropriado para o arquivo de 52 MB / ~300 mil linhas.
- Índices são criados **depois** da carga completa (prática correta — criar índice antes do bulk insert seria mais lento).
- Nenhum teste de carga/tempo de execução foi encontrado documentado; o `README.md` confirma validação funcional ("SQLite populado com 299.308 registros") mas não relata tempo de execução.

## 8. Arquivos temporários do Excel (`~$`)

Tratado corretamente: `find_sources` filtra explicitamente `not path.name.startswith("~$")`, e o loop principal em `import_all` reforça o mesmo filtro (`if source.name.startswith("~$")... continue`) — dupla proteção.

## 9. Comportamento com `BASE` vazia

Confirmado nesta auditoria: comportamento é exatamente o documentado — cai para os dois arquivos da raiz, registra `fallback_used=True`/`fallback_usado=1`, e loga um aviso (`logging.warning("base_folder_empty_fallback_used ...")`).

## 10. Achados-chave desta fase

1. **Engenharia de importação é sólida**: hash de integridade, leitura somente-leitura do Excel, substituição atômica do banco, tratamento de arquivos temporários, e falha ruidosa (não silenciosa) em caso de colunas ausentes para TIM.
2. **Risco real de perda de dados derivados**: reimportar a base apaga (via substituição atômica do arquivo `.db` inteiro) todas as tabelas satélite construídas por serviços da aplicação (Trust Scores, Copernicus, grafo SIG, notas de site, trilha de auditoria) — porque essas tabelas não fazem parte do schema criado pelo importador. Isso precisa virar processo documentado e, idealmente, uma etapa de migração/merge no lugar de substituição total (Roadmap Stage 0).
3. **Parsing numérico silenciosamente zera valores inválidos** — candidato a explicar parte das coordenadas `(0,0)` encontradas na Phase D; recomenda-se logar contagem de falhas de parse por execução.
4. Suporte a Claro/Algar está **parcialmente presente na configuração** (`operator_rules.json`) mas **ausente no importador** (`multi_operator_import.py` só tem `mapped_tim`/`mapped_vivo`) — inconsistência a resolver antes de qualquer nova fonte ser adicionada.
