# Ideias — supabase-pwn

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
- [ ] **Persistir o histórico de requests** (P) — igual ao log, hoje some no F5; salvar no localStorage · `lib/supabase-context.tsx` · _proposta_
- [x] **Dashboard de Recon** (M) — aba inicial com overview + atalhos · _feita_
- [x] **Marcar buckets sensíveis no seletor do Storage** (P) — badge 🔎 no dropdown · _feita_
- [x] **Últimas pistas no dashboard** (P) — card "Recent clues" · _feita_

## 2026-09-23 · robustez
- [x] **Testes das funções puras de detecção** (M) — vitest + 30 testes em sensitive/curl/findings · _feita_
- [ ] **CI rodando test + tsc + eslint** (P) — trava regressões automaticamente; **bloqueado pelo mesmo billing do GitHub Actions** (ver PENDENTE) — o workflow é trivial de adicionar quando o billing voltar · `.github/workflows/` · _blocked_

## 2026-09-23 · backlog de DESIGN / UX (blueprint)
Momentos de impacto (autoridade):
- [ ] **Sequência de boot no load** (M) — header/title-block e datum corners "desenham" na entrada; entrada de linha no log (`@starting-style`); tudo sob `prefers-reduced-motion`. É o "brilho" premium · shell/header/output-log · _proposta_
- [ ] **HUD de scan ao vivo** (M) — durante o AutoPwn: progresso por fase em segmentos + readout do item atual + retículo pulsando (reusa scan-sweep). Transforma o momento-chave · `autopwn.tsx` · _proposta_
- [ ] **"Target locked" ao conectar** (P) — micro-transição STANDBY→ARMED no header (âmbar acende) confirmando a conexão com peso · `header.tsx` · _proposta_

Consistência & clareza:
- [ ] **Toasts no tema** (P) — estilizar o sonner (mono, cantos retos, cor por tipo); hoje destoa do blueprint · `components/ui/sonner.tsx` · _proposta_
- [ ] **Skeletons esquemáticos** (P-M) — áreas de resultado (SELECT/RPC/scan) com placeholder + scan-sweep em vez de "pop"; comunica trabalho · telas de resultado · _proposta_
- [ ] **Empty states com CTA por aba** (P) — Database sem tabela / Storage sem bucket viram blueprint com ação ("Bruteforce tables") em vez de texto solto · database/storage · _proposta_
- [ ] **Retículo nos focos que faltam** (P) — canal ativo (realtime) e bucket conectado (storage) ganham o mesmo frame de foco da tabela do DB · realtime/storage · _proposta_

Ferramenta pro:
- [ ] **Command palette ⌘K** (M) — pular abas, conectar, run scan, focar tabela; cara de instrumento sério · nova peça · _proposta_
- [ ] **JSON colapsável** (M) — nós recolhíveis + copiar por nó no JsonViewer (payloads grandes) · `shared/json-viewer.tsx` · _proposta_

## ⏸️ PENDENTE (bloqueado — ação de conta, não código)
- [ ] **Publicar imagem no GHCR** — a Action (`.github/workflows/docker.yml`) está pronta mas o **GitHub Actions está bloqueado por billing** na conta. Destravar: resolver billing (Settings → Billing) → Action publica no push → tornar o package GHCR público. Alternativa sem Actions: PAT com `write:packages` e publicar manualmente. _blocked_

## 2026-09-23 · a partir de "Instalador local de um comando"
- [ ] **Imagem publicada no GHCR (GitHub Action)** (M) — hoje o install builda o source localmente (~1-2min + precisa do repo); uma Action que builda e publica `ghcr.io/berodcdev/supabase-pwn:latest` deixaria o install só `docker run` da imagem, sem clonar/buildar — é o que torna a ferramenta distribuível de verdade · `.github/workflows/`, `install.sh` · _proposta_
- [ ] **`install.sh --uninstall`** (P) — ferramenta boa também sai limpo: `compose down` + remove imagem/volume; hoje só tem instalar/atualizar · `install.sh` · _proposta_
- [ ] **One-liner `curl | bash`** (P) — o ápice do "um comando": `curl -fsSL .../install.sh | bash` que clona+roda; depende de tornar o repo público (ou servir o script como release asset) · `install.sh`, `README.md` · _proposta_

