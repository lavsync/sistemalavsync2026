"use client";

// Financeiro › Relatórios DRE — gerar, visualizar, baixar e arquivar o DRE
// em PDF (mensal, trimestral, semestral, anual · unidade ou consolidado).

import * as React from "react";
import {
  FileText, Eye, Download, Save, Loader2, Trash2, ExternalLink, Archive, Check, AlertTriangle, Layers, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TipoPeriodo } from "@/lib/financeiro/dre-periodo";
import type { RelatorioSalvo } from "@/lib/financeiro/dre-relatorio";
import {
  salvarRelatorioDRE, listarRelatoriosDRE, urlRelatorioDRE, excluirRelatorioDRE,
} from "@/lib/financeiro/dre-relatorios-actions";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TIPOS: Array<{ v: TipoPeriodo; l: string }> = [
  { v: "mensal", l: "Mensal" }, { v: "trimestral", l: "Trimestral" }, { v: "semestral", l: "Semestral" }, { v: "anual", l: "Anual" },
];

function opcoesNumero(tipo: TipoPeriodo): Array<{ v: number; l: string }> {
  if (tipo === "mensal") return MESES.map((m, i) => ({ v: i + 1, l: m }));
  if (tipo === "trimestral") return [1, 2, 3, 4].map((t) => ({ v: t, l: `${t}º trimestre` }));
  if (tipo === "semestral") return [1, 2].map((t) => ({ v: t, l: `${t}º semestre` }));
  return [{ v: 1, l: "Ano completo" }];
}

/** Último período FECHADO do tipo (o corrente ainda está em aberto). */
function padrao(tipo: TipoPeriodo): { ano: number; numero: number } {
  const h = new Date(); const ano = h.getFullYear(), mes = h.getMonth() + 1;
  if (tipo === "mensal") return mes === 1 ? { ano: ano - 1, numero: 12 } : { ano, numero: mes - 1 };
  if (tipo === "trimestral") { const t = Math.ceil(mes / 3); return t === 1 ? { ano: ano - 1, numero: 4 } : { ano, numero: t - 1 }; }
  if (tipo === "semestral") return mes <= 6 ? { ano: ano - 1, numero: 2 } : { ano, numero: 1 };
  return { ano: ano - 1, numero: 1 };
}

function rotuloPeriodo(r: { tipo: TipoPeriodo; ano: number; numero: number }): string {
  if (r.tipo === "mensal") return `${MESES[r.numero - 1]}/${r.ano}`;
  if (r.tipo === "trimestral") return `${r.numero}º tri/${r.ano}`;
  if (r.tipo === "semestral") return `${r.numero}º sem/${r.ano}`;
  return `Ano ${r.ano}`;
}

