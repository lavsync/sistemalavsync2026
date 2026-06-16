# 🚚 MIGRAÇÃO — Mídia Indoor (Xô Varal) → Módulo Marketing do LavSync

> **Runbook mestre de execução.** Escrito para o terminal que vai rodar a migração.
> Origem: `~/xovaral` (Supabase `mnonhgeumgsksnppwyuo`, prod `midindoor.grupoescalize.com.br`).
> Destino: `~/lavsync` (Supabase `yjesmmuoqrlteclwtfqn`, prod `sistema.lavsync.com.br`).
> Última atualização: 2026-06-16.

---

## 0. Decisões travadas (não reabrir sem avisar o Daniel)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Banco de dados | **Consolidar no Supabase do LavSync.** 15 tabelas + `editor_templates` viram `mi_*`, ganham `tenant_id`, RLS reescrita no padrão LavSync. Dados migrados. |
| 2 | Domínio / Player TV / QR | **Mover tudo pro domínio LavSync** (`sistema.lavsync.com.br`). QR impressos e TVs Chromecast SERÃO reconfigurados/reimpressos. |
| 3 | Escopo | **100%** — admin + portal do parceiro (auth própria) + sites públicos + Player TV. |
| 4 | Entrega | Runbook (este doc) + migração de código iniciada no repo LavSync. |

**Regras herdadas do LavSync (obrigatórias):**
- IA do sistema é **CLOCK** — NUNCA "Selly" (Selly é do Ecommseller).
- Git author dos commits: **`ferramentaslavsync@gmail.com`**.
- Deploy **manual via CLI** (auto-deploy GitHub→Vercel está quebrado).
- Sem emojis na UI (usar lucide icons). Exceção: templates de WhatsApp.
- `next.config.ts`: `serverActions.bodySizeLimit: "10mb"` (uploads grandes).
- Timezone São Paulo via `src/lib/timezone-br.ts` em queries de "hoje".
- Helper `paginarTodos()` em queries que iteram tudo (Supabase limita 1000 por padrão).
- **Next.js 16 tem breaking changes** — consultar `node_modules/next/dist/docs/` antes de escrever rotas (ver `AGENTS.md` do LavSync).

---

## 1. Arquitetura alvo

```
LavSync (sistema.lavsync.com.br)
└── Marketing (/publicidade) ──► já existe no nav (group "operacional")
    └── Mídia Indoor  ───────────► NOVO MÓDULO
        ├── /publicidade/midia-indoor                (dashboard do módulo)
        ├── /publicidade/midia-indoor/templates      (editor Canva-style)
        ├── /publicidade/midia-indoor/campanhas
        ├── /publicidade/midia-indoor/ofertas
        ├── /publicidade/midia-indoor/parceiros
        ├── /publicidade/midia-indoor/unidades       (vincula às unidades LavSync)
        ├── /publicidade/midia-indoor/leads
        ├── /publicidade/midia-indoor/qr-codes
        └── /publicidade/midia-indoor/metricas
    │
    ├── PORTAL DO PARCEIRO (auth própria, fora do shell admin)
    │   └── /parceiro/*                               (login Magic Link + Google OAuth)
    │
    └── PÚBLICO (sem auth — liberado no proxy)
        ├── /m/[slug]/clube-de-beneficios            (site público por unidade)
        ├── /m/[slug]/oferta/[id]
        ├── /m/[slug]/parceiro/[partnerSlug]
        ├── /m/[slug]/quero-ser-parceiro
        ├── /player/[slug]?token=…                    (Player TV — modo kiosk)
        ├── /qr/[code]                                (redirect rastreado)
        └── /api/midia-indoor/*                        (playlist, track, upload, stocks, qr)
```

> **Por que prefixo `/m/` nas rotas públicas?** O Xô Varal usava `/[slug]/...` na raiz, que colidiria com rotas do LavSync. Prefixo `/m/` (de mídia) isola e simplifica o whitelist do proxy.

**Multi-tenancy:** o Mídia Indoor passa a viver sob o tenant único do LavSync (Xô Varal). As `units` do Xô Varal mapeiam para as `unidades` do LavSync:

| Xô Varal `units.slug` | LavSync `unidades.id` | nome |
|---|---|---|
| `xo-varal-buritis` | `10000000-0000-0000-0000-000000000001` | Buritis |
| (Castelo, se houver) | `10000000-0000-0000-0000-000000000002` | Castelo |
| (Cabral) | `10000000-0000-0000-0000-000000000003` | Cabral |
| (Anchieta) | `10000000-0000-0000-0000-000000000004` | Anchieta |

> ⚠️ As tabelas `mi_*` referenciam `public.unidades(id)` do LavSync via uma coluna `unidade_id`, **não** mais um `units` próprio. A tabela `mi_units` guarda só os atributos extras do Mídia Indoor (slug público, player_token, public_url) **ligados 1:1 a uma `unidade_id`**.

---

## 2. Inventário de origem (o que existe no Xô Varal)

### 2.1 Tabelas (16) — `~/xovaral/supabase/migrations/0001,0006,0007,0009,0010`
| Tabela origem | Chave de tenancy | Vira |
|---|---|---|
| `profiles` | role+unit_id+partner_id+permissions | **NÃO migra** → usar `public.usuarios` do LavSync (ver §6 Auth) |
| `units` | — | `mi_units` (1:1 com `unidades`) |
| `partner_categories` | global | `mi_partner_categories` (global, sem tenant) |
| `partners` | unit_id | `mi_partners` (+tenant_id, unidade_id) |
| `offers` | via partner | `mi_offers` (+tenant_id) |
| `templates` | global (system) | `mi_templates` (global) |
| `editor_templates` | unit_id+partner_id | `mi_editor_templates` (+tenant_id, unidade_id) |
| `campaigns` | unit_id | `mi_campaigns` (+tenant_id, unidade_id) |
| `club_members` | unit_id | `mi_club_members` (+tenant_id, unidade_id) |
| `partner_leads` | unit_id | `mi_partner_leads` (+tenant_id, unidade_id) |
| `qr_codes` | unit_id | `mi_qr_codes` (+tenant_id, unidade_id) |
| `player_sessions` | unit_id | `mi_player_sessions` (+tenant_id, unidade_id) |
| `campaign_impressions` | unit_id | `mi_campaign_impressions` (+tenant_id, unidade_id) |
| `qr_clicks` | unit_id | `mi_qr_clicks` (+tenant_id, unidade_id) |
| `settings` | global (master) | **mesclar** em `mi_settings` (key/value, com tenant_id) |

ENUMs origem (recriar com prefixo `mi_` p/ evitar colisão): `user_role`*, `campaign_priority` → `mi_campaign_priority`, `campaign_status` → `mi_campaign_status`, `partner_status` → `mi_partner_status`, `partner_plan` → `mi_partner_plan`, `offer_status` → `mi_offer_status`, `lead_status` → `mi_lead_status`.
> *`user_role` NÃO recriar — o papel "parceiro" é tratado em coluna na `usuarios` LavSync ou tabela de vínculo (ver §6).

### 2.2 Rotas (47) — origem → destino
| Origem (`~/xovaral/src/app`) | Destino (`~/lavsync/src/app`) |
|---|---|
| `(admin)/dashboard` | `(app)/publicidade/midia-indoor` (page index) |
| `(admin)/templates/**` | `(app)/publicidade/midia-indoor/templates/**` |
| `(admin)/campanhas/**` | `(app)/publicidade/midia-indoor/campanhas/**` |
| `(admin)/ofertas/**` | `(app)/publicidade/midia-indoor/ofertas/**` |
| `(admin)/parceiros/**` | `(app)/publicidade/midia-indoor/parceiros/**` |
| `(admin)/unidades/**` | `(app)/publicidade/midia-indoor/unidades/**` |
| `(admin)/leads` | `(app)/publicidade/midia-indoor/leads` |
| `(admin)/qr-codes` | `(app)/publicidade/midia-indoor/qr-codes` |
| `(admin)/metricas` | `(app)/publicidade/midia-indoor/metricas` |
| `(admin)/clube` | `(app)/publicidade/midia-indoor/clube` |
| `(admin)/configuracoes/**` | **descartar** — usar `/configuracoes` do LavSync (RBAC unificado) |
| `(auth)/login` | **descartar** — usar `/login` do LavSync |
| `(public)/[slug]/**` | `(public)/m/[slug]/**` |
| `parceiro/**` | `parceiro/**` (mantém; auth própria) |
| `player/[slug]` | `player/[slug]` |
| `qr/[code]` | `qr/[code]` |
| `api/player/**` | `api/midia-indoor/player/**` |
| `api/qr-codes/list` | `api/midia-indoor/qr-codes/list` |
| `api/stocks/search` | `api/midia-indoor/stocks/search` |
| `api/upload` | `api/midia-indoor/upload` |
| `page.tsx` (landing raiz) | **descartar** (raiz é o dashboard LavSync) |