## 2026-09-23 · a partir de "Deploy na VPS srv1 (Traefik + Authelia)"
- [ ] **Auto-deploy no push** (M) — deploy key + repo já configurados; um `git pull && docker compose -f docker-compose.srv1.yml up -d --build` via webhook/cron fecharia o ciclo · `srv1` · _proposta_
- [ ] **IPAllowList no Traefik antes do Authelia** (P) — encadear um middleware de IP allowlist antes do `authelia@docker` corta scan automatizado antes do login · `docker-compose.srv1.yml` · _proposta_
- [ ] **Healthcheck válido do Authelia** (P) — hoje está desabilitado; um healthcheck correto (HTTP no /api/health) reativa restart-on-unhealthy sem travar o Traefik · `docker-compose.srv1.yml` · _proposta_

## 2026-09-23 · a partir de "Stack de produção: Caddy + Authelia + app"
- [ ] **Healthcheck no serviço do app** (P) — o compose tem healthcheck no Authelia, mas o app não; um `/api/health` + healthcheck faz o `restart: unless-stopped` e o `depends_on` valerem de verdade · `app/api/health/route.ts`, `docker-compose.prod.yml` · _proposta_
- [ ] **Allowlist de IP no Caddy** (P) — pra uma ferramenta ofensiva pública, limitar por IP de origem no Caddy (além do OTP) corta scan automatizado antes do login · `deploy/Caddyfile` · _proposta_

## 2026-09-23 · a partir de "Findings clicáveis + colunas sensíveis + delta"
- [x] **Botão "Limpar scans salvos"** (P) — botão "Clear" chama `clearScanHistory` (remove também as amostras PII do localStorage) · _feita_
- [x] **Navegar o histórico de scans** (M) — `loadScanHistory` + seletor "Saved scans" que abre um scan antigo em modo read-only reusando o painel/findings · _feita_

## 2026-09-23 · a partir de "Ferramenta mais automática: findings, auto-scan, presets"
- [x] **Realçar colunas sensíveis na amostra exposta** (P) — `isSensitiveColumn` em `lib/sensitive.ts`; badges PII vermelhos na expansão da tabela DB · _feita_
- [x] **Clicar no finding → pular para a tabela/bucket** (M) — `focusTarget`/`focusOn` no contexto; findings de database/storage clicáveis abrem a aba certa já selecionada · _feita_
- [x] **Novos findings no diff entre scans** (M) — card "Findings changes" com novos (vermelho) e corrigidos (verde, riscado) via `deriveFindings` nos dois records · _feita_

## 2026-09-23 · a partir de "Extract não acha config Supabase em apps Vite/Next"
- [ ] **Seguir chunks importados dentro de outros chunks (1 nível)** (M) — hoje varremos os `.js` do HTML mas não os `.js` que esses scripts importam; a config costuma estar num chunk lazy; reusa a via de fetch/scan recém-ampliada · `app/api/extract-config/route.ts` · _proposta_
- [ ] **Detectar Supabase self-hosted / domínio custom** (M) — a regex só pega `*.supabase.co|in`; capturar `createClient("url","key")` cobriria instâncias self-hosted que hoje passam batido · `app/api/extract-config/route.ts` · _proposta_
- [ ] **Mostrar resumo da varredura no sucesso** (P) — a API já devolve `scannedScripts`/`scannedEntries`, mas só aparece no erro; exibir sempre dá confiança no que foi coberto · `components/supabase-pwn/init-form.tsx` · _proposta_

