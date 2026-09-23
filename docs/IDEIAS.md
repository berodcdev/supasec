# Ideias — supabase-pwn

Gerado pela skill `sugerir`. Status: proposta · aceita · descartada · feita.
Ideia descartada não volta a ser sugerida; o motivo fica registrado.

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
