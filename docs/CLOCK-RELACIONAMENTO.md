# 🤖 CLOCK Relacionamento — Diretiva Mestra (Customer Engagement & Conversational CRM)

> **Status:** blueprint aprovado para construção · 2026-06-16
> **Origem:** evolução do módulo `/publicidade` (Marketing) do LavSync, inspirada e
> superando o *MaxLav Chat* (MaxPan) — doc de referência do produto concorrente em
> `~/Desktop/` (varredura funcional `maxlav.maxpan.com.br/system/maxlavchat`).
> **IA do sistema:** **CLOCK** (NUNCA Selly — Selly é do Ecommseller).

---

## 0. Tese — não é disparador, é Relacionamento Conversacional

O MaxLav Chat é um **blaster de mão única**: envia avisos transacionais e campanhas de
inatividade por régua fixa, sem receber, sem responder, sem aprender. Nossa vantagem
estrutural é o **CLOCK + dados de venda reais** já dentro do LavSync.

O CLOCK Relacionamento é o **sistema operacional de relacionamento com o cliente da
lavanderia**: transacional + campanhas + **chatbot de duas vias + inbox humano +
automações + win-back preditivo + atribuição de receita**. Tudo multi-tenant, multi-unidade,
sobre a base de clientes e vendas que já temos.

**Teste das 6 perguntas (toda feature deve passar):**
1. Usa dado real de venda/cliente que já temos? (não inventar telemetria que não existe)
2. O CLOCK fica mais inteligente com isso, ou é só um form a mais?
3. Mede receita/retorno atribuído, não só "mensagem enviada"?
4. Respeita opt-out e LGPD por construção?
5. Funciona multi-unidade e multi-tenant sem vazamento (RLS)?
6. É superior ao MaxLav nesse ponto — ou estou só empatando?

---

## 1. Gap Analysis — o que temos hoje

**JÁ EXISTE (reaproveitar):**
- `marketing_campanhas` + `marketing_envios` (0014) — campanhas RFM, canal, template, filtros, status, log de envios com `provider`/`provider_message_id`/`status`.
- UI `/publicidade` → aba **Campanhas** (RFM: campeões/fiéis/novos/em risco/dormentes) + **Clube de Vantagens** + **XÔ Club** (pontos/cupons/store/resgates).
- `clientes` com RFM materializado: `compras_total_*`, `compras_90d_*`, `compras_30d_*`, `compras_7d_*`, `ultima_compra_em`, `genero`, `data_nascimento`, `telefone`, `email`.
- RPCs de RFM/gênero/KPIs (0019-0022).
- **`castelo_webhook_outbox` (0030)** — padrão de **fila + outbox + retry backoff + processor** já validado em produção. É o esqueleto do nosso motor de envio.
- **`lgpd_consentimentos` (0008)** + página `/direitos-lgpd` — base do opt-out.
- **CLOCK AI** — cérebro de insights já no sistema (`/clock`).

**FALTA (o que o MaxLav tem e nós não):**
1. Conexão WhatsApp real (provider, sessão, QR/credencial, teste de envio).
2. Mensagens **transacionais** automáticas (fim de ciclo, 1ª compra, recorrente, recarga, resumo diário ao dono, aviso por venda).
3. Alertas operacionais ao dono (depende de telemetria de máquina — ver §11 dependências).
4. Campanhas de inatividade **agendadas automáticas** por régua de dias.
5. Opt-out por palavra-chave (`SAIR`/`SAIRPROMO`).
6. **Fila com rate-limit + prioridade (operacional > campanha) + jitter** anti-bloqueio.
7. Agendamentos com ciclo de vida (agendado → executado/cancelado).
8. Campanhas personalizadas (wizard 2 etapas, 2000 chars, cupom opcional).
9. Métricas operacionais + de sucesso + export Excel.
10. Catálogo rico de variáveis (cashback, saldo, recarga, cupom).

---

## 2. Os 5 degraus que nos colocam ACIMA do MaxLav

1. **Duas vias / chatbot CLOCK** — recebe mensagens e responde. FAQ automática
   ("horário?", "tem máquina livre?", "minha roupa tá pronta?", "como recarrego?",
   "onde fica?"). O MaxLav só interpreta `SAIR`/`SAIRPROMO`.
2. **Mensagem gerada por IA, não template fixo** — CLOCK personaliza por cliente,
   histórico e contexto; sugere a melhor oferta e o melhor horário de envio.
