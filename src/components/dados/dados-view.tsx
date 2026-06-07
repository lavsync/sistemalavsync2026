"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Download, Database, Users, ShoppingCart, Wallet, ClipboardList,
  Megaphone, Send, Wrench, FileSpreadsheet, Building2, Calendar,
  Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { gerarExport, type TipoExport } from "@/lib/exports/actions";

type Unidade = { id: string; nome: string };

type ExportSpec = {
  key: TipoExport;
  titulo: string;
  descricao: string;
  icon: React.ElementType;
  cor: string;
  temPeriodo: boolean;
};

const SPECS: ExportSpec[] = [
  { key: "clientes",            titulo: "Clientes",                descricao: "Base completa com LTV, métricas 7/30/90d, último contato",                  icon: Users,           cor: "brand-cyan",   temPeriodo: false },
  { key: "vendas",              titulo: "Vendas",                  descricao: "Todas as vendas com cliente, pagamento, cupom, equipamento, requisição",   icon: ShoppingCart,    cor: "success",      temPeriodo: true  },
  { key: "despesas",            titulo: "Despesas",                descricao: "Lançamentos por unidade + categoria + fornecedor + status",                icon: Wallet,          cor: "warning",      temPeriodo: true  },
  { key: "maquinas",            titulo: "Máquinas",                descricao: "Cadastro completo: fabricante, serial, manutenções, localização",         icon: Wrench,          cor: "brand-purple", temPeriodo: false },
  { key: "ordens_servico",      titulo: "Ordens de Serviço",       descricao: "Manutenções preventivas/corretivas com custo estimado vs real",            icon: ClipboardList,   cor: "warning",      temPeriodo: true  },
  { key: "campanhas",           titulo: "Campanhas Marketing",     descricao: "Campanhas com totais de envios, segmento, canal, taxa de entrega",        icon: Megaphone,       cor: "brand-cyan",   temPeriodo: false },
  { key: "envios_marketing",    titulo: "Envios Marketing",        descricao: "Log completo de envios com mensagem renderizada (pra disparar manual)",    icon: Send,            cor: "brand-purple", temPeriodo: false },
  { key: "importacoes_vendas",  titulo: "Histórico Imports Vendas",descricao: "Log de planilhas de vendas importadas",                                    icon: FileSpreadsheet, cor: "muted-foreground", temPeriodo: false },
  { key: "importacoes_clientes",titulo: "Histórico Imports Clientes",descricao: "Log de planilhas de clientes importadas",                                icon: FileSpreadsheet, cor: "muted-foreground", temPeriodo: false },
];

export function DadosView({ unidades }: { unidades: Unidade[] }) {
  const [unidadeId, setUnidadeId] = React.useState<string>("todas");
  const [from, setFrom] = React.useState<string>("");
  const [to, setTo] = React.useState<string>("");
  const [exportando, setExportando] = React.useState<TipoExport | null>(null);
  const [ultimo, setUltimo] = React.useState<{ key: TipoExport; rows: number; filename: string } | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  async function exportar(spec: ExportSpec) {
    setExportando(spec.key);
    setErro(null);
    try {
      const r = await gerarExport({
        tipo: spec.key,
        unidadeId: unidadeId !== "todas" ? unidadeId : undefined,
        from: spec.temPeriodo && from ? from : undefined,
        to:   spec.temPeriodo && to   ? to   : undefined,
      });
      downloadCsv(r.filename, r.content);
      setUltimo({ key: spec.key, rows: r.rows, filename: r.filename });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(null);
    }
  }

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Exportar dados (CSV)"
        subtitle="Baixe qualquer dado do sistema em CSV compatível com Excel/Sheets/Numbers. Separador ; · UTF-8 com BOM · datas BR."
      />

      {/* Filtros globais */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          Filtros aplicados a TODOS os exports abaixo:
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}
            className="form-input h-7 py-0 text-[12px]">
            <option value="todas">Todas unidades</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Período</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="form-input h-7 py-0 text-[11px] font-mono" />
          <span className="text-muted-foreground">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="form-input h-7 py-0 text-[11px] font-mono" />
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }}
              className="text-[10px] text-muted-foreground hover:text-foreground underline">limpar</button>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground ml-auto">
          O período só se aplica aos exports marcados com 📅
        </div>
      </div>

      {/* Feedback do último export */}
      {(ultimo || erro) && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-xl border p-3 flex items-center gap-3 text-[12px]",
            erro ? "border-danger/30 bg-danger/5" : "border-success/30 bg-success/5")}>
          {erro ? <AlertCircle className="w-4 h-4 text-danger" /> : <CheckCircle2 className="w-4 h-4 text-success" />}
          {erro ? (
            <span><strong>Erro:</strong> {erro}</span>
          ) : ultimo && (
            <span>
              ✓ Baixado <strong>{ultimo.filename}</strong> com <strong>{ultimo.rows.toLocaleString("pt-BR")}</strong> {ultimo.rows === 1 ? "linha" : "linhas"}.
            </span>
          )}
        </motion.div>
      )}

      {/* Grid de exports */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {SPECS.map((spec) => {
          const Icon = spec.icon;
          const ativo = exportando === spec.key;
          return (
            <div key={spec.key} className="rounded-2xl border border-border bg-card p-4 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  `bg-${spec.cor}/15 text-${spec.cor}`)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[13px] flex items-center gap-1">
                    {spec.titulo}
                    {spec.temPeriodo && <span title="Respeita filtro de período" className="text-[10px]">📅</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{spec.descricao}</div>
                </div>
              </div>
              <Button
                onClick={() => exportar(spec)}
                disabled={ativo}
                className="mt-auto bg-gradient-to-r from-brand-cyan to-brand-blue text-white"
              >
                {ativo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                {ativo ? "Gerando…" : "Exportar CSV"}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Info técnica */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 text-[11px] text-muted-foreground">
        <div className="font-display font-bold text-foreground mb-1 inline-flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-brand-cyan" /> Formato dos CSVs
        </div>
        <ul className="space-y-1 list-disc pl-4">
          <li>Separador <code>;</code> (compatível com Excel BR direto, sem importar manualmente)</li>
          <li>Encoding UTF-8 com BOM — acentos e emoji preservados no Excel</li>
          <li>Datas no formato <code>DD/MM/AAAA</code> ou <code>DD/MM/AAAA HH:MM</code></li>
          <li>Valores em R$ no formato BR <code>1.234,56</code></li>
          <li>Aspas e quebras de linha automaticamente escapadas</li>
          <li>Sem limite de linhas (vendas: até 50k por export)</li>
        </ul>
      </div>
    </div>
  );
}
