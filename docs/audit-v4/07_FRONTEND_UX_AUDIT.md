# 07 — Frontend and UX Audit

**Revisado:** `components/Dashboard.tsx` (24 KB, componente raiz), `components/MissionControl.tsx` (7,6 KB), `components/MapView.tsx`, `components/Donut.tsx`, mais leitura estrutural dos demais 9 componentes via listagem de exports e uso em `Dashboard.tsx`.

## 1. Estrutura de navegação

`Dashboard.tsx` implementa uma navegação por abas **client-side** com **20 visões** (`activeView` state): Mission Control, Dashboard Executivo, Operator Intelligence, Telecom AI, Rollout, Alert Center, Market, Oportunidades, Qualidade, Duplicidades, Timeline Nacional, Digital Twin, Strategic Planning, Scenario Planner, Advanced GIS, Executive Reports, Executive Workspace, Satellite Intelligence, Data Trust, Sentinel Core. Não há roteamento por URL (`/mission`, `/dashboard`, etc.) — trocar de aba não altera a URL nem é "deep-linkável"; um usuário não pode compartilhar um link direto para uma aba específica, e o botão "voltar" do navegador não navega entre abas.

## 2. Header, sidebar, footer

- **Header**: barra superior fixa (`topbar`) com marca "Leonidas Tech / Sentinel-1 Enterprise", texto central "Telecom Intelligence Center" e indicador de status "SQLite Online · Local Build" — este indicador é **estático no código** (não reflete o status real de conexão do banco em tempo real).
- **Sidebar**: não há sidebar lateral fixa apesar do `CHANGELOG.md` (Sprint 7) mencionar "Sidebar lateral fixa" — a navegação encontrada em `Dashboard.tsx` é uma barra de abas horizontal (`nav.view-tabs`), não uma sidebar vertical. **Pequena divergência entre documentação de Sprint 7 e o componente `Dashboard.tsx` root revisado** — pode ser que a sidebar exista em outro componente não priorizado nesta leitura; recomenda-se confirmação visual em navegador antes do Stage 0.
- **Footer**: presente (`<footer>`), estático, mostra nome do produto e contagem total de registros.

## 3. Estados de carregamento, vazio e erro

- **Loading**: `Dashboard.tsx` usa um estado booleano simples (`loading`) que aplica uma classe CSS `muted` nos cards executivos — não há skeleton screens nem spinners dedicados por seção; o mapa usa `next/dynamic` com uma mensagem de texto simples ("Carregando camada geografica...") como fallback de SSR.
- **Erro**: existe uma seção `<section className="error">{error}</section>` genérica que mostra a mensagem de erro crua vinda da API (`e.message`) — não há diferenciação visual entre tipos de erro (rede vs. dados ausentes vs. banco indisponível), e a mensagem não é amigável para usuário final em todos os casos (ex.: erros de banco batem diretamente na tela).
- **Vazio**: não foi encontrado tratamento explícito de "nenhum resultado encontrado" na tabela principal — se um filtro não retornar linhas, a tabela simplesmente renderiza vazia sem mensagem orientativa.

## 4. Acessibilidade

- Uso de `role="dialog"` e `aria-modal="true"` no painel lateral de Site Intelligence (`SiteIntelligencePanel`) — positivo, é o único ponto de ARIA explícito encontrado.
- `nav` da barra de abas tem `aria-label="Visoes do LeoTechScan"` — positivo.
- **Não foram encontrados**: `alt` em imagens (não há `<img>` relevantes fora do mapa), indicação de foco visível customizada, navegação por teclado testada, ou uso de `aria-live` para atualizações assíncronas (ex.: quando dados do dashboard terminam de carregar, leitores de tela não são notificados).
- Contraste de cor não pôde ser auditado programaticamente sem renderizar no navegador; o tema é "Enterprise Dark" (fundo escuro, destaques ciano/vermelho/amarelo/verde) — recomenda-se verificação de contraste WCAG AA em uma passada visual dedicada (fora do escopo desta auditoria de código).

## 5. Performance de tabela e mapa