3. **Inbox humano com handoff IA→pessoa** — caixa unificada; IA resolve o trivial,
   escala o resto. MaxLav não tem atendimento humano.
4. **Win-back preditivo, não régua fixa** — cada cliente tem seu ciclo de retorno
   (frequência individual a partir do histórico). Disparar no ponto de propensão de
   churn é cirúrgico; "todo mundo no dia 30" é grosseiro. A régua fixa (15/30/60/90/180)
   vira *fallback*, não a estratégia principal.
5. **Loop fechado com o financeiro** — atribuição de receita por campanha sobre vendas
   reais + ROI + **lift incremental com grupo de controle (holdout)**. Provar lucro,
   não só entrega.

---

## 3. Arquitetura em camadas

```
┌─ CANAIS ──────────────────────────────────────────────────────────┐
│  WhatsApp (provider) · E-mail · SMS                                │
└───────────────┬───────────────────────────────┬───────────────────┘
        OUTBOUND │                       INBOUND │ (webhook do provider)
                 ▼                               ▼
┌─ GATEWAY DE MENSAGENS ─────────┐   ┌─ ROUTER INBOUND / NLU ────────┐
│  adaptador por provider        │   │  opt-out (SAIR/SAIRPROMO)     │
│  (Meta Cloud API / Z-API/…)    │   │  intenção → CLOCK FAQ |       │
│  normaliza status/IDs          │   │  handoff humano | comando     │
└───────────────┬────────────────┘   └───────────────┬──────────────┘
                ▼                                     ▼
┌─ FILA + RATE-LIMIT (reusa padrão outbox) ─┐   ┌─ INBOX HUMANO ──────┐
│  prioridade: operacional > campanha       │   │  conversas, handoff  │
│  jitter aleatório, backoff retry          │   │  IA↔pessoa, status    │
│  limites /min→/hora→/dia derivados        │   └──────────────────────┘
└───────────────┬───────────────────────────┘
                ▼
┌─ MOTOR DE TEMPLATES + CLOCK AI ───────────────────────────────────┐
│  render {{variáveis}} · injeção opt-out · geração/curadoria por IA │
└───────────────┬───────────────────────────────────────────────────┘
                ▼
┌─ GATILHOS ────────────────────────────────────────────────────────┐
│  TRANSACIONAIS (venda confirmada, fim de ciclo, recarga, 1ª compra)│
│  CAMPANHAS (RFM + preditivo, agendadas, personalizadas)            │
│  AUTOMAÇÕES / JORNADAS (gatilho→condição→ação→espera)             │
└───────────────┬───────────────────────────────────────────────────┘
                ▼
┌─ MÉTRICAS + ATRIBUIÇÃO ───────────────────────────────────────────┐
│  operacionais, sucesso, ROI, holdout/lift, export Excel           │
└────────────────────────────────────────────────────────────────────┘

  ⟂ Transversal: OPT-OUT + LGPD (sobre lgpd_consentimentos)
```

---

## 4. Modelo de dados (migrations novas — a partir de 0032)

> Toda tabela: `tenant_id` + RLS `current_tenant_id() or is_master()`, padrão do projeto.

**0032 — Canal & conexão**
- `wa_conexoes` — por unidade: `provider`, `numero`, `status` (desconectado/conectando/conectado), `sessao_ref`, `termos_aceitos_em`, `reusa_de_unidade_id`. Permite reuso de número entre unidades do mesmo dono.

**0033 — Engine de mensageria (núcleo)**
- `msg_fila` — fila unificada: `tipo` (transacional/campanha/automacao/inbound_resp), `prioridade` (0=operacional…9=campanha), `cliente_id`, `canal`, `corpo_renderizado`, `agendado_para`, `status` (pendente/enviando/enviado/entregue/lido/falhou/cancelado/morto), `tentativas`, `proximo_retry_em`, `provider_message_id`, `erro`, `dedupe_key`. (Generaliza `marketing_envios` + herda o padrão do `castelo_webhook_outbox`.)
- `msg_templates` — `chave`, `categoria` (autoatendimento/maxcontrole/campanha), `tipo_gatilho`, `ativo`, `opcoes` jsonb (cupom, diferenciar_ciclo, horario, min_antes), `corpo`, `gerado_por_ia` bool.
- `msg_rate_config` — por unidade: `limite_min`, `limite_campanha_min`, `jitter`, `janela_envio`, `dedupe_cross_loja` bool.

