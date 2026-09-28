# Ideias — supasec

Gerado pela skill `sugerir`. Status: proposta · aceita · descartada · feita.
Ideia descartada não volta a ser sugerida; o motivo fica registrado.

## 2026-09-23 · a partir de "Bruteforce sinaliza pistas sensíveis no log"
- [x] **Marcar tabelas sensíveis no seletor do DB** (P) — badge 🔎 no dropdown + colunas sensíveis em vermelho · _feita_
- [x] **Pistas no bruteforce de buckets (Storage)** (P) — bucket público / nome sensível vira CLUE no log · _feita_
- [x] **Resumo de pistas no fim do bruteforce** (P) — contador "🔎 K clue(s) flagged" no resumo · _feita_

## 2026-09-23 · a partir de "Pistas: badge no DB, CLUE em buckets, contador"
- [x] **Detectar segredos nos VALORES da amostra** (M) — `flagSensitiveValues` (JWT, keys, cartão, email, bcrypt) no bruteforce e nos findings · _feita_
- [x] **Bruteforce de colunas sensíveis** (M) — 3ª passada testa `select=<col>` em tabelas RLS-bloqueadas e loga CLUE · _feita_
- [x] **Filtro "🔎 clues" no Output Log** (P) — chip que filtra só as pistas · _feita_

## 2026-09-23 · a partir de "Segredos em valores + bruteforce de colunas + filtro"
- [x] **Pistas em nomes de arquivo no Storage** (P) — `sensitiveFileHint` sinaliza `.env`/backup/dump/etc ao listar · _feita_
- [x] **Decodificar JWTs achados nos valores** (M) — `describeJwtsInRow` mostra role/exp; service_role vazado vira CRITICAL · _feita_
- [x] **Exportar só as pistas** (P) — botão de copiar CLUE no Output Log · _feita_

## 2026-09-23 · a partir de "Arquivos no Storage + decode JWT + copiar clues"
- [x] **Escanear respostas de RPC/Edge/Realtime por segredos** (M) — `scanJsonForSecrets` nas 3 telas · _feita_
- [x] **Role do JWT nos findings/export do AutoPwn** (P) — `describeJwtsInRow` na evidência do finding · _feita_

## 2026-09-23 · outra área do produto (reporting / reprodutibilidade / discovery-UX)
- [x] **Copy-as-curl em cada operação** (M) — botão `curl` em DB (SELECT/INSERT/UPDATE/DELETE/RPC) e edge · _feita_
- [x] **Relatório de sessão consolidado** (M) — "Export session report (.md)" no Output Log · _feita_
- [x] **Descoberta de Edge Functions na própria aba** (P) — botão Discover + chips · _feita_

## 2026-09-23 · reprodutibilidade / persistência
- [x] **Copy-as-curl no Storage** (P) — curl em List/Download/Public/Signed · _feita_
- [x] **Persistir o log entre reloads** (P) — localStorage, últimas 500 · _feita_
- [x] **Histórico de requests com replay** (M) — painel com copy-curl + Replay (leituras) · _feita_

## 2026-09-23 · visão geral / consistência
- [x] **Persistir o histórico de requests** (P) — já implementado com localStorage hydrate/save · _feita_
- [x] **Dashboard de Recon** (M) — aba inicial com overview + atalhos · _feita_
- [x] **Marcar buckets sensíveis no seletor do Storage** (P) — badge 🔎 no dropdown · _feita_
- [x] **Últimas pistas no dashboard** (P) — card "Recent clues" · _feita_

## 2026-09-23 · robustez
- [x] **Testes das funções puras de detecção** (M) — vitest + 30 testes em sensitive/curl/findings · _feita_
- [ ] **CI rodando test + tsc + eslint** (P) — trava regressões automaticamente; **bloqueado pelo mesmo billing do GitHub Actions** (ver PENDENTE) — o workflow é trivial de adicionar quando o billing voltar · `.github/workflows/` · _blocked_

## 2026-09-23 · backlog de DESIGN / UX (blueprint)
Momentos de impacto (autoridade):
- [x] **Sequência de boot no load** (M) — boot-fade-up no header/conexão + datum corners escalonados + entrada de linha no log · _feita_
- [x] **HUD de scan ao vivo** (M) — faixa de fases done/active(âmbar+sweep)/pending + readout · _feita_
- [x] **"Target locked" ao conectar** (P) — STATUS STANDBY→ARMED com glow · _feita_

Consistência & clareza:
- [x] **Toasts no tema** (P) — sonner mono/retos/cor por tipo · _feita_
- [x] **Skeletons esquemáticos** (P-M) — ResultSkeleton com scan-sweep em SELECT/Edge · _feita_ (RPC opcional depois)
- [x] **Empty states com CTA por aba** (P) — "No table/bucket selected" em blueprint · _feita_
- [x] **Retículo nos focos que faltam** (P) — bucket (storage) e canal (realtime) · _feita_

Ferramenta pro:
- [x] **Command palette ⌘K** (M) — pular abas, conectar, run scan, focar tabela; cara de instrumento sério · _feita_
- [x] **JSON colapsável** (M) — JsonViewer com expand/collapse recursivo + item count · _feita_

