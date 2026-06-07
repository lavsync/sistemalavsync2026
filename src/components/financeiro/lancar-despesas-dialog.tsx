"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, X, Loader2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CustoFixo, CustoVariavel } from "@/lib/financeiro/engine";
import { lancarDespesasLote, type LancarDespesaItem } from "@/lib/financeiro/despesas-actions";

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const SINONIMO_CATEGORIA: Array<{ pattern: RegExp; categoria: string }> = [
  { pattern: /aluguel|iptu/i,                  categoria: "Aluguel" },
  { pattern: /energia|luz|el[eé]trica/i,       categoria: "Energia elétrica" },
  { pattern: /[áa]gua|esgoto/i,                categoria: "Água e esgoto" },
  { pattern: /telefone|internet|telecom/i,     categoria: "Internet" },
  { pattern: /publicidade|propaganda|marketing|fundo de propaganda/i, categoria: "Marketing" },
  { pattern: /manuten[cç][aã]o|reparo/i,       categoria: "Manutenção" },
  { pattern: /sab[aã]o|amaciante|csp|qu[ií]mico/i, categoria: "Produtos químicos" },
  { pattern: /imposto|simples|iss|icms/i,      categoria: "Impostos" },
  { pattern: /folha|sal[aá]rio/i,              categoria: "Folha de pagamento" },
];
function categoriaSugerida(descricao: string): string {
  for (const s of SINONIMO_CATEGORIA) if (s.pattern.test(descricao)) return s.categoria;
  return "Outras";
}

const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type CustoLinha = {
  key: string;
  descricao: string;
  projetado: number;
  categoria_sugerida: string;
  tipo: "fixo" | "variavel";
};