**0034 — Conversas & inbox (duas vias)**
- `conversas` — `cliente_id`, `canal`, `status` (bot/humano/resolvida), `atribuido_a`, `ultimo_evento_em`.
- `mensagens` — `conversa_id`, `direcao` (in/out), `corpo`, `autor` (cliente/clock/usuario), `intencao`, `provider_message_id`, `lida_em`.

**0035 — Automações / jornadas**
- `automacoes` — `nome`, `gatilho` (jsonb: evento+condição), `passos` (jsonb: ações+esperas), `ativo`.
- `automacao_execucoes` — instância por cliente, estado do passo atual.

**0036 — Opt-out & atribuição**
- `msg_optout` — `cliente_id`, `escopo` (todas/promo), `origem` (SAIR/SAIRPROMO/manual/lgpd), `em`. (Liga em `lgpd_consentimentos`.)
- `campanha_atribuicao` — `campanha_id`, `cliente_id`, `grupo` (exposto/holdout), `venda_id`, `valor_atribuido`, `janela_dias`. Base do ROI e do lift incremental.

> **Reaproveitamento:** `marketing_campanhas` ganha colunas (`tipo`: rfm/preditiva/personalizada/inatividade; `holdout_pct`; `cupom_id`). `marketing_envios` é absorvido por `msg_fila` (migração de dados) ou mantido como view de compatibilidade.

---

## 5. Catálogo de variáveis (estendido)

Mantém o que temos (`{primeiro_nome}`, `{nome}`, `{cpf}`, `{ultima_compra}`) e migra para
padrão `{{snake_case}}` alinhado ao MaxLav, somando os que faltam:

`{{nome_cliente}}` `{{telefone_cliente}}` `{{apelido_loja}}` `{{tipo_ciclo}}` `{{id_maquina}}`
`{{valor_compra}}` `{{minutos_aviso}}` `{{minutos_restantes}}` `{{cupom_percentual}}`
`{{cupom_codigo}}` `{{cupom_validade}}` `{{valor_cashback}}` `{{saldo_cashback}}`
`{{quantidade_vendas}}` `{{total_vendas}}` `{{valor_recarga}}` `{{saldo_atual}}`

**Nossos exclusivos (CLOCK):** `{{dias_desde_ultima}}`, `{{ciclo_medio_dias}}`,
`{{segmento_rfm}}`, `{{nivel_clube}}`, `{{saldo_xc}}`, `{{melhor_horario}}`.

Cupom só renderiza se o template tiver a opção ativa **E** houver cupom configurado (regra MaxLav, mantida).

---

## 6. Mensagens transacionais & gatilhos

| Template | Gatilho (origem no LavSync) | Destinatário |
|---|---|---|
| Resumo diário de vendas | cron diário no horário configurado | Dono |
| Aviso por venda | venda confirmada (mesmo hook do Castelo outbox) | Dono |
| 1ª compra / Recorrente | venda confirmada + `compras_total_qtd` | Cliente |
| Recarga de saldo | evento de recarga | Cliente |
| Confirmação de contato (+opt-out) | 1º contato | Cliente |
| Fim de ciclo (aviso N min antes) | telemetria de ciclo **(dependência §11)** | Cliente |
| Alertas MaxControle (offline, indisponível, atraso, Rapid) | telemetria de máquina **(dependência §11)** | Dono |

O bloco de opt-out (`SAIR`/`SAIRPROMO`) é **injetado pelo backend**, nunca editável pelo dono.

---

## 7. Motor de campanhas (RFM + preditivo)

- **Preditivo (principal):** para cada cliente, ciclo de retorno individual = mediana do
  intervalo entre compras. "Atrasado" = `dias_desde_ultima > ciclo_medio * fator`. Dispara
  win-back no ponto de propensão, por cliente — não por régua global.
- **Régua de inatividade (fallback/compatibilidade MaxLav):** 15/30/60/90/180 dias, disparo
  no **dia exato** (cron diário), opção cupom por segmento.
- **Personalizadas:** wizard 2 etapas (config: nome/data-hora/template/2000 chars/cupom →
  destinatários), agendamento com ciclo de vida.
- **Holdout:** % da base segurado como grupo de controle pra medir lift incremental.

---

## 8. Fila, rate-limit e anti-bloqueio (clona o outbox)

- Fila unificada `msg_fila`; **prioridade operacional > campanha** (campanha só sai sem
  operacional pendente).