## 2026-09-24 · backlog de FEATURES
Assessment Supabase-specific (maior valor):
- [x] **Relationship traversal / embedding** (M) — seletor "Embed" no SELECT anexa `,<tabela>(*)` · _feita_
- [x] **Analisador de políticas RLS** (M) — `lib/rls.ts`; badge de severidade + fraquezas por policy · _feita_
- [x] **Teste de mass-assignment / escalonamento** (P-M) — botão Escalate + detecção de CLUE no INSERT · _feita_
- [ ] **Probing de pg_graphql** (M) — Supabase expõe `/graphql/v1`; introspection + queries revelam superfície que o REST às vezes esconde · nova aba/peça · _proposta_

Cobertura & workflow:
- [x] **Enumeração profunda de storage + bulk** (M) — Deep Scan recursivo + Bulk Download no storage explorer · _feita_
- [ ] **Realtime sweep** (M) — testar postgres_changes em todas as tabelas de uma vez (realtime às vezes entrega o que o SELECT bloqueia) · realtime + autopwn · _proposta_
- [ ] **Multi-target workspace** (G) — gerenciar vários alvos e alternar; hoje é um por vez · shell/contexto · _proposta_
- [x] **Wordlists gerenciáveis** (P) — save/load/delete no localStorage para tabelas e buckets; dropdown + save/trash nos campos de wordlist · _feita_

## ⏸️ PENDENTE (bloqueado — ação de conta, não código)
- [ ] **Publicar imagem no GHCR** — a Action (`.github/workflows/docker.yml`) está pronta mas o **GitHub Actions está bloqueado por billing** na conta. Destravar: resolver billing (Settings → Billing) → Action publica no push → tornar o package GHCR público. Alternativa sem Actions: PAT com `write:packages` e publicar manualmente. _blocked_

## 2026-09-23 · a partir de "Instalador local de um comando"
- [ ] **Imagem publicada no GHCR (GitHub Action)** (M) — hoje o install builda o source localmente (~1-2min + precisa do repo); uma Action que builda e publica `ghcr.io/berodcdev/supasec:latest` deixaria o install só `docker run` da imagem, sem clonar/buildar — é o que torna a ferramenta distribuível de verdade · `.github/workflows/`, `install.sh` · _proposta_
- [x] **`install.sh --uninstall`** (P) — compose down + remove imagem/volume/cache + opção de deletar pasta · _feita_
- [ ] **One-liner `curl | bash`** (P) — o ápice do "um comando": `curl -fsSL .../install.sh | bash` que clona+roda; depende de tornar o repo público (ou servir o script como release asset) · `install.sh`, `README.md` · _proposta_

## 2026-09-23 · a partir de "Deploy na VPS srv1 (Traefik + Authelia)"
- [ ] **Auto-deploy no push** (M) — deploy key + repo já configurados; um `git pull && docker compose -f docker-compose.srv1.yml up -d --build` via webhook/cron fecharia o ciclo · `srv1` · _proposta_
- [ ] **IPAllowList no Traefik antes do Authelia** (P) — encadear um middleware de IP allowlist antes do `authelia@docker` corta scan automatizado antes do login · `docker-compose.srv1.yml` · _proposta_
- [ ] **Healthcheck válido do Authelia** (P) — hoje está desabilitado; um healthcheck correto (HTTP no /api/health) reativa restart-on-unhealthy sem travar o Traefik · `docker-compose.srv1.yml` · _proposta_

## 2026-09-23 · a partir de "Stack de produção: Caddy + Authelia + app"
- [x] **Healthcheck no serviço do app** (P) — `/api/health` + healthcheck em ambos os compose (prod + srv1) + `depends_on: condition: service_healthy` no Caddy · _feita_
- [ ] **Allowlist de IP no Caddy** (P) — pra uma ferramenta ofensiva pública, limitar por IP de origem no Caddy (além do OTP) corta scan automatizado antes do login · `deploy/Caddyfile` · _proposta_

## 2026-09-23 · a partir de "Findings clicáveis + colunas sensíveis + delta"
- [x] **Botão "Limpar scans salvos"** (P) — botão "Clear" chama `clearScanHistory` (remove também as amostras PII do localStorage) · _feita_
- [x] **Navegar o histórico de scans** (M) — `loadScanHistory` + seletor "Saved scans" que abre um scan antigo em modo read-only reusando o painel/findings · _feita_

## 2026-09-23 · a partir de "Ferramenta mais automática: findings, auto-scan, presets"
- [x] **Realçar colunas sensíveis na amostra exposta** (P) — `isSensitiveColumn` em `lib/sensitive.ts`; badges PII vermelhos na expansão da tabela DB · _feita_
- [x] **Clicar no finding → pular para a tabela/bucket** (M) — `focusTarget`/`focusOn` no contexto; findings de database/storage clicáveis abrem a aba certa já selecionada · _feita_
- [x] **Novos findings no diff entre scans** (M) — card "Findings changes" com novos (vermelho) e corrigidos (verde, riscado) via `deriveFindings` nos dois records · _feita_