export function LancarDespesasDialog({
  open,
  onOpenChange,
  unidadeId,
  unidadeNome,
  ano,
  mes,
  custosFixos,
  custosVariaveis,
  faturamentoReal,
  porDescricaoExistente,
  porCategoriaExistente,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unidadeId: string;
  unidadeNome: string;
  ano: number;
  mes: number;
  custosFixos: CustoFixo[];
  custosVariaveis: CustoVariavel[];
  faturamentoReal: number | null;
  porDescricaoExistente: Record<string, number>;
  porCategoriaExistente: Record<string, number>;
}) {
  // Montar linhas sugeridas (fixos primeiro, depois variáveis %fat)
  const linhasIniciais: CustoLinha[] = React.useMemo(() => {
    const out: CustoLinha[] = [];
    for (const cf of custosFixos) {
      if (!cf.ativo) continue;
      const usaInaug =
        cf.valor_inaugural != null && cf.meses_inaugural != null;
      // No dialog, sempre mostra valor mensal padrão; user ajusta
      const proj = usaInaug ? cf.valor_mensal : cf.valor_mensal;
      out.push({
        key: `fix-${cf.id}`,
        descricao: cf.descricao,
        projetado: proj,
        categoria_sugerida: categoriaSugerida(cf.descricao),
        tipo: "fixo",
      });
    }
    for (const cv of custosVariaveis) {
      if (!cv.ativo) continue;
      if (cv.tipo === "simples") continue; // Simples Nacional é automático
      const pct = cv.percentual_faturamento ?? 0;
      const proj = faturamentoReal != null ? faturamentoReal * (pct / 100) : 0;
      out.push({
        key: `var-${cv.id}`,
        descricao: cv.descricao,
        projetado: proj,
        categoria_sugerida: categoriaSugerida(cv.descricao),
        tipo: "variavel",
      });
    }
    return out;
  }, [custosFixos, custosVariaveis, faturamentoReal]);

  function valorJaLancado(descricao: string): number | null {
    const n = descricao.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    if (porDescricaoExistente[n] != null) return porDescricaoExistente[n];
    return null;
  }

  type Item = { key: string; descricao: string; valor: string; pago: boolean; categoria: string };
  const [itens, setItens] = React.useState<Item[]>([]);

  React.useEffect(() => {
    if (open) {
      setItens(
        linhasIniciais.map((l) => {
          const real = valorJaLancado(l.descricao);
          return {
            key: l.key,
            descricao: l.descricao,
            valor: (real ?? l.projetado).toFixed(2).replace(".", ","),
            pago: real != null,
            categoria: l.categoria_sugerida,
          };
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linhasIniciais.length]);

  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState<{ inseridas: number; atualizadas: number } | null>(null);

  const total = itens.reduce((s, i) => s + (parseFloat(i.valor.replace(",", ".")) || 0), 0);
  const projetadoTotal = linhasIniciais.reduce((s, l) => s + l.projetado, 0);

  async function salvar() {
    setSaving(true);
    setDone(null);
    const vencimento = `${ano}-${String(mes).padStart(2, "0")}-05`; // dia 5 default
    const lote: LancarDespesaItem[] = itens
      .map((i) => ({
        descricao: i.descricao,
        valor: parseFloat(i.valor.replace(",", ".")) || 0,
        vencimento,
        categoria_nome: i.categoria || null,
        pago: i.pago,
      }))
      .filter((i) => i.valor > 0);
    try {
      const r = await lancarDespesasLote(unidadeId, lote);
      setDone(r);
      setTimeout(() => onOpenChange(false), 1200);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="fixed left-[50%] top-[50%] z-50 w-[min(96vw,860px)] max-h-[90vh] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border bg-popover shadow-2xl flex flex-col overflow-hidden">

                  <header className="px-5 py-4 border-b border-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-brand-cyan" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Dialog.Title className="font-display font-bold text-[15px]">
                        Lançar despesas · {MESES_PT[mes - 1]}/{ano}
                      </Dialog.Title>
                      <Dialog.Description className="text-[12px] text-muted-foreground">
                        Unidade {unidadeNome} · valores já lançados aparecem marcados como pagos
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button className="w-8 h-8 rounded hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </Dialog.Close>
                  </header>

                  <div className="flex-1 overflow-y-auto px-5 py-3">
                    {itens.length === 0 ? (
                      <div className="text-center py-8 text-[12px] text-muted-foreground">
                        Nenhum custo configurado nesta unidade. Configure custos fixos/variáveis em Configurações.
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-popover">
                          <tr className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border">
                            <th className="text-left py-2 px-2 font-semibold">Descrição</th>
                            <th className="text-left py-2 px-2 font-semibold">Categoria</th>
                            <th className="text-right py-2 px-2 font-semibold">Valor</th>
                            <th className="text-center py-2 px-2 font-semibold w-16">Pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itens.map((it, i) => {
                            const lp = linhasIniciais.find((l) => l.key === it.key)!;
                            return (
                              <tr key={it.key} className="border-b border-border/40">
                                <td className="py-2 px-2">
                                  <div className="font-medium">{it.descricao}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {lp.tipo === "fixo" ? "Fixo · projetado " : "Variável · projetado "}
                                    {fmtBRL(lp.projetado)}
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <input value={it.categoria}
                                    onChange={(e) => setItens(itens.map((x, j) => j === i ? { ...x, categoria: e.target.value } : x))}
                                    className="form-input text-[11px] py-1 w-32" />
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <input value={it.valor}
                                    onChange={(e) => setItens(itens.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                                    className="form-input text-[11px] py-1 w-24 font-mono text-right" />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input type="checkbox" checked={it.pago}
                                    onChange={(e) => setItens(itens.map((x, j) => j === i ? { ...x, pago: e.target.checked } : x))} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-foreground/20 font-bold text-[12px]">
                            <td colSpan={2} className="py-2 px-2 text-right">Total a lançar:</td>
                            <td className="py-2 px-2 text-right font-mono">{fmtBRL(total)}</td>
                            <td></td>
                          </tr>
                          <tr className="text-[10px] text-muted-foreground">
                            <td colSpan={2} className="px-2 text-right">Projetado:</td>
                            <td className="px-2 text-right font-mono">{fmtBRL(projetadoTotal)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>

                  <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
                    {done ? (
                      <span className="text-[12px] text-success inline-flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> {done.inseridas} inseridas · {done.atualizadas} atualizadas
                      </span>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button onClick={salvar} disabled={saving || itens.length === 0}
                          className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
                          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                          Salvar {itens.length} despesa{itens.length === 1 ? "" : "s"}
                        </Button>
                      </>
                    )}
                  </footer>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// silence unused import lint
void cn;