- Envio gradual 5–10 msg/min com **jitter aleatório** (sem padrão de spam).
- Limites `/min → /hora → /dia` derivados; indicador de risco baixo/médio/alto.
- Backoff de retry idêntico ao processor do Castelo (1m/5m/30m/2h/24h; 4xx=morto).
- Dedupe por `dedupe_key`; opção **dedupe cross-loja por proprietário** (não reenviar a quem
  comprou em outra loja do mesmo dono).
- Disparo de campanhas inicia diariamente em horário configurável (MaxLav usa 9h).

---

## 9. Provider de WhatsApp — decisão pendente

Três caminhos (escolher antes do Sprint 2):
- **Meta WhatsApp Cloud API** (oficial) — robusto, templates aprovados, menor risco de ban,
  mas exige aprovação de templates HSM e número comercial. Melhor para transacional em escala.
- **Z-API / Evolution API** (não-oficial, QR Code) — espelha o MaxLav (QR + sessão), rápido
  de integrar, custo baixo, **risco de bloqueio** (o próprio MaxLav avisa disso).
- **Twilio** — caro, oficial, bom fallback SMS.

Arquitetura com **adaptador por provider** pra não acoplar. Recomendação: Cloud API para
transacional + um provider QR para campanhas no início, atrás da mesma interface.

---

## 10. Opt-out & LGPD (transversal, sobre o que já temos)

- `SAIR` → opt-out total; `SAIRPROMO` → só promoções, mantém operacional. Gravados em
  `msg_optout` e refletidos em `lgpd_consentimentos`.
- Todo envio de campanha checa opt-out antes de enfileirar.
- Página `/direitos-lgpd` ganha visão de preferências de comunicação do cliente.

---

## 11. Dependências e decisões pendentes

- **Telemetria de máquina/ciclo** (fim de ciclo + alertas MaxControle): o LavSync hoje
  importa **salesReport do MAXPAN (CSV)** — isso é venda, **não** status de máquina em tempo
  real. Os alertas operacionais e o "aviso N min antes do fim do ciclo" só são possíveis com
  feed de telemetria (API MaxPan/MaxBox ou Stone). **Fase 3** depende disso. Confirmar com
  Daniel se há acesso a esse feed.
- **Provider WhatsApp** (§9) — decidir.
- **Eventos de recarga/saldo/cashback** — confirmar se vêm nos dados atuais ou dependem de
  integração nova.

---

## 12. Roadmap em sprints

- **Sprint 1 — Fundação da engine (sem provider):** migrations 0032-0036, `msg_fila` +
  processor (clonado do Castelo), motor de templates `{{}}` com catálogo estendido, opt-out,
  pré-visualização com dados fictícios, rate-config. *Disparo ainda "dry-run" (log), igual hoje.*
- **Sprint 2 — Provider WhatsApp real:** adaptador + conexão (QR/credencial) + teste de envio
  + inbound webhook + status de entrega. Liga o transacional "aviso por venda" (reusa hook
  Castelo) e "resumo diário".
- **Sprint 3 — Chatbot CLOCK + Inbox humano:** NLU de intenção, FAQ automática, handoff
  IA→pessoa, caixa de entrada unificada.
- **Sprint 4 — Campanhas preditivas + atribuição:** win-back por ciclo individual, holdout/lift,
  ROI por campanha, agendamentos, personalizadas (wizard 2 etapas).
- **Sprint 5 — Automações/jornadas + métricas:** builder gatilho→condição→ação→espera,
  dashboard de métricas operacionais/sucesso, export Excel, dedupe cross-loja.
- **Sprint 6 (condicional) — Transacional de ciclo + MaxControle:** depende da telemetria (§11).

---

## 13. Regras herdadas do LavSync (não violar)

- IA = **CLOCK** (nunca Selly).
- Timezone São Paulo via `src/lib/timezone-br.ts` em tudo que é "hoje/agora/agendado".
- `paginarTodos()` em queries que iteram a base inteira.
- Sem emojis na UI (lucide-react). Exceção: corpo de mensagem WhatsApp pro cliente.
- RLS por `tenant_id` em toda tabela nova.
- Git author `ferramentaslavsync@gmail.com`; deploy manual via CLI.
- AGENTS.md: esta é uma versão do Next.js com breaking changes — ler `node_modules/next/dist/docs/` antes de escrever código.