## 2026-09-23 · a partir de "Extract não acha config Supabase em apps Vite/Next"
- [x] **Seguir chunks importados dentro de outros chunks (1 nível)** (M) — import() dinâmico resolvido e varrido · _feita_
- [x] **Detectar Supabase self-hosted / domínio custom** (M) — createClient() + env vars + chunk following · _feita_
- [x] **Mostrar resumo da varredura no sucesso** (P) — toast inclui "scanned N script(s) across M page(s)" em todos os caminhos de sucesso · _feita_

## 2026-09-23 · a partir de "Enriquecer painel de logs e resultados de RLS do AutoPwn"
- [~] **Sinalizar colunas sensíveis nos dados expostos** — nível-finding FEITO (a `lib/sensitive.ts` escala achados de tabela para CRÍTICO quando há PII); resta só realçar os badges de coluna sensível na expansão da tabela DB (P, ver seção de findings)
- [x] **Expandir também as outras tabelas do AutoPwn** (P) — `renderExpanded` em Storage (public/listable), Auth (detalhes sem truncar), Edge Functions (HTTP status + contexto), Realtime (explicação de bypass) · _feita_
- [x] **Amostra com mais de 1 linha** (P) — probe agora usa `limit(5)`, sample mostra até 5 linhas com label dinâmico · _feita_

## 2026-09-23 · a partir de "Corrigir barra sumindo ao digitar URL no campo Extract"
- [x] **Blindar o Textarea no primitivo** (P) — atributos anti-extensão movidos para `components/ui/textarea.tsx`; os 9 `<Textarea>` do app herdam e os duplicados saíram do campo Extract · `components/ui/textarea.tsx` · _feita_

## 2026-09-23 · a partir de "Reforma visual instrument-grade (dark-only)"
- [x] **Propagar SectionHeader** (P) — propagado para database, storage, realtime, autopwn e auth (5 telas) · _feita_
- [x] **Completar o ReticlePanel nos pontos de foco** (P) — já implementado em sessão anterior: realtime.tsx:806 e storage-explorer.tsx:817 · _feita_
- [x] **JsonViewer colapsável** (M) — `wrapperCollapsible` com summary (`{…} N keys` / `[…] N items`), propagado para autopwn (defaultCollapsed), realtime e database-explorer · _feita_

## 2026-09-23 · a partir de "Dockerizar a ferramenta (modo usar) + dev local seguro"
- [x] **Seção Docker no README** (P) — README reescrito com install.sh, Docker, e deploy (Caddy + Traefik) · _feita_
- [x] **Fixar versão de Node** (P) — `engines.node >= 22` no package.json · _feita_
- [ ] **compose.dev com hot reload no Linux** (M) — no Linux o file-watching do Docker é nativo; um `docker-compose.dev.yml` com volume permitiria evoluir dentro do container em 1 das 2 máquinas · `docker-compose.dev.yml` · _proposta_

## 2026-09-23 · a partir de "Zerar erros e warnings de tsc/eslint"
- [x] **Script `typecheck`** (P) — adicionado `"typecheck": "tsc --noEmit"` ao `package.json` junto do setup Docker · _feita_
- [ ] **CI rodando tsc + eslint** (M) — não existe `.github/workflows`; um gate impediria um erro como o de hoje de entrar (0 gates hoje) · `.github/workflows/` · _proposta_
- [x] **Revisar os 5 casts `as any`** (P) — removidos todos os 5 casts em autopwn.tsx; eram desnecessários (SupabaseClient já default `Database = any`) · _feita_

## 2026-09-23 · a partir de "Corrigir crypto.randomUUID is not a function"
- [x] **Corrigir o único erro de tsc** (P) — tipado `r.data` em `lib/supabase-context.tsx`; junto zeramos tsc e eslint · _feita_
- [x] **Configurar allowedDevOrigins** (P) — localhost e 127.0.0.1 permitidos no next.config.ts · _feita_
- [x] **Unificar domínio do probe email** (P) — `@j5.no` → `@iapapi.com` · _feita_

## 2026-09-24 · a partir de "GraphQL Explorer + AI Analysis + Ask AI per finding"
- [x] **Probing de pg_graphql** (M) — aba GraphQL com introspection, schema browser, query editor e security findings · _feita_
- [x] **Realtime sweep no AutoPwn** (M) — duplicata; já feito (ver abaixo) · _feita_
- [x] **GraphQL findings no AutoPwn** (M) — duplicata; já feito (ver abaixo) · _feita_
- [x] **Report HTML/PDF exportável** (G) — AI analysis (summary, verdicts, chains, remediations) integrada nos reports HTML e Markdown · _feita_

## 2026-09-24 · a partir de "Configuração visual premium de OpenRouter API"
- [x] **Dialog visual premium de OpenRouter** (M) — model cards com tiers, test de conexão, show/hide key, recomendações · _feita_
- [x] **Realtime sweep no AutoPwn** (M) — teste de postgres_changes em todas as tabelas, findings de bypass RLS · _feita_
- [x] **GraphQL findings no AutoPwn** (M) — introspection + INSERT/DELETE mutations integradas no scan automático · _feita_