- Tabela principal é paginada no servidor (30 linhas/página) — bom para performance do DOM.
- Mapa: ver `08_GIS_AUDIT.md` — sem clustering, renderiza até 4.000 `CircleMarker` simultâneos no modo "todos os pontos" do Mission Control, o que é aceitável mas não otimizado para os 299 mil registros totais caso o cap seja removido no futuro.
- Buscas (`q=`) disparam nova requisição a cada tecla digitada (não há debounce visível no código de `Dashboard.tsx` — `onChange` chama `setQuery` diretamente, e o `useEffect` de `load()` depende de `requestParams`, que muda a cada caractere). **Isso gera uma requisição HTTP completa por tecla digitada** — candidato certo a otimização (debounce de 300-500ms) no Stage 0/1 do roadmap.

## 6. Consistência terminológica e falsa precisão

Este é um achado transversal importante para UX enterprise:

- **A palavra "Sentinel" é usada em três sentidos completamente diferentes e não relacionados** dentro da mesma aplicação:
  1. **Sentinel-1** — o satélite real da Copernicus/ESA (contexto de `copernicus-engine.ts`).
  2. **Sentinel Core / Sentinel Intelligence Graph (SIG)** — um grafo de conhecimento interno sobre sites/municípios/operadoras, sem nenhuma relação com satélites (`sentinel-core/**`).
  3. **Sentinel Risk Index (SRI)** e regras em `sentinel_rules.json`/`sentinel-scoring.ts` — um índice de risco de mercado telecom por município, também sem relação com satélites.
  
  Um usuário lendo "Sentinel Core Status" no Mission Control pode razoavelmente presumir que se refere a status de dados de satélite Sentinel-1 — não se refere. Esta sobreposição de nome é uma fonte real de confusão que deve ser resolvida antes de qualquer divulgação externa (renomear pelo menos dois dos três usos).

- **Scores numéricos (LTS, TCI, OPI, SRI, ORI, Trust Score, Confidence)** são todos apresentados como números de 0–100 com aparência de precisão estatística, mas são **fórmulas ponderadas determinísticas simples** (soma linear de razões, sem validação estatística externa, sem intervalo de confiança). A UI não comunica essa natureza — por exemplo, "Trust Score 85" aparece com a mesma autoridade visual que uma métrica validada empiricamente. Isso é uma forma de **falsa precisão** que deve ser endereçada (ex.: adicionar tooltip "estimativa baseada em regras, não validada estatisticamente" — o texto de rodapé já existe em alguns lugares como `governance` strings retornadas pela API, mas não é evidenciado com destaque visual equivalente ao do número).

- **Distinção observado / derivado / inferido / simulado**: o código já rotula corretamente em nível de dado (`mode: "mock_metadata_only"`, textos de `governance`/`disclaimer` retornados pelas APIs de Copernicus e Data Trust), mas **essa distinção nem sempre chega à interface com destaque equivalente ao dado principal** — os textos de governança existem nos payloads de API mas a revisão de componente não confirma renderização proeminente deles em todas as telas (ex.: `CopernicusModules.tsx` precisaria ser inspecionado tela a tela para confirmar se o aviso "modo mock" aparece com destaque visual ou apenas como texto pequeno).

## 7. Achados-chave desta fase

1. Navegação sem URL/roteamento — 20 abas não são deep-linkáveis nem respeitam o botão voltar do navegador.
2. Busca sem debounce — gera 1 requisição HTTP por tecla digitada.
3. Estados de vazio não tratados explicitamente na tabela principal.
4. Acessibilidade mínima — apenas 2 pontos de ARIA encontrados em todo o código revisado; recomenda-se auditoria visual dedicada com leitor de tela antes de qualquer certificação de acessibilidade.
5. **Confusão terminológica "Sentinel"** usada para 3 conceitos não relacionados é o achado de UX mais importante — risco real de mal-entendido por parte de usuários e stakeholders sobre o que é de fato capacidade satelital.
6. Falsa precisão em scores determinísticos apresentados com autoridade visual de métrica validada.