### 2.3 Storage buckets (recriar no Supabase LavSync)
| Bucket | Limite | MIME |
|---|---|---|
| `logos` | 2 MB | png/jpeg/webp/svg |
| `banners` | 8 MB | png/jpeg/webp |
| `campaigns` | **200 MB** | png/jpeg/webp/mp4/webm |

> ⚠️ **Fix já aplicado no origem (commit `d9b9cee`)**: o painel de Uploads do editor agora roteia TODAS as imagens para `campaigns` (200MB) em vez de `banners` (8MB). Garantir que a versão portada para o LavSync seja a **corrigida** (`uploads-panel.tsx`), senão o bug de "imagem grande não salva" volta.

### 2.4 Env vars (origem → LavSync)
| Origem | Ação no LavSync |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | já existem (mesmo projeto agora) |
| `SUPABASE_SERVICE_ROLE_KEY` | já existe (`src/lib/supabase/admin.ts`) |
| `PEXELS_API_KEY` | **ADICIONAR** na Vercel LavSync (stocks do editor) |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | substituir uso por `https://sistema.lavsync.com.br` |

### 2.5 Integrações externas
- **Google OAuth** (portal do parceiro): hoje configurado no projeto GCP "Xovaral Local" com redirect pro domínio antigo. **Reconfigurar** redirect URIs para `sistema.lavsync.com.br/parceiro/auth/callback` no Supabase Auth + Google Cloud Console.
- **Pexels** (stocks de imagem no editor): só precisa da `PEXELS_API_KEY`.

---

## 3. Transformação de tabelas (regra geral)

Para CADA tabela `mi_*` (exceto globais `mi_partner_categories`, `mi_templates`):

```sql
-- 1. coluna de tenancy
tenant_id  uuid not null references public.tenants(id) on delete cascade,
unidade_id uuid references public.unidades(id) on delete cascade,  -- onde havia unit_id

-- 2. índices
create index on mi_<t>(tenant_id);
create index on mi_<t>(unidade_id);

-- 3. RLS no PADRÃO LAVSYNC (substitui os helpers xv_*)
alter table public.mi_<t> enable row level security;

-- escrita/leitura interna do tenant:
create policy mi_<t>_tenant on public.mi_<t>
  for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());
```

**Exceções de leitura pública** (player TV, sites de clube, QR — rodam como `anon`):
- `mi_units`, `mi_partners` (status ativo), `mi_offers` (status ativa), `mi_campaigns` (status ativa), `mi_qr_codes`, `mi_editor_templates` (publicados), `mi_partner_categories`, `mi_templates` → adicionar policy `for select to anon using (<condição pública>)`.
- `mi_club_members`, `mi_partner_leads` → policy `for insert to anon with check (...)` (formulários públicos).
- `mi_player_sessions`, `mi_campaign_impressions`, `mi_qr_clicks` → policy `for insert to anon with check (true)` (telemetria do player).

> Os helpers `xv_current_role / xv_current_unit_id / xv_is_master / xv_can_manage_unit` **NÃO são recriados**. Trocar todas as chamadas por `current_tenant_id()` / `is_master()`. O escopo por unidade (antes `xv_can_manage_unit`) agora é por `unidade_id` + filtro de UI (multi-unidade já existe no LavSync via `unidade-multi.ts`).

A migration completa fica em `supabase/migrations/0031_midia_indoor.sql` (gerada na Fase B).

---

## 4. Auth & papel "parceiro" (§6 detalhado)

