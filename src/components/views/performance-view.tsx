"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  TrendingUp, Receipt, Users, RefreshCw,
  Droplet, Wind, Tag, Gift, Upload,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard, LegendDot } from "@/components/ui/chart-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { tooltipFormatter } from "@/lib/recharts-helpers";
import type {
  ResumoPerformance, FaturamentoPagamentoSlice, DiaSemanaPoint, EvolucaoMensalPoint,
  CupomUso, VoucherUso,
} from "@/lib/vendas-queries";
import { ImportarVendasDialog } from "@/components/performance/importar-vendas-dialog";
import { PerformanceMesFiltro } from "@/components/performance/mes-filtro";
import { UnidadeMultiSwitcher } from "@/components/ui/unidade-multi-switcher";

function fmtBRL(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtMesRef(mesRef: string | null): string {
  if (!mesRef) return "";
  const m = /^(\d{4})-(\d{2})$/.exec(mesRef);
  if (!m) return "";
  return `${MES_ABBR[Number(m[2]) - 1]}/${m[1].slice(2)}`;
}

export function PerformanceView({
  unidadeId, unidadeNome, unidades, selecaoUnidades,
  resumo, pagamentos, diaSemana, evolucao,
  cupons, cuponsMesRef, vouchers, vouchersMesRef,
}: {
  unidadeId: string;
  unidadeNome: string;
  unidades?: { id: string; nome: string }[];
  selecaoUnidades?: { ids: string[]; todas: boolean; rotulo: string };
  resumo: ResumoPerformance;
  pagamentos: FaturamentoPagamentoSlice[];
  diaSemana: DiaSemanaPoint[];
  evolucao: EvolucaoMensalPoint[];
  cupons: CupomUso[];
  cuponsMesRef: string | null;
  vouchers: VoucherUso[];
  vouchersMesRef: string | null;
}) {
  const [importOpen, setImportOpen] = React.useState(false);
  const baseVazia = resumo.totalVendasBase === 0;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow={`Performance · ${unidadeNome}`}
        title="Vendas, ciclos e indicadores operacionais"
        subtitle={
          baseVazia
            ? "Nenhuma venda importada ainda. Carregue os relatórios MAXPAN/VM pra começar."
            : `${resumo.totalVendasBase.toLocaleString("pt-BR")} vendas na base · última importação ${resumo.ultimaImportacaoEm ? new Date(resumo.ultimaImportacaoEm).toLocaleString("pt-BR") : "—"}`
        }
        actions={
          <div className="flex items-center gap-2">
            {unidades && selecaoUnidades && (
              <UnidadeMultiSwitcher
                unidades={unidades}
                selecionadas={selecaoUnidades.ids}
                todasMarcadas={selecaoUnidades.todas}
                rotulo={selecaoUnidades.rotulo}
                variant="card"
              />
            )}
            <Button size="sm" className="text-xs h-8 bg-gradient-to-r from-brand-cyan to-brand-blue text-white" onClick={() => setImportOpen(true)}>
              <Upload className="w-3 h-3 mr-1" /> Importar vendas
            </Button>
          </div>
        }
      />

      {!baseVazia && <PerformanceMesFiltro />}

      {baseVazia && <EstadoVazio unidadeNome={unidadeNome} onImportar={() => setImportOpen(true)} />}

      {!baseVazia && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Faturamento mês" value={fmtBRL(resumo.faturamentoMes)}
              delta={{ value: Math.abs(resumo.variacaoFaturamento), direction: resumo.variacaoFaturamento >= 0 ? "up" : "down" }}
              deltaLabel={`vs ${fmtBRL(resumo.faturamentoMesAnterior)} mês ant.`} tone="success" icon={TrendingUp} />
            <KpiCard label="Ciclos totais (mês)" value={resumo.ciclosMes.toString()}
              delta={{ value: Math.abs(resumo.variacaoCiclos), direction: resumo.variacaoCiclos >= 0 ? "up" : "down" }}
              deltaLabel={`vs ${resumo.ciclosMesAnterior} mês ant.`} tone="cyan" icon={RefreshCw} />
            <KpiCard label="Ticket médio" value={fmtBRL(resumo.ticketMedio)}
              delta={{ value: 0, direction: "neutral" }} deltaLabel="faturamento ÷ ciclos" tone="purple" icon={Receipt} />
            <KpiCard label="Base de clientes" value={resumo.totalClientesBase.toLocaleString("pt-BR")}
              delta={{ value: resumo.novosClientesMes, direction: resumo.novosClientesMes > 0 ? "up" : "neutral" }}
              deltaLabel={`+${resumo.novosClientesMes} novos no mês`} tone="warning" icon={Users} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Ciclos lavagem (mês)" value={resumo.ciclosLavagem.toString()}
              delta={{ value: pct(resumo.ciclosLavagem, resumo.ciclosMes), direction: "up" }}
              deltaLabel="% dos ciclos" tone="cyan" icon={Droplet} />
            <KpiCard label="Ciclos secagem (mês)" value={resumo.ciclosSecagem.toString()}
              delta={{ value: pct(resumo.ciclosSecagem, resumo.ciclosMes), direction: "up" }}
              deltaLabel="% dos ciclos" tone="purple" icon={Wind} />
            <KpiCard label="Cupons (mês)" value={resumo.cuponsQtd.toString()}
              delta={{ value: resumo.cuponsValor, direction: "up" }}
              deltaLabel={fmtBRL(resumo.cuponsValor)} tone="warning" icon={Tag} />
            <KpiCard label="Vouchers (mês)" value={resumo.vouchersQtd.toString()}
              delta={{ value: resumo.vouchersValor, direction: "up" }}
              deltaLabel={fmtBRL(resumo.vouchersValor)} tone="success" icon={Gift} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCard title="Faturamento por tipo de pagamento"
              subtitle="Distribuição da receita total · cartão / PIX / voucher / cupom" height={320}>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] h-full gap-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pagamentos} dataKey="valor" nameKey="label" innerRadius={56} outerRadius={100} paddingAngle={2} strokeWidth={0}>
                      {pagamentos.map((s) => <Cell key={s.key} fill={s.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                      formatter={tooltipFormatter<number>((v, n) => {
                        const slice = pagamentos.find((s) => s.label === n);
                        return [`${fmtBRL(Number(v))} (${slice?.percent ?? 0}%)`, n];
                      })}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 justify-center text-[11px]">
                  {pagamentos.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{s.label}</div>
                          <div className="text-[10px] text-muted-foreground">{s.count} vendas</div>
                        </div>
                      </div>
                      <div className="font-mono font-bold tabular-nums">{s.percent}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Clientes × dia da semana · últimos 30d"
              subtitle="Volume de clientes únicos por dia" height={320}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diaSemana} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                    formatter={tooltipFormatter<number>((v) => [`${v}`, "Clientes"])}
                  />
                  <Bar dataKey="clientes" fill="var(--brand-cyan)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Evolução mensal · clientes × faturamento"
            subtitle="Últimos 12 meses · clientes únicos + faturamento" height={340}
            actions={
              <div className="flex items-center gap-3 text-[11px]">
                <LegendDot color="var(--brand-cyan)" /> Clientes únicos
                <LegendDot color="var(--brand-purple)" /> Faturamento (R$)
              </div>
            }>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                  formatter={tooltipFormatter<number>((v, n) => n === "clientes" ? [`${v} clientes`, "Clientes únicos"] : [`${fmtBRL(Number(v))}`, "Faturamento"])}
                />
                <Line yAxisId="left" type="monotone" dataKey="clientes" stroke="var(--brand-cyan)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--brand-cyan)" }} />
                <Line yAxisId="right" type="monotone" dataKey="faturamento" stroke="var(--brand-purple)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--brand-purple)" }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Faturamento por dia da semana · últimos 30d"
            subtitle="Identifica picos e quedas dentro da semana" height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={diaSemana} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                  formatter={tooltipFormatter<number>((v) => [fmtBRL(Number(v)), "Faturamento"])}
                />
                <Area type="monotone" dataKey="faturamento" stroke="var(--brand-cyan)" strokeWidth={2.5} fill="url(#gradDS)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {(cupons.length > 0 || vouchers.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {cupons.length > 0 && (
                <ChartCard title={`Cupons usados${cuponsMesRef ? ` · ${fmtMesRef(cuponsMesRef)}` : " · mês"}`}
                  subtitle={`${cupons.reduce((s, c) => s + c.qtd, 0)} usos · ${fmtBRL(cupons.reduce((s, c) => s + c.desconto, 0))} em descontos`}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="text-left font-semibold py-2 px-3">Código</th>
                        <th className="text-right font-semibold py-2 px-3">Usos</th>
                        <th className="text-right font-semibold py-2 px-3">Receita</th>
                        <th className="text-right font-semibold py-2 px-3">Desconto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cupons.map((c) => (
                        <motion.tr key={c.codigo} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="border-b border-border/40">
                          <td className="py-2 px-3 font-mono font-semibold text-warning">{c.codigo}</td>
                          <td className="py-2 px-3 text-right font-mono">{c.qtd}</td>
                          <td className="py-2 px-3 text-right font-mono">{fmtBRL(c.valor)}</td>
                          <td className="py-2 px-3 text-right font-mono text-danger">−{fmtBRL(c.desconto)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </ChartCard>
              )}
              {vouchers.length > 0 && (
                <ChartCard title={`Vouchers usados${vouchersMesRef ? ` · ${fmtMesRef(vouchersMesRef)}` : " · mês"}`}
                  subtitle={`${vouchers.reduce((s, v) => s + v.qtd, 0)} usos · ${fmtBRL(vouchers.reduce((s, v) => s + v.valor, 0))} em cortesias`}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="text-left font-semibold py-2 px-3">Código</th>
                        <th className="text-left font-semibold py-2 px-3">Categoria</th>
                        <th className="text-right font-semibold py-2 px-3">Usos</th>
                        <th className="text-right font-semibold py-2 px-3">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map((v) => (
                        <motion.tr key={v.codigo} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="border-b border-border/40">
                          <td className="py-2 px-3 font-mono font-semibold text-success">{v.codigo}</td>
                          <td className="py-2 px-3 text-muted-foreground">{v.categoria ?? "—"}</td>
                          <td className="py-2 px-3 text-right font-mono">{v.qtd}</td>
                          <td className="py-2 px-3 text-right font-mono">{fmtBRL(v.valor)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </ChartCard>
              )}
            </div>
          )}
        </>
      )}

      <ImportarVendasDialog open={importOpen} onOpenChange={setImportOpen} unidadeId={unidadeId} unidadeNome={unidadeNome} />
    </div>
  );
}

function EstadoVazio({ unidadeNome, onImportar }: { unidadeNome: string; onImportar: () => void }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-brand-cyan/30 bg-gradient-to-br from-brand-cyan/5 to-brand-purple/5 p-10 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-cyan/15 to-brand-purple/15 border border-brand-cyan/25 flex items-center justify-center mb-4">
        <Receipt className="w-7 h-7 text-brand-cyan" />
      </div>
      <h2 className="font-display text-xl font-bold mb-2">Performance vazia · {unidadeNome}</h2>
      <p className="text-[13px] text-muted-foreground max-w-md mx-auto mb-5">
        Importe os relatórios de vendas do <strong>MAXPAN</strong> ou <strong>VM Tecnologia</strong> (formato XLSX) pra ver faturamento, ciclos e indicadores em tempo real.
      </p>
      <Button size="lg" className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white" onClick={onImportar}>
        <Upload className="w-4 h-4 mr-2" /> Importar relatório
      </Button>
    </div>
  );
}

function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}