export function DRERelatorios({ unidades, anoInicial }: { unidades: Array<{ id: string; nome: string }>; anoInicial: number }) {
  const [escopo, setEscopo] = React.useState("consolidado");
  const [tipo, setTipo] = React.useState<TipoPeriodo>("mensal");
  const [ano, setAno] = React.useState(padrao("mensal").ano);
  const [numero, setNumero] = React.useState(padrao("mensal").numero);
  const [viewer, setViewer] = React.useState<{ url: string; titulo: string } | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [arquivo, setArquivo] = React.useState<RelatorioSalvo[] | null>(null);
  const viewerRef = React.useRef<HTMLDivElement>(null);

  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: anoAtual - anoInicial + 1 }, (_, i) => anoAtual - i);
  const escopoNome = escopo === "consolidado" ? "Consolidado" : unidades.find((u) => u.id === escopo)?.nome ?? "";

  const query = `escopo=${encodeURIComponent(escopo)}&tipo=${tipo}&ano=${ano}&numero=${numero}`;
  const urlPdf = `/api/financeiro/dre-pdf?${query}`;

  const recarregar = React.useCallback(async () => {
    try { setArquivo(await listarRelatoriosDRE()); } catch { setArquivo([]); }
  }, []);
  React.useEffect(() => {
    let vivo = true;
    listarRelatoriosDRE().then((r) => { if (vivo) setArquivo(r); }).catch(() => { if (vivo) setArquivo([]); });
    return () => { vivo = false; };
  }, []);

  function trocarTipo(t: TipoPeriodo) {
    setTipo(t);
    const p = padrao(t); setAno(p.ano); setNumero(p.numero);
  }

  function abrir(url: string, titulo: string) {
    setViewer({ url, titulo });
    setTimeout(() => viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function salvar() {
    setSalvando(true); setMsg(null);
    const r = await salvarRelatorioDRE({ escopo, tipo, ano, numero });
    setSalvando(false);
    if (!r.ok) { setMsg({ ok: false, texto: r.erro }); return; }
    setMsg({ ok: true, texto: `Salvo no arquivo: ${rotuloPeriodo(r.relatorio)} · ${escopoNome}.` });
    void recarregar();
  }

  async function verSalvo(r: RelatorioSalvo) {
    const url = await urlRelatorioDRE(r.path);
    if (url) abrir(url, `${rotuloPeriodo(r)} · ${r.escopo}`);
  }
  async function baixarSalvo(r: RelatorioSalvo) {
    const url = await urlRelatorioDRE(r.path, true);
    if (url) window.location.href = url;
  }
  async function excluir(r: RelatorioSalvo) {
    if (!confirm(`Excluir o relatório ${rotuloPeriodo(r)} · ${r.escopo}?`)) return;
    const res = await excluirRelatorioDRE(r.path);
    if (!res.ok) { setMsg({ ok: false, texto: res.erro ?? "Falha ao excluir." }); return; }
    void recarregar();
  }

  return (
    <div className="space-y-5">
      {/* Gerador */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="font-display font-bold inline-flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-brand-cyan" /> Relatório DRE para sócios
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          PDF com demonstrativo, comparativo com o período anterior, evolução mensal e leitura automática dos números.
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Escopo</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip ativo={escopo === "consolidado"} onClick={() => setEscopo("consolidado")} icon={Layers}>Consolidado</Chip>
              {unidades.map((u) => (
                <Chip key={u.id} ativo={escopo === u.id} onClick={() => setEscopo(u.id)} icon={Building2}>{u.nome}</Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Período</div>
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
                {TIPOS.map((t) => (
                  <button key={t.v} onClick={() => trocarTipo(t.v)}
                    className={cn("px-3 py-1.5 rounded-md text-[12px] font-semibold transition-smooth",
                      tipo === t.v ? "bg-brand-cyan text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            {tipo !== "anual" && (
              <select value={numero} onChange={(e) => setNumero(Number(e.target.value))} className="form-input w-auto h-9 py-0 text-[12px]">
                {opcoesNumero(tipo).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            )}
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="form-input w-auto h-9 py-0 text-[12px] font-mono">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => abrir(urlPdf, `${rotuloPeriodo({ tipo, ano, numero })} · ${escopoNome}`)} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
            <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
          </Button>
          <Button variant="outline" onClick={() => { window.location.href = `${urlPdf}&download=1`; }}>
            <Download className="w-3.5 h-3.5 mr-1" /> Baixar PDF
          </Button>
          <Button variant="outline" onClick={salvar} disabled={salvando} className="border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/10">
            {salvando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar no arquivo
          </Button>
          {msg && (
            <span className={cn("text-[11px] inline-flex items-center gap-1", msg.ok ? "text-success" : "text-danger")}>
              {msg.ok ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {msg.texto}
            </span>
          )}
        </div>
      </div>

      {/* Visualizador */}
      {viewer && (
        <div ref={viewerRef} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <Eye className="w-4 h-4 text-brand-cyan" />
            <span className="text-[13px] font-semibold truncate">{viewer.titulo}</span>
            <a href={viewer.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] text-brand-cyan font-semibold inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="w-3 h-3" /> Abrir em nova aba
            </a>
          </div>
          <iframe key={viewer.url} src={viewer.url} title={viewer.titulo} className="w-full h-[78vh] bg-muted/20" />
        </div>
      )}

      {/* Arquivo */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-display font-bold inline-flex items-center gap-1.5 w-full">
          <Archive className="w-4 h-4 text-brand-cyan" /> Relatórios salvos
          {arquivo && <span className="ml-1 text-[11px] font-normal text-muted-foreground">({arquivo.length})</span>}
        </div>
        {arquivo == null ? (
          <div className="p-6 text-center text-[12px] text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Carregando…</div>
        ) : arquivo.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-muted-foreground">Nenhum relatório salvo ainda. Gere um acima e clique em &quot;Salvar no arquivo&quot;.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/20">
                <th className="text-left py-2 px-3 font-semibold">Período</th>
                <th className="text-left py-2 px-3 font-semibold">Escopo</th>
                <th className="text-left py-2 px-3 font-semibold">Gerado em</th>
                <th className="text-left py-2 px-3 font-semibold">Por</th>
                <th className="text-right py-2 px-3 font-semibold">Ações</th>
              </tr></thead>
              <tbody>
                {arquivo.map((r) => (
                  <tr key={r.path} className="border-b border-border/40">
                    <td className="py-1.5 px-3 font-semibold">{rotuloPeriodo(r)}</td>
                    <td className="py-1.5 px-3">{r.escopo}</td>
                    <td className="py-1.5 px-3 font-mono text-muted-foreground">{r.gerado_em}</td>
                    <td className="py-1.5 px-3 text-muted-foreground">{r.gerado_por}</td>
                    <td className="py-1.5 px-3 text-right whitespace-nowrap">
                      <button onClick={() => verSalvo(r)} className="px-2 py-0.5 text-[11px] text-brand-cyan font-semibold hover:underline inline-flex items-center gap-1"><Eye className="w-3 h-3" /> Ver</button>
                      <button onClick={() => baixarSalvo(r)} className="px-2 py-0.5 text-[11px] text-brand-cyan font-semibold hover:underline inline-flex items-center gap-1"><Download className="w-3 h-3" /> Baixar</button>
                      <button onClick={() => excluir(r)} aria-label="Excluir" className="ml-1 w-6 h-6 inline-flex items-center justify-center text-muted-foreground hover:text-danger"><Trash2 className="w-3 h-3" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ ativo, onClick, icon: Icon, children }: { ativo: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-smooth inline-flex items-center gap-1.5",
        ativo ? "bg-brand-cyan text-primary-foreground border-brand-cyan" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary")}>
      <Icon className="w-3 h-3" /> {children}
    </button>
  );
}