## 2026-09-23 · a partir de "Enriquecer painel de logs e resultados de RLS do AutoPwn"
- [~] **Sinalizar colunas sensíveis nos dados expostos** — nível-finding FEITO (a `lib/sensitive.ts` escala achados de tabela para CRÍTICO quando há PII); resta só realçar os badges de coluna sensível na expansão da tabela DB (P, ver seção de findings)
- [ ] **Expandir também as outras tabelas do AutoPwn** (P) — o `DataTable` ganhou `renderExpanded` mas só 1 de 4 tabelas usa; os detalhes de Auth estão truncados (autopwn.tsx:1805) e storage/functions poderiam expandir · `components/supabase-pwn/autopwn.tsx` · _proposta_
- [ ] **Amostra com mais de 1 linha** (P) — o probe usa `limit(1)`; para tabelas expostas, buscar as primeiras ~5 linhas dá uma amostra bem mais útil do que vazou (mesma via de captura já criada) · `components/supabase-pwn/autopwn.tsx` · _proposta_

## 2026-09-23 · a partir de "Corrigir barra sumindo ao digitar URL no campo Extract"
- [x] **Blindar o Textarea no primitivo** (P) — atributos anti-extensão movidos para `components/ui/textarea.tsx`; os 9 `<Textarea>` do app herdam e os duplicados saíram do campo Extract · `components/ui/textarea.tsx` · _feita_

## 2026-09-23 · a partir de "Reforma visual instrument-grade (dark-only)"
- [ ] **Propagar SectionHeader** (P) — criei o componente mas só `edge-functions` usa; database/storage/realtime/autopwn ainda têm cabeçalho ad-hoc (1 de ~5 telas) · `components/supabase-pwn/shared/section-header.tsx` · _proposta_
- [ ] **Completar o ReticlePanel nos pontos de foco** (P) — o plano pedia retículo no canal ativo (realtime) e no bucket conectado (storage); ambos com 0 ocorrências hoje · `components/supabase-pwn/realtime.tsx`, `storage-explorer.tsx` · _proposta_
- [ ] **JsonViewer colapsável** (M) — a API planejada previa `collapsible`/`defaultCollapsed`, não implementada; payloads grandes aparecem em ~5 telas (SELECT do DB, event stream) sem poder recolher · `components/supabase-pwn/shared/json-viewer.tsx` · _proposta_

## 2026-09-23 · a partir de "Dockerizar a ferramenta (modo usar) + dev local seguro"
- [ ] **Seção Docker no README** (P) — o `README.md` só ensina `npm run dev`; 0 menções ao fluxo `docker compose` que acabou de entrar · `README.md` · _proposta_
- [ ] **Fixar versão de Node** (P) — dev nativo roda em v25 (ímpar) e o container em 22 LTS; sem `engines` no `package.json`, 2 ambientes divergentes · `package.json` · _proposta_
- [ ] **compose.dev com hot reload no Linux** (M) — no Linux o file-watching do Docker é nativo; um `docker-compose.dev.yml` com volume permitiria evoluir dentro do container em 1 das 2 máquinas · `docker-compose.dev.yml` · _proposta_

## 2026-09-23 · a partir de "Zerar erros e warnings de tsc/eslint"
- [x] **Script `typecheck`** (P) — adicionado `"typecheck": "tsc --noEmit"` ao `package.json` junto do setup Docker · _feita_
- [ ] **CI rodando tsc + eslint** (M) — não existe `.github/workflows`; um gate impediria um erro como o de hoje de entrar (0 gates hoje) · `.github/workflows/` · _proposta_
- [ ] **Revisar os 3 casts `as any`** (P) — burlam justamente o checker que pegou o bug; 3 ocorrências no código · _proposta_

## 2026-09-23 · a partir de "Corrigir crypto.randomUUID is not a function"
- [x] **Corrigir o único erro de tsc** (P) — tipado `r.data` em `lib/supabase-context.tsx`; junto zeramos tsc e eslint · _feita_
- [ ] **Configurar allowedDevOrigins** (P) — você acessa por IP público (54.232.189.113); o Next já loga o aviso de cross-origin e uma major futura vai bloquear `/_next/*` · `next.config.ts` · _proposta_
- [ ] **Unificar domínio do probe email** (P) — o commit recente padronizou em `@iapapi.com`, mas `database-explorer.tsx:70` ainda usa `@j5.no`; 2 domínios hardcoded em 2 arquivos · `components/supabase-pwn/database-explorer.tsx` · _proposta_
