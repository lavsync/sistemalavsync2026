"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Trophy, Crown, Gem, Award, Medal, Sparkles, RefreshCw, Send,
  Loader2, ChevronRight, Users, TrendingDown, Phone, Filter,
  Building2, Calendar, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NIVEIS, type NivelClube, labelDoNivel, emojiDoNivel, corDoNivel } from "@/lib/clube/niveis";
import type { Classificacao, ResumoClube, TemplateMensagem } from "@/lib/clube/queries";
import { classificarMes, gerarDisparosClube } from "@/lib/clube/actions";

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
}: {
  resumo: ResumoClube;
  classificacoes: Classificacao[];
  mesAplicacao: string;
  mesesDisponiveis: string[];
  unidades: Unidade[];
  templates: TemplateMensagem[];
  selecaoUnidadeIds: string[];
}) {
  const [classificando, setClassificando] = React.useState(false);
  const [disparandoTpl, setDisparandoTpl] = React.useState<string | null>(null);
  const [filtroNivel, setFiltroNivel] = React.useState<NivelClube | "todos">("todos");

  // mes_ref = mes_aplicacao - 1
  const mesRefDate = new Date(mesAplicacao + "T12:00:00");
  mesRefDate.setMonth(mesRefDate.getMonth() - 1);
  const mesRefStr = `${mesRefDate.getFullYear()}-${String(mesRefDate.getMonth() + 1).padStart(2, "0")}-01`;

  const filtradas = classificacoes.filter((c) => filtroNivel === "todos" || c.nivel === filtroNivel);

  async function onReclassificar() {
    if (!confirm(
      `Reclassificar TODOS os clientes baseado em ${nomeDoMes(mesRefStr)}?\n\n` +
      `Vai analisar todas as vendas de ${nomeDoMes(mesRefStr)} e atualizar os benefícios pra ${nomeDoMes(mesAplicacao)}.`
    )) return;
    setClassificando(true);
    try {
      const r = await classificarMes(mesRefStr);
      alert(`✓ ${r.classificados} clientes classificados:\n\n` +
        `🥉 Bronze: ${r.porNivel.bronze}\n🥈 Prata: ${r.porNivel.prata}\n🥇 Ouro: ${r.porNivel.ouro}\n💎 Diamante: ${r.porNivel.diamante}`
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
          <div className="flex items-center gap-2">
            <select
              value={mesAplicacao}
              onChange={(e) => {
                const url = new URL(window.location.href);
                url.searchParams.set("mes_aplic", e.target.value);
                window.location.href = url.toString();
              }}
              className="form-input text-[12px] h-8 py-0"
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
          {NIVEIS.filter((n) => n.key !== "nao_classificado").map((n) => (
            <div key={n.key} className={cn("rounded-lg border border-border p-2 text-[11px]")}>
              <div className="font-bold text-[12px] inline-flex items-center gap-1">
                <span>{n.emoji}</span>
                <span className={cn(`text-${n.cor}`)}>{n.label}</span>
              </div>
              <div className="text-muted-foreground mt-0.5">
                {n.ciclosMax != null ? `${n.ciclosMin}–${n.ciclosMax}` : `${n.ciclosMin}+`} ciclos · <strong>{n.descontoPct}% OFF</strong>
              </div>
            </div>
          ))}
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
                  <span className="text-lg leading-none">{n.emoji}</span>
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

      {/* Templates de mensagem */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-[14px] inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
            Banco de mensagens WhatsApp ({templates.length})
          </h3>
          <span className="text-[10px] text-muted-foreground">Clica em &quot;Disparar&quot; pra gerar campanha no log</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {templates.map((t) => {
            const tipoCor =
              t.tipo === "parabens_nivel" ? "success" :
              t.tipo === "faltam_ciclos" ? "warning" :
              t.tipo === "pontos_disponiveis" ? "brand-cyan" :
              "brand-purple";
            return (
              <div key={t.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                      `bg-${tipoCor}/15 text-${tipoCor}`)}>
                      {t.tipo.replace(/_/g, " ")}
                    </span>
                    {t.nivel_alvo && (
                      <span className="text-[10px] font-semibold text-muted-foreground inline-flex items-center gap-0.5">
                        {emojiDoNivel(t.nivel_alvo as NivelClube)} {labelDoNivel(t.nivel_alvo as NivelClube)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-semibold text-[12px] mb-1">{t.titulo}</div>
                <div className="rounded bg-card p-2 text-[11px] text-muted-foreground italic line-clamp-3 mb-2">
                  &ldquo;{t.mensagem}&rdquo;
                </div>
                <button
                  onClick={() => onDispararTemplate(t)}
                  disabled={disparandoTpl === t.id || resumo.total === 0}
                  className="w-full px-2 py-1.5 rounded text-[11px] font-bold text-white bg-gradient-to-r from-brand-cyan to-brand-blue hover:opacity-90 inline-flex items-center justify-center gap-1 disabled:opacity-40"
                >
                  {disparandoTpl === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Disparar
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtro nível */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value as NivelClube | "todos")}
            className="form-input h-7 py-0 text-[12px]">
            <option value="todos">Todos os níveis ({resumo.total})</option>
            {NIVEIS.filter((n) => n.key !== "nao_classificado").map((n) => (
              <option key={n.key} value={n.key}>{n.emoji} {n.label} ({resumo.porNivel[n.key]})</option>
            ))}
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
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          `bg-${cor}/15 text-${cor}`)}>
                          {emojiDoNivel(m.nivel)} {labelDoNivel(m.nivel)}
                        </span>
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

void ChevronRight; void Building2; void Calendar; void Layers;