O Xô Varal tinha 3 papéis: `master`, `gestor`, `parceiro`. No LavSync:
- `master` / `gestor` → já existem (RBAC LavSync, `public.usuarios` + permissões).
- **`parceiro`** → persona externa (comerciante do bairro). NÃO é usuário do shell admin. Opções:
  - **(Recomendado)** tabela `mi_partner_users` (vínculo `auth.users.id` ↔ `mi_partners.id` + tenant_id), e o portal `/parceiro/*` valida por essa tabela, sem entrar no RBAC do shell LavSync.
  - O trigger `handle_new_user` do Xô Varal (cria profile no 1º login) NÃO é portado. Em vez disso, o callback `/parceiro/auth/callback` cria/garante a linha em `mi_partner_users`.
- **Permissão de módulo:** adicionar "Mídia Indoor" ao RBAC do LavSync (ver `src/lib/permissoes` + `navigation.ts`) para master/gestor verem o submenu.

---

## 5. Domínio, Player TV e QR (operacional — Decisão #2)

Tudo passa a viver em `sistema.lavsync.com.br`. **Quebra o que já está na rua** — plano de corte:
1. Levantar lista de QR codes impressos e TVs/Chromecasts ativos (tabela `mi_qr_codes` + `mi_player_sessions` recentes).
2. Player TV: nova URL `https://sistema.lavsync.com.br/player/<slug>?token=<player_token>`. Reconfigurar cada Chromecast/kiosk.
3. QR codes: como o redirect `/qr/[code]` muda de host, **reimprimir** os QR (o `short_code` pode ser preservado na migração de dados, então o caminho `/qr/<code>` continua válido — só muda o domínio). Se preservar `short_code`, basta reimprimir com novo host; o destino interno continua rastreando.
4. (Opcional) Manter `midindoor.grupoescalize.com.br` no ar por um período como **redirect 301** → `sistema.lavsync.com.br` durante a transição física. Avaliar com o Daniel.

---

## 6. Ordem de execução (fases)

> Marcar cada passo. Não pular verificações. Rodar com `ferramentaslavsync@gmail.com` como git author.

### FASE A — Preparação (sem tocar produção)
- [ ] A1. Branch nova no LavSync: `git checkout -b feat/midia-indoor`.
- [ ] A2. Confirmar Supabase LavSync ativo (free tier pausa ~20d): `POST /v1/projects/yjesmmuoqrlteclwtfqn/restore` se necessário.
- [ ] A3. `npm ci` no `~/lavsync`. Build limpo de baseline: `npm run build`.
- [ ] A4. Dump dos dados de origem (backup): exportar via service_role todas as tabelas `public.*` do Supabase Xô Varal para JSON em `~/Desktop/midia-indoor-dump/`.

### FASE B — Banco (migration 0031)
- [ ] B1. Escrever `supabase/migrations/0031_midia_indoor.sql` (ENUMs `mi_*`, 15 tabelas `mi_*`, índices, RLS padrão LavSync, policies públicas).
- [ ] B2. Aplicar via PAT (Management API) — ver `feedback_supabase_apply_via_pat`. NUNCA martelar em paralelo (LavSync free tier).
- [ ] B3. Storage: criar buckets `logos`/`banners`/`campaigns` + policies (script `scripts/mi-create-buckets.mjs`).
- [ ] B4. Verificar RLS: `select` anon retorna só dados públicos; `select` autenticado respeita tenant.

### FASE C — Migração de dados
- [ ] C1. Script `scripts/mi-migrate-data.mjs` (service_role nos dois projetos):
  - Mapear `units.slug` → `unidades.id` (Buritis→…001).
  - Inserir `mi_units` (1:1 com unidade, preservar `slug`, `player_token`, `public_url`).
  - Inserir nas tabelas filhas preservando UUIDs originais (mantém FKs e `short_code` de QR).
  - Resolver `tenant_id` = tenant único do LavSync.
- [ ] C2. Migrar arquivos de storage (logos/banners/campaigns) do bucket origem → destino (download+upload, preservando paths `editor/...`).
- [ ] C3. Conferir contagens origem vs destino por tabela.

