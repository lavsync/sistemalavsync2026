"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Trophy, Crown, Gem, Award, Medal, Sparkles, RefreshCw, Send,
  Loader2, ChevronRight, Users, TrendingDown, Phone, Filter,
  Building2, Calendar, Layers, MessageCircle, Plus, Pencil, Power,
  Trash2, Copy as CopyIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NIVEIS, type NivelClube, labelDoNivel, corDoNivel, proximoNivel } from "@/lib/clube/niveis";
import type { Classificacao, ResumoClube, TemplateMensagem, SituacaoUnidade, SituacaoCliente, QuaseCliente } from "@/lib/clube/queries";
import { classificarMes, gerarDisparosClube } from "@/lib/clube/actions";
import { marcarEnvioManual } from "@/lib/clube/envios-manuais";
import { renderMensagem, linkWhatsApp, LINK_PORTAL_CLIENTE } from "@/lib/clube/render-mensagem";
import { excluirTemplate, alternarAtivoTemplate, salvarTemplate } from "@/lib/clube/templates-actions";
import { TemplateEditorDialog, BotaoCopiarBanner } from "./template-editor";
import { UnidadeMultiSwitcher } from "@/components/ui/unidade-multi-switcher";
import type { SelecaoUnidades } from "@/lib/unidade-multi";

type Unidade = { id: string; nome: string };

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function nomeDoMes(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T12:00:00");
  return `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

const NIVEL_ICON: Record<NivelClube, React.ElementType> = {
  nao_classificado: Users,
  bronze: Medal,
  prata: Award,
  ouro: Trophy,
  diamante: Gem,
};

export function ClubeView({
  resumo,
  classificacoes,
  mesAplicacao,
  mesesDisponiveis,
  unidades,
  templates,
  selecaoUnidadeIds,
  situacaoUnidades,
  selecaoUnidades,
  enviosQualificacao,
  abaixoBronze,
}: {
  resumo: ResumoClube;
  classificacoes: Classificacao[];
  mesAplicacao: string;
  mesesDisponiveis: string[];
  unidades: Unidade[];
  templates: TemplateMensagem[];
  selecaoUnidadeIds: string[];
  situacaoUnidades: SituacaoUnidade[];
  selecaoUnidades: SelecaoUnidades;
  enviosQualificacao: string[];
  abaixoBronze: QuaseCliente[];
}) {
  const [classificando, setClassificando] = React.useState(false);
  const [disparandoTpl, setDisparandoTpl] = React.useState<string | null>(null);
  const [filtroNivel, setFiltroNivel] = React.useState<NivelClube | "todos">("todos");
  const [filtroUnidadeMembros, setFiltroUnidadeMembros] = React.useState<string>("todas");
  const [editandoTpl, setEditandoTpl] = React.useState<TemplateMensagem | "novo" | null>(null);

  async function onExcluirTemplate(t: TemplateMensagem) {
    if (!confirm(`Excluir a mensagem "${t.titulo}"?\n\nEssa ação não tem volta. Se preferir, use Desativar.`)) return;
    const r = await excluirTemplate(t.id);
    if (r.ok) window.location.reload();
    else alert("Erro: " + r.erro);
  }

  async function onAlternarAtivo(t: TemplateMensagem) {
    const r = await alternarAtivoTemplate(t.id, !t.ativo);
    if (r.ok) window.location.reload();
    else alert("Erro: " + r.erro);
  }

  async function onDuplicarTemplate(t: TemplateMensagem) {
    const r = await salvarTemplate(null, {
      tipo: t.tipo, nivel_alvo: t.nivel_alvo,
      titulo: `${t.titulo} (cópia)`, mensagem: t.mensagem,
      ativo: false, ordem: t.ordem + 1, banner_url: t.banner_url,
    });
    if (r.ok) window.location.reload();
    else alert("Erro: " + r.erro);
  }

  // mes_ref = mes_aplicacao - 1
  const mesRefDate = new Date(mesAplicacao + "T12:00:00");
  mesRefDate.setMonth(mesRefDate.getMonth() - 1);
  const mesRefStr = `${mesRefDate.getFullYear()}-${String(mesRefDate.getMonth() + 1).padStart(2, "0")}-01`;

  const filtradas = classificacoes.filter((c) =>
    (filtroNivel === "todos" || c.nivel === filtroNivel) &&
    (filtroUnidadeMembros === "todas" || c.unidade_id === filtroUnidadeMembros));

  // ── Marcação "mensagem do mês enviada" (tipo qualificação) ────────────
  // Estado ÚNICO compartilhado entre a Situação por Unidade e a seção
  // "Quase lá" — marcar num lugar reflete no outro.
  const [enviadosQual, setEnviadosQual] = React.useState<Set<string>>(new Set(enviosQualificacao));
  const alternarEnvioQual = React.useCallback(async (clienteId: string, unidadeId: string | null, valor: boolean) => {
    setEnviadosQual((s) => {
      const n = new Set(s);
      if (valor) n.add(clienteId); else n.delete(clienteId);
      return n;
    });
    const r = await marcarEnvioManual({ clienteId, unidadeId, mesRef: mesRefStr, tipo: "qualificacao", enviado: valor });
    if (!r.ok) {
      setEnviadosQual((s) => {
        const n = new Set(s);
        if (valor) n.delete(clienteId); else n.add(clienteId);
        return n;
      });
    }
  }, [mesRefStr]);

  async function onReclassificar() {
    if (!confirm(
      `Reclassificar TODOS os clientes baseado em ${nomeDoMes(mesRefStr)}?\n\n` +
      `Vai analisar todas as vendas de ${nomeDoMes(mesRefStr)} e atualizar os benefícios pra ${nomeDoMes(mesAplicacao)}.`
    )) return;
    setClassificando(true);
    try {
      const r = await classificarMes(mesRefStr);
      alert(`${r.classificados} clientes classificados:\n\n` +
        `Bronze: ${r.porNivel.bronze}\nPrata: ${r.porNivel.prata}\nOuro: ${r.porNivel.ouro}\nDiamante: ${r.porNivel.diamante}`
      );
    } catch (e) {
      alert("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setClassificando(false);
    }
  }

  async function onDispararTemplate(tpl: TemplateMensagem) {
    const alvoLabel = tpl.nivel_alvo
      ? `apenas membros ${labelDoNivel(tpl.nivel_alvo as NivelClube)}`
      : "todos os membros classificados";
    if (!confirm(
      `Disparar template "${tpl.titulo}" pra ${alvoLabel} de ${nomeDoMes(mesAplicacao)}?\n\n` +
      `Vai criar uma campanha no log de marketing com mensagens renderizadas pra cada cliente. ` +
      `(WhatsApp não conectado ainda — disparo manual via export CSV.)`
    )) return;
    setDisparandoTpl(tpl.id);
    try {
      const r = await gerarDisparosClube(
        mesAplicacao,
        tpl.id,
        selecaoUnidadeIds.length > 0 && selecaoUnidadeIds.length < unidades.length ? selecaoUnidadeIds : null,
      );
      alert(`✓ Campanha criada com ${r.envios} mensagens renderizadas.\n\nVá em /publicidade tab "Campanhas" pra ver e exportar.`);
    } catch (e) {
      alert("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDisparandoTpl(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-display font-bold text-[16px] inline-flex items-center gap-2">
              <Crown className="w-4 h-4 text-warning" />
              Clube de Vantagens · Mês de aplicação: <span className="text-brand-cyan">{nomeDoMes(mesAplicacao)}</span>
            </h3>
            <p className="text-[12px] text-muted-foreground mt-1">
              Baseado nos ciclos de <strong>{nomeDoMes(mesRefStr)}</strong>.
              Lavagem + Secagem somam como <strong>ciclos</strong>.
              1 ciclo = 1 ponto pra trocar na store.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UnidadeMultiSwitcher
              unidades={unidades}
              selecionadas={selecaoUnidades.ids}
              todasMarcadas={selecaoUnidades.todas}
              rotulo={selecaoUnidades.rotulo}
              variant="card"
            />
            <select
              value={mesAplicacao}
              onChange={(e) => {
                const url = new URL(window.location.href);
                url.searchParams.set("mes_aplic", e.target.value);
                window.location.href = url.toString();
              }}
              className="form-input w-auto h-9 py-0 text-[12px]"
            >
              {mesesDisponiveis.length === 0 && <option value={mesAplicacao}>{nomeDoMes(mesAplicacao)}</option>}
              {mesesDisponiveis.map((m) => (
                <option key={m} value={m}>{nomeDoMes(m)}</option>
              ))}
            </select>
            <Button onClick={onReclassificar} disabled={classificando} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
              {classificando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Classificar com base em {nomeDoMes(mesRefStr)}
            </Button>
          </div>
        </div>

        {/* Regras inline */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          {NIVEIS.filter((n) => n.key !== "nao_classificado").map((n) => {
            const Icon = NIVEL_ICON[n.key];
            return (
              <div key={n.key} className={cn("rounded-lg border border-border p-2 text-[11px]")}>
                <div className="font-bold text-[12px] inline-flex items-center gap-1.5">
                  <Icon className={cn("w-3.5 h-3.5", `text-${n.cor}`)} />
                  <span className={cn(`text-${n.cor}`)}>{n.label}</span>
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {n.ciclosMax != null ? `${n.ciclosMin}–${n.ciclosMax}` : `${n.ciclosMin}+`} ciclos · <strong>{n.descontoPct}% OFF</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPIs por nível */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiNivel icon={Users} label="Total classificados" valor={resumo.total} tone="brand-cyan" />
        {NIVEIS.filter((n) => n.key !== "nao_classificado").map((n) => {
          const Icon = NIVEL_ICON[n.key];
          const qtd = resumo.porNivel[n.key] ?? 0;
          return (
            <button key={n.key}
              onClick={() => setFiltroNivel(filtroNivel === n.key ? "todos" : n.key)}
              className={cn(
                "rounded-2xl border bg-card p-4 text-left transition-smooth hover:scale-[1.02]",
                filtroNivel === n.key ? `border-${n.cor} ring-2 ring-${n.cor}/30` : "border-border",
              )}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("w-4 h-4", `text-${n.cor}`)} />
                  <span className={cn("text-[10px] uppercase tracking-wider font-bold", `text-${n.cor}`)}>{n.label}</span>
                </div>
                <Icon className={cn("w-3.5 h-3.5", `text-${n.cor}`)} />
              </div>
              <div className={cn("font-display font-bold text-2xl", `text-${n.cor}`)}>{qtd}</div>
              <div className="text-[10px] text-muted-foreground">{n.descontoPct}% OFF · {n.ciclosMin}+ ciclos</div>
            </button>
          );
        })}
      </div>

      {/* Faturamento projetado de desconto */}
      {resumo.fatProjetadoDesconto > 0 && (
        <div className="rounded-xl border border-warning/30 bg-gradient-to-br from-warning/[0.06] to-transparent p-4 text-[12px] inline-flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-warning" />
          <span>
            Desconto projetado em {nomeDoMes(mesAplicacao)} (estimado pelo fat. do mês ref):
            <strong className="ml-1 text-warning">{fmtBRL(resumo.fatProjetadoDesconto)}</strong>
          </span>
        </div>
      )}

      {/* Banco de mensagens — gestão completa */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-display font-bold text-[14px] inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
            Banco de mensagens WhatsApp ({templates.length})
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground hidden md:inline">
              Edite, crie e personalize — variáveis, emojis e banner
            </span>
            <Button size="sm" onClick={() => setEditandoTpl("novo")}
              className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white h-8">
              <Plus className="w-3.5 h-3.5 mr-1" /> Nova mensagem
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {templates.map((t) => {
            const tipoCor =
              t.tipo === "parabens_nivel" ? "success" :
              t.tipo === "faltam_ciclos" ? "warning" :
              t.tipo === "pontos_disponiveis" ? "brand-cyan" :
              "brand-purple";
            return (
              <div key={t.id} className={cn("rounded-lg border bg-secondary/20 p-3",
                t.ativo ? "border-border" : "border-border/50 opacity-60")}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                    <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                      `bg-${tipoCor}/15 text-${tipoCor}`)}>
                      {t.tipo.replace(/_/g, " ")}
                    </span>
                    {t.nivel_alvo && (() => {
                      const NivelIcon = NIVEL_ICON[t.nivel_alvo as NivelClube];
                      return (
                        <span className="text-[10px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                          <NivelIcon className="w-3 h-3" />
                          {labelDoNivel(t.nivel_alvo as NivelClube)}
                        </span>
                      );
                    })()}
                    {!t.ativo && (
                      <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        inativa
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button title="Editar" onClick={() => setEditandoTpl(t)}
                      className="text-muted-foreground hover:text-brand-cyan"><Pencil className="w-3.5 h-3.5" /></button>
                    <button title="Duplicar" onClick={() => onDuplicarTemplate(t)}
                      className="text-muted-foreground hover:text-brand-cyan"><CopyIcon className="w-3.5 h-3.5" /></button>
                    <button title={t.ativo ? "Desativar" : "Ativar"} onClick={() => onAlternarAtivo(t)}
                      className={cn(t.ativo ? "text-success" : "text-muted-foreground", "hover:opacity-70")}>
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button title="Excluir" onClick={() => onExcluirTemplate(t)}
                      className="text-muted-foreground hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="font-semibold text-[12px] mb-1">{t.titulo}</div>
                {t.banner_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.banner_url} alt="" className="rounded-md max-h-20 mb-1.5 border border-border" />
                )}
                <div className="rounded bg-card p-2 text-[11px] text-muted-foreground italic line-clamp-3 mb-2">
                  &ldquo;{t.mensagem}&rdquo;
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onDispararTemplate(t)}
                    disabled={disparandoTpl === t.id || resumo.total === 0 || !t.ativo}
                    className="flex-1 px-2 py-1.5 rounded text-[11px] font-bold text-white bg-gradient-to-r from-brand-cyan to-brand-blue hover:opacity-90 inline-flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    {disparandoTpl === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Disparar
                  </button>
                  {t.banner_url && <BotaoCopiarBanner url={t.banner_url} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editandoTpl !== null && (
        <TemplateEditorDialog
          template={editandoTpl}
          onClose={(salvou) => {
            setEditandoTpl(null);
            if (salvou) window.location.reload();
          }}
        />
      )}

      {/* Situação ao vivo de TODOS os clientes — agrupada por unidade */}
      <SituacaoPorUnidade
        situacao={situacaoUnidades}
        mesRefStr={mesRefStr}
        mesAplicacao={mesAplicacao}
        templates={templates}
        enviados={enviadosQual}
        onAlternar={alternarEnvioQual}
      />

      {/* Filtros da tabela de membros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value as NivelClube | "todos")}
            className="form-input w-auto h-8 py-0 text-[12px]">
            <option value="todos">Todos os níveis ({resumo.total})</option>
            {NIVEIS.filter((n) => n.key !== "nao_classificado").map((n) => (
              <option key={n.key} value={n.key}>{n.label} ({resumo.porNivel[n.key]})</option>
            ))}
          </select>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={filtroUnidadeMembros} onChange={(e) => setFiltroUnidadeMembros(e.target.value)}
            className="form-input w-auto h-8 py-0 text-[12px]">
            <option value="todas">Todas as unidades</option>
            {unidades.map((u) => {
              const qtd = classificacoes.filter((c) => c.unidade_id === u.id).length;
              return <option key={u.id} value={u.id}>{u.nome} ({qtd})</option>;
            })}
          </select>
        </div>
      </div>

      {/* Tabela de membros */}
      {filtradas.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-10 text-center">
          <Crown className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <div className="text-[13px] font-semibold">Nenhum cliente classificado neste mês</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Clique em &quot;Classificar&quot; pra rodar a análise de {nomeDoMes(mesRefStr)}.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between text-[11px]">
            <span className="font-semibold">
              {filtradas.length} {filtradas.length === 1 ? "membro" : "membros"} usufruindo em {nomeDoMes(mesAplicacao)}
            </span>
          </div>
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto custom-scroll-thin">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10 border-b border-border">
                <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-2 px-3 font-semibold w-12">#</th>
                  <th className="text-left py-2 px-3 font-semibold">Cliente</th>
                  <th className="text-left py-2 px-3 font-semibold">Unidade</th>
                  <th className="text-left py-2 px-3 font-semibold">Nível</th>
                  <th className="text-right py-2 px-3 font-semibold">Ciclos</th>
                  <th className="text-right py-2 px-3 font-semibold">Lav/Sec</th>
                  <th className="text-right py-2 px-3 font-semibold">Fat. mês</th>
                  <th className="text-center py-2 px-3 font-semibold">Desconto</th>
                  <th className="text-right py-2 px-3 font-semibold">Pontos</th>
                  <th className="text-left py-2 px-3 font-semibold">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((m, idx) => {
                  const cor = corDoNivel(m.nivel);
                  return (
                    <motion.tr key={m.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                      className="border-b border-border/40 hover:bg-secondary/20">
                      <td className="py-2 px-3 font-mono font-bold text-muted-foreground">#{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold">{m.cliente_nome}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{m.cliente_cpf}</div>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-muted-foreground">{m.unidade_nome}</td>
                      <td className="py-2 px-3">
                        {(() => {
                          const IconN = NIVEL_ICON[m.nivel];
                          return (
                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                              `bg-${cor}/15 text-${cor}`)}>
                              <IconN className="w-3 h-3" /> {labelDoNivel(m.nivel)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{m.ciclos_mes}</td>
                      <td className="py-2 px-3 text-right font-mono text-[10px] text-muted-foreground">
                        {m.ciclos_lavagem}/{m.ciclos_secagem}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{fmtBRL(m.faturamento_mes)}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={cn("font-bold text-[12px]", `text-${cor}`)}>{m.desconto_pct}%</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-brand-purple">{m.pontos_acumulado}</td>
                      <td className="py-2 px-3 text-[10px] text-muted-foreground">
                        {m.cliente_telefone ? (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Phone className="w-2.5 h-2.5" /> {m.cliente_telefone}
                          </span>
                        ) : <span className="opacity-40">—</span>}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quase lá — usaram no mês ref mas não atingiram nível */}
      <AbaixoBronzeSection
        clientes={abaixoBronze}
        unidades={unidades}
        templates={templates}
        mesRefStr={mesRefStr}
        mesAplicacao={mesAplicacao}
        enviados={enviadosQual}
        onAlternar={alternarEnvioQual}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// QUASE LÁ — usaram a lavanderia no mês de referência mas não
// atingiram nível. Relação separada pra mensagem de incentivo:
// "faltaram X ciclos; este mês uma nova oportunidade começou".
// ────────────────────────────────────────────────────────────
function AbaixoBronzeSection({
  clientes, unidades, templates, mesRefStr, mesAplicacao, enviados, onAlternar,
}: {
  clientes: QuaseCliente[];
  unidades: Unidade[];
  templates: TemplateMensagem[];
  mesRefStr: string;
  mesAplicacao: string;
  enviados: Set<string>;
  onAlternar: (clienteId: string, unidadeId: string | null, valor: boolean) => Promise<void>;
}) {
  const [filtroUnidade, setFiltroUnidade] = React.useState<string>("todas");
  const [busca, setBusca] = React.useState("");
  const [soPendentes, setSoPendentes] = React.useState(false);

  const tpl = templates.find((t) => t.tipo === "abaixo_bronze" && t.ativo !== false) ?? null;

  const mensagemDe = React.useCallback((c: QuaseCliente): string | null => {
    if (!tpl) return null;
    return renderMensagem(tpl.mensagem, {
      primeiro_nome: c.nome.split(" ")[0],
      nome: c.nome,
      cpf: c.cpf,
      ciclos: c.ciclos,
      ciclos_palavra: c.ciclos === 1 ? "ciclo" : "ciclos",
      faltam: c.faltaram,
      proximo_nivel: "BRONZE",
      desconto_proximo: NIVEIS.find((n) => n.key === "bronze")?.descontoPct ?? 5,
      mes_ref_nome: nomeDoMes(mesRefStr),
      mes_aplic_nome: nomeDoMes(mesAplicacao),
      link_portal: LINK_PORTAL_CLIENTE,
      pontos: 0, nivel: "—", desconto: 0, faltam_proximo: c.faltaram,
    });
  }, [tpl, mesRefStr, mesAplicacao]);

  function abrirWhatsApp(c: QuaseCliente) {
    const msg = mensagemDe(c);
    if (!c.telefone || !msg) return;
    window.open(linkWhatsApp(c.telefone, msg), "_blank", "noopener");
    if (!enviados.has(c.cliente_id)) void onAlternar(c.cliente_id, c.unidade_id, true);
  }

  const buscaNorm = busca.trim().toLowerCase();
  const filtrados = clientes.filter((c) => {
    if (filtroUnidade !== "todas" && c.unidade_id !== filtroUnidade) return false;
    if (soPendentes && enviados.has(c.cliente_id)) return false;
    if (buscaNorm) {
      return c.nome.toLowerCase().includes(buscaNorm)
        || c.cpf.replace(/\D/g, "").includes(buscaNorm.replace(/\D/g, ""));
    }
    return true;
  });
  const totalEnviados = clientes.filter((c) => enviados.has(c.cliente_id)).length;

  if (clientes.length === 0) return null;

  return (
    <div className="rounded-2xl border border-warning/30 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-warning/10 to-transparent">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-display font-bold text-[14px] inline-flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-warning rotate-180" />
              Quase lá · usaram em {nomeDoMes(mesRefStr)} mas não atingiram nível ({clientes.length})
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Mensagem de incentivo: quantos ciclos fizeram, quantos faltaram pro Bronze e que a nova
              oportunidade começou em {nomeDoMes(mesAplicacao)}.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[11px] font-semibold inline-flex items-center gap-1",
              totalEnviados === clientes.length ? "text-success" : "text-muted-foreground")}>
              <MessageCircle className="w-3 h-3" /> {totalEnviados}/{clientes.length} enviadas
            </span>
            <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
              <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)}
                className="accent-warning" />
              Só pendentes
            </label>
            <div className="inline-flex items-center gap-1.5 border border-border bg-muted/30 rounded-md px-2.5 py-1.5">
              <Building2 className="w-3 h-3 text-muted-foreground" />
              <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}
                className="bg-transparent text-[11px] outline-none">
                <option value="todas">Todas as unidades</option>
                {unidades.map((u) => {
                  const qtd = clientes.filter((c) => c.unidade_id === u.id).length;
                  return <option key={u.id} value={u.id}>{u.nome} ({qtd})</option>;
                })}
              </select>
            </div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="form-input h-8 text-[12px] w-40 py-0"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[520px] overflow-y-auto custom-scroll-thin">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10 border-b border-border">
            <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-2 px-3 font-semibold w-12">#</th>
              <th className="text-left py-2 px-3 font-semibold">Cliente</th>
              <th className="text-left py-2 px-3 font-semibold">Unidade</th>
              <th className="text-right py-2 px-3 font-semibold">Ciclos em {nomeDoMes(mesRefStr)}</th>
              <th className="text-right py-2 px-3 font-semibold">Lav/Sec</th>
              <th className="text-right py-2 px-3 font-semibold">Gasto</th>
              <th className="text-left py-2 px-3 font-semibold">Faltaram p/ Bronze</th>
              <th className="text-left py-2 px-3 font-semibold">Mensagem do mês</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c, idx) => (
              <motion.tr key={c.cliente_id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: Math.min(idx * 0.005, 0.2) }}
                className="border-b border-border/40 hover:bg-secondary/20">
                <td className="py-2 px-3 font-mono font-bold text-muted-foreground">#{idx + 1}</td>
                <td className="py-2 px-3">
                  <div className="font-semibold">{c.nome}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{c.cpf}</div>
                </td>
                <td className="py-2 px-3 text-[11px] text-muted-foreground">{c.unidade_nome}</td>
                <td className="py-2 px-3 text-right font-mono font-bold">{c.ciclos}</td>
                <td className="py-2 px-3 text-right font-mono text-[10px] text-muted-foreground">
                  {c.ciclos_lavagem}/{c.ciclos_secagem}
                </td>
                <td className="py-2 px-3 text-right font-mono">{fmtBRL(c.faturamento)}</td>
                <td className="py-2 px-3">
                  <span className="font-mono font-bold text-warning">{c.faltaram}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {c.faltaram === 1 ? "ciclo" : "ciclos"} (Bronze = 8)
                  </span>
                </td>
                <td className="py-2 px-3">
                  {c.telefone && mensagemDe(c) ? (
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => abrirWhatsApp(c)}
                        title={`Abrir WhatsApp Web com a mensagem pronta\n\n${mensagemDe(c)}`}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-smooth",
                          enviados.has(c.cliente_id)
                            ? "bg-secondary text-muted-foreground hover:text-foreground"
                            : "bg-[#25D366]/15 text-[#128a44] hover:bg-[#25D366]/25",
                        )}>
                        <MessageCircle className="w-3.5 h-3.5" /> Conversar
                      </button>
                      {tpl?.banner_url && <BotaoCopiarBanner url={tpl.banner_url} />}
                      <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
                        <input type="checkbox" checked={enviados.has(c.cliente_id)}
                          onChange={(e) => onAlternar(c.cliente_id, c.unidade_id, e.target.checked)}
                          className="accent-[#25D366]" />
                        {enviados.has(c.cliente_id)
                          ? <span className="text-success font-semibold">enviada</span>
                          : "enviada?"}
                      </label>
                    </div>
                  ) : (
                    <span className="text-[10px] opacity-40 inline-flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" /> sem telefone
                    </span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <div className="py-8 text-center text-[12px] text-muted-foreground">
            Nenhum cliente bate com os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
}

function KpiNivel({ icon: Icon, label, valor, tone }: { icon: React.ElementType; label: string; valor: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", `text-${tone}`)} />
      </div>
      <div className={cn("font-display font-bold text-2xl", `text-${tone}`)}>{valor}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SITUAÇÃO AO VIVO POR UNIDADE — todos os clientes do mês_ref
// ────────────────────────────────────────────────────────────
function SituacaoPorUnidade({
  situacao, mesRefStr, mesAplicacao, templates, enviados, onAlternar,
}: {
  situacao: SituacaoUnidade[];
  mesRefStr: string;
  mesAplicacao: string;
  templates: TemplateMensagem[];
  enviados: Set<string>;
  onAlternar: (clienteId: string, unidadeId: string | null, valor: boolean) => Promise<void>;
}) {
  const [unidadeAberta, setUnidadeAberta] = React.useState<string | null>(situacao[0]?.unidade_id ?? null);
  const [filtroNivel, setFiltroNivel] = React.useState<NivelClube | "todos">("todos");
  const [busca, setBusca] = React.useState("");
  const [soPendentes, setSoPendentes] = React.useState(false);

  // Mensagem de qualificação: com nível VIGENTE → template do nível (fala dos
  // ciclos do mês de REFERÊNCIA que conquistaram o benefício); sem nível →
  // 'abaixo_bronze' (incentivo com os números do mês de referência).
  // A corrida atual ({faltam}/{proximo_nivel}) usa a CONTAGEM NOVA do mês.
  const templateDe = React.useCallback((c: SituacaoCliente): TemplateMensagem | null => {
    const vigente = c.nivel_vigente;
    return (vigente
      ? templates.find((t) => t.tipo === "parabens_nivel" && t.nivel_alvo === vigente && t.ativo !== false)
      : templates.find((t) => t.tipo === "abaixo_bronze" && t.ativo !== false)) ?? null;
  }, [templates]);

  const mensagemDe = React.useCallback((c: SituacaoCliente): string | null => {
    const vigente = c.nivel_vigente;
    const tpl = templateDe(c);
    if (!tpl) return null;

    // Corrida ATUAL (contagem nova) pro cliente vigente; pro abaixo de bronze,
    // o "faltaram" da mensagem se refere ao mês de referência encerrado.
    const proxAtual = c.proximo_nivel ? NIVEIS.find((n) => n.key === c.proximo_nivel) : null;
    const proxRefCalc = proximoNivel(c.ciclos_ref);
    const usarRef = !vigente;

    return renderMensagem(tpl.mensagem, {
      primeiro_nome: c.nome.split(" ")[0],
      nome: c.nome,
      cpf: c.cpf,
      nivel: vigente ? labelDoNivel(vigente).toUpperCase() : "—",
      ciclos: c.ciclos_ref,
      ciclos_palavra: c.ciclos_ref === 1 ? "ciclo" : "ciclos",
      desconto: c.desconto_vigente,
      pontos: c.pontos,
      faltam: usarRef ? proxRefCalc.faltam : c.ciclos_faltam,
      proximo_nivel: usarRef
        ? (proxRefCalc.proximo ? proxRefCalc.proximo.label.toUpperCase() : "TOPO")
        : (proxAtual ? proxAtual.label.toUpperCase() : "TOPO"),
      desconto_proximo: usarRef
        ? (proxRefCalc.proximo?.descontoPct ?? 0)
        : (proxAtual?.descontoPct ?? 0),
      faltam_proximo: c.ciclos_faltam,
      mes_ref_nome: nomeDoMes(mesRefStr),
      mes_aplic_nome: nomeDoMes(mesAplicacao),
      link_portal: LINK_PORTAL_CLIENTE,
    });
  }, [templateDe, mesRefStr, mesAplicacao]);

  async function alternarEnviado(c: SituacaoCliente, valor: boolean) {
    await onAlternar(c.cliente_id, c.unidade_id, valor);
  }

  function abrirWhatsApp(c: SituacaoCliente) {
    const msg = mensagemDe(c);
    if (!c.telefone || !msg) return;
    window.open(linkWhatsApp(c.telefone, msg), "_blank", "noopener");
    // marca automaticamente como enviado (dá pra desmarcar na caixa)
    if (!enviados.has(c.cliente_id)) void alternarEnviado(c, true);
  }

  if (situacao.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-10 text-center">
        <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <div className="text-[13px] font-semibold">Sem dados nas unidades selecionadas</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Confira o filtro de unidades acima ou importe vendas de {nomeDoMes(mesRefStr)}.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-brand-cyan/8 to-brand-blue/8">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-display font-bold text-[14px] inline-flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-cyan" />
              Situação de todos os clientes · {nomeDoMes(mesAplicacao)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Nível vigente conquistado em {nomeDoMes(mesRefStr)} · a contagem de ciclos <strong>zerou no dia 1º</strong> e
              a nova corrida define se o nível avança ou retrocede no fim de {nomeDoMes(mesAplicacao)}.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 border border-border bg-muted/30 rounded-md px-2.5 py-1.5">
              <Filter className="w-3 h-3 text-muted-foreground" />
              <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value as NivelClube | "todos")}
                className="bg-transparent text-[11px] outline-none">
                <option value="todos">Todos os níveis</option>
                {NIVEIS.map((n) => (
                  <option key={n.key} value={n.key}>{n.label}</option>
                ))}
              </select>
            </div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="form-input h-8 text-[12px] w-44 py-0"
            />
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-muted/10 px-3 py-2 flex flex-wrap gap-1">
        {situacao.map((u) => {
          const ativo = unidadeAberta === u.unidade_id;
          return (
            <button key={u.unidade_id} onClick={() => setUnidadeAberta(u.unidade_id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-smooth",
                ativo
                  ? "bg-gradient-to-r from-brand-cyan to-brand-blue text-white shadow"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground",
              )}>
              <Building2 className="w-3 h-3" />
              {u.unidade_nome}
              <span className={cn("ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold",
                ativo ? "bg-white/20" : "bg-secondary")}>
                {u.total_clientes}
              </span>
            </button>
          );
        })}
      </div>

      {situacao.filter((u) => u.unidade_id === unidadeAberta).map((u) => {
        const buscaNorm = busca.trim().toLowerCase();
        const filtrados = u.clientes.filter((c) => {
          if (filtroNivel !== "todos" && (c.nivel_vigente ?? "nao_classificado") !== filtroNivel) return false;
          if (soPendentes && enviados.has(c.cliente_id)) return false;
          if (buscaNorm) {
            return c.nome.toLowerCase().includes(buscaNorm)
              || c.cpf.replace(/\D/g, "").includes(buscaNorm.replace(/\D/g, ""))
              || (c.telefone ?? "").includes(buscaNorm);
          }
          return true;
        });
        const enviadosNaUnidade = u.clientes.filter((c) => enviados.has(c.cliente_id)).length;

        return (
          <div key={u.unidade_id}>
            {/* Sumário da unidade */}
            <div className="px-5 py-3 border-b border-border bg-card flex flex-wrap items-center gap-3">
              <div className="font-display font-bold inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-brand-cyan" />
                {u.unidade_nome}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {u.total_clientes} clientes · <span className="font-mono font-bold">{u.total_ciclos}</span> ciclos · <span className="font-mono">{fmtBRL(u.faturamento_total)}</span>
              </span>
              <span className={cn("text-[11px] font-semibold inline-flex items-center gap-1",
                enviadosNaUnidade === u.total_clientes && u.total_clientes > 0 ? "text-success" : "text-muted-foreground")}>
                <MessageCircle className="w-3 h-3" />
                {enviadosNaUnidade}/{u.total_clientes} mensagens do mês enviadas
              </span>
              <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
                <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)}
                  className="accent-brand-cyan" />
                Só pendentes
              </label>
              <div className="ml-auto flex items-center gap-1 flex-wrap">
                {NIVEIS.filter((n) => u.por_nivel[n.key] > 0).map((n) => {
                  const Icon = NIVEL_ICON[n.key];
                  return (
                    <span key={n.key}
                      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold",
                        `bg-${n.cor}/15 text-${n.cor}`)}>
                      <Icon className="w-3 h-3" />
                      {u.por_nivel[n.key]} {n.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scroll-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10 border-b border-border">
                  <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left py-2 px-3 font-semibold w-12">#</th>
                    <th className="text-left py-2 px-3 font-semibold">Cliente</th>
                    <th className="text-left py-2 px-3 font-semibold">Nível vigente (desconto do mês)</th>
                    <th className="text-right py-2 px-3 font-semibold">Ciclos este mês</th>
                    <th className="text-right py-2 px-3 font-semibold">Lav/Sec</th>
                    <th className="text-right py-2 px-3 font-semibold">Fat. mês</th>
                    <th className="text-left py-2 px-3 font-semibold">Projeção fim do mês</th>
                    <th className="text-left py-2 px-3 font-semibold">Mensagem do mês</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((c, idx) => {
                    const vig = c.nivel_vigente;
                    const corVig = vig ? corDoNivel(vig) : "muted-foreground";
                    const IconVig = NIVEL_ICON[vig ?? "nao_classificado"];
                    const corProj = corDoNivel(c.nivel_projetado);
                    const IconProj = NIVEL_ICON[c.nivel_projetado];
                    const ProxIcon = c.proximo_nivel ? NIVEL_ICON[c.proximo_nivel] : null;
                    return (
                      <motion.tr key={c.cliente_id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.005, 0.2) }}
                        className="border-b border-border/40 hover:bg-secondary/20">
                        <td className="py-2 px-3 font-mono font-bold text-muted-foreground">#{idx + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold">{c.nome}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{c.cpf}</div>
                        </td>
                        <td className="py-2 px-3">
                          {vig ? (
                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                              `bg-${corVig}/15 text-${corVig}`)}>
                              <IconVig className="w-3 h-3" />
                              {labelDoNivel(vig)} · {c.desconto_vigente}% OFF
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60">sem desconto este mês</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="font-mono font-bold">{c.ciclos}</span>
                          {c.ciclos === 0 && <span className="ml-1 text-[9px] text-muted-foreground/60">nova contagem</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-muted-foreground">
                          {c.ciclos_lavagem}/{c.ciclos_secagem}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{fmtBRL(c.faturamento)}</td>
                        <td className="py-2 px-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                              `text-${corProj}`)}>
                              <IconProj className="w-3 h-3" />
                              {c.nivel_projetado === "nao_classificado" ? "Sem nível" : labelDoNivel(c.nivel_projetado)}
                              {c.desconto_projetado > 0 && <span>· {c.desconto_projetado}%</span>}
                            </span>
                            {c.proximo_nivel && ProxIcon ? (
                              <span className="text-[10px] text-muted-foreground">
                                faltam <span className="font-mono font-bold text-warning">{c.ciclos_faltam}</span> p/ {labelDoNivel(c.proximo_nivel)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-success font-semibold inline-flex items-center gap-1">
                                <Gem className="w-2.5 h-2.5" /> Topo do programa
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {c.telefone && mensagemDe(c) ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => abrirWhatsApp(c)}
                                title={`Abrir WhatsApp Web com a mensagem pronta\n\n${mensagemDe(c)}`}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-smooth",
                                  enviados.has(c.cliente_id)
                                    ? "bg-secondary text-muted-foreground hover:text-foreground"
                                    : "bg-[#25D366]/15 text-[#128a44] hover:bg-[#25D366]/25",
                                )}>
                                <MessageCircle className="w-3.5 h-3.5" />
                                Conversar
                              </button>
                              {templateDe(c)?.banner_url && (
                                <BotaoCopiarBanner url={templateDe(c)!.banner_url!} />
                              )}
                              <label
                                title="Cliente já recebeu a mensagem de qualificação deste mês"
                                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={enviados.has(c.cliente_id)}
                                  onChange={(e) => alternarEnviado(c, e.target.checked)}
                                  className="accent-[#25D366]"
                                />
                                {enviados.has(c.cliente_id)
                                  ? <span className="text-success font-semibold">enviada</span>
                                  : "enviada?"}
                              </label>
                            </div>
                          ) : (
                            <span className="text-[10px] opacity-40 inline-flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" /> sem telefone
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
              {filtrados.length === 0 && (
                <div className="py-8 text-center text-[12px] text-muted-foreground">
                  Nenhum cliente bate com os filtros atuais.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

void ChevronRight; void Calendar;