### FASE D — Código (rotas + libs)
- [ ] D1. Copiar componentes do editor, sidebars, stores, types (`src/stores/editor-store`, `src/types/editor`, etc.) para o LavSync sob `src/app/(app)/publicidade/midia-indoor/_lib` ou `src/lib/midia-indoor/`.
- [ ] D2. Mover rotas conforme §2.2. Ajustar imports (`@/lib/supabase/server|client|admin` do LavSync).
- [ ] D3. Trocar referências de tabela: `units`→`mi_units`, `partners`→`mi_partners`, etc. `unit_id`→`unidade_id`. Helpers `xv_*` → `current_tenant_id()`/`is_master()`.
- [ ] D4. Garantir `uploads-panel.tsx` na versão CORRIGIDA (bucket `campaigns`).
- [ ] D5. Proxy: adicionar ao whitelist `isPublic` em `src/lib/supabase/proxy-helper.ts`: `/m/`, `/player`, `/qr`, `/parceiro`, `/api/midia-indoor/player`, `/api/midia-indoor/qr`, `/api/midia-indoor/stocks`, `/api/midia-indoor/upload` (este último exige auth do parceiro — validar no handler, não no proxy).
- [ ] D6. Navegação: em `src/lib/navigation.ts` adicionar submenu "Mídia Indoor" sob Marketing OU dentro da página `/publicidade`. Adicionar permissão ao RBAC.
- [ ] D7. Env: `PEXELS_API_KEY` na Vercel LavSync. Trocar `NEXT_PUBLIC_APP_URL`/`SITE_URL` por origin do LavSync.
- [ ] D8. Auth parceiro: tabela `mi_partner_users` + callback. Reconfigurar Google OAuth redirect.

### FASE E — Verificação local
- [ ] E1. `npm run build` sem erros.
- [ ] E2. `npm run lint` / `tsc --noEmit`.
- [ ] E3. Smoke manual: dashboard do módulo, editor (criar template + upload imagem grande), campanha, player TV (`/player/xo-varal-buritis?token=…`), site público (`/m/xo-varal-buritis/clube-de-beneficios`), `/qr/<code>`, portal parceiro login.

### FASE F — Deploy
- [ ] F1. Commit (author `ferramentaslavsync@gmail.com`). Push `github.com/lavsync/sistemalavsync2026`.
- [ ] F2. `vercel --prod` (deploy manual). Verificar SSO Protection OFF.
- [ ] F3. Smoke em produção (mesma lista E3, no domínio lavsync).
- [ ] F4. Plano de corte de domínio/QR/TV (§5): reconfigurar Chromecasts, reimprimir QR, opcional 301 do domínio antigo.

---

## 7. Checklist final "nada se perdeu"
- [ ] 16 tabelas presentes como `mi_*` com contagem de linhas == origem.
- [ ] Arquivos de storage (logos/banners/campaigns) copiados (contagem de objetos == origem).
- [ ] Editor de templates abre, salva, publica e faz upload de imagem >8MB.
- [ ] Player TV roda a playlist da unidade Buritis.
- [ ] Sites públicos de clube/oferta/parceiro renderizam.
- [ ] `/qr/<code>` redireciona e registra clique.
- [ ] Portal do parceiro: login + cadastro + criar oferta.
- [ ] Métricas mostram impressões/cliques.
- [ ] Permissão "Mídia Indoor" aparece no RBAC e no menu Marketing.
- [ ] Nenhuma referência remanescente a `xv_*`, `units`/`partners` sem prefixo, ou domínio antigo no código.

---

## 8. Riscos & rollback
- **Free tier LavSync (Supabase Hobby):** não rodar migrations/queries em paralelo. Aplicar 0031 em uma transação só.
- **Colisão de nomes:** por isso TUDO leva prefixo `mi_`. Conferir que nenhuma tabela `mi_*` já existe.
- **FKs entre projetos:** preservar UUIDs na migração de dados (C1) para manter integridade referencial e `short_code` dos QR.
- **Rollback de banco:** 0031 é aditiva (só cria `mi_*`); rollback = `drop` das tabelas `mi_*` + buckets. Não toca tabelas existentes do LavSync.
- **Rollback de código:** está em branch `feat/midia-indoor`; reverter = não fazer merge / `git revert` do deploy.
- **Domínio antigo:** manter `midindoor.grupoescalize.com.br` no ar até a reconfiguração física das TVs/QR estar concluída.

---

## 9. Estado da execução (atualizar conforme avança)
- [x] Runbook escrito (este arquivo).
- [ ] FASE A · B · C · D · E · F.

> Próximo passo sugerido: escrever `supabase/migrations/0031_midia_indoor.sql` (Fase B1).
