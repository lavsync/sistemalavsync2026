"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ShieldCheck, Check, X, Search, Loader2, RotateCcw, AlertTriangle,
  Eye, Plus, Pencil, Trash2, Zap, Upload, Download,
  Crown, Shield, UserCog, Sparkles, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UsuarioRow } from "@/lib/usuarios-queries";
import type { PermissaoCatalogo, Papel } from "@/lib/permissoes/queries";
import { aplicarOverridesLote, resetarOverridesUsuario } from "@/lib/permissoes/actions";

const PAPEL_META: Record<Papel, { label: string; tone: string; icon: React.ElementType }> = {
  master:   { label: "Master",        tone: "bg-warning/15 text-warning",         icon: Crown },
  admin:    { label: "Admin",         tone: "bg-brand-purple/15 text-brand-purple", icon: ShieldCheck },
  gerente:  { label: "Gerente",       tone: "bg-brand-blue/15 text-brand-blue",   icon: Shield },
  operador: { label: "Operador",      tone: "bg-brand-cyan/15 text-brand-cyan",   icon: UserCog },
  viewer:   { label: "Visualizador",  tone: "bg-muted text-muted-foreground",     icon: Eye },
};

const ACAO_META: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  view:     { label: "Ver",       icon: Eye,      tone: "text-brand-cyan" },
  create:   { label: "Criar",     icon: Plus,     tone: "text-success" },
  update:   { label: "Editar",    icon: Pencil,   tone: "text-brand-blue" },
  delete:   { label: "Excluir",   icon: Trash2,   tone: "text-danger" },
  execute:  { label: "Executar",  icon: Zap,      tone: "text-warning" },
  importar: { label: "Importar",  icon: Upload,   tone: "text-brand-purple" },
  exportar: { label: "Exportar",  icon: Download, tone: "text-brand-cyan" },
};

const MODULO_LABEL: Record<string, string> = {
  dashboard: "Visão Geral",
  cadastros: "Cadastros",
  clientes: "Clientes",
  performance: "Performance",
  financeiro: "Financeiro",
  marketing: "Marketing",
  manutencao: "Manutenção",
  comparativo: "Comparativo",
  painel_vivo: "Painel ao Vivo",
  dados: "Dados / Exports",
  suporte: "Suporte",
  sistema: "Sistema",
};

export function PermissoesView({
  usuarios, catalogo, porPapel,
}: {
  usuarios: UsuarioRow[];
  catalogo: PermissaoCatalogo[];
  porPapel: Record<Papel, string[]>;
}) {
  const [busca, setBusca] = React.useState("");
  const [editando, setEditando] = React.useState<UsuarioRow | null>(null);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [usuarios, busca]);

  const modulos = React.useMemo(() => {
    const m: Record<string, PermissaoCatalogo[]> = {};
    for (const p of catalogo) {
      if (!m[p.modulo]) m[p.modulo] = [];
      m[p.modulo].push(p);
    }
    return m;
  }, [catalogo]);

  return (
    <div className="space-y-4">
      {/* RESUMO POR PAPEL */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-brand-cyan" />
          <div className="font-display font-bold text-[14px]">Permissões padrão por papel</div>
        </div>
        <p className="text-[12px] text-muted-foreground mb-4">
          Cada usuário herda automaticamente as permissões do seu papel. Use <strong>overrides</strong> para conceder ou bloquear permissões específicas por usuário.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(Object.keys(PAPEL_META) as Papel[]).map((p) => {
            const meta = PAPEL_META[p];
            const Icon = meta.icon;
            const qtd = p === "master" ? catalogo.length : (porPapel[p]?.length ?? 0);
            return (
              <div key={p} className="rounded-xl border border-border bg-card-hover p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", meta.tone)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-semibold text-[12px]">{meta.label}</div>
                </div>
                <div className="text-[22px] font-display font-bold leading-none">{qtd}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">de {catalogo.length} permissões</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* USUÁRIOS — busca */}
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar usuário por nome ou e-mail..."
          className="flex-1 bg-transparent text-[13px] outline-none"
        />
      </div>

      {/* LISTA — clica pra editar permissões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtrados.map((u) => {
          const meta = PAPEL_META[u.papel];
          const Icon = meta.icon;
          return (
            <button
              key={u.id}
              onClick={() => setEditando(u)}
              className="text-left rounded-2xl border border-border bg-card p-4 hover:border-brand-cyan transition-smooth flex items-center gap-3"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                style={{
                  background:
                    u.papel === "master"
                      ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                      : "linear-gradient(135deg, #01385B 0%, #0F859A 50%, #19C7CB 100%)",
                }}
              >
                {iniciais(u.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[13px] truncate">{u.nome}</div>
                <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md", meta.tone)}>
                <Icon className="w-3 h-3" /> {meta.label}
              </div>
              <Sparkles className="w-4 h-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      <EditarPermissoesDialog
        usuario={editando}
        onClose={() => setEditando(null)}
        catalogo={catalogo}
        porPapel={porPapel}
        modulos={modulos}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// DIALOG: Editar permissões do usuário
// ────────────────────────────────────────────────────────────
function EditarPermissoesDialog({
  usuario, onClose, catalogo, porPapel, modulos,
}: {
  usuario: UsuarioRow | null;
  onClose: () => void;
  catalogo: PermissaoCatalogo[];
  porPapel: Record<Papel, string[]>;
  modulos: Record<string, PermissaoCatalogo[]>;
}) {
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});
  const [overridesOriginal, setOverridesOriginal] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState(false);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!usuario) return;
    setCarregando(true);
    setErro(null);
    fetch(`/api/permissoes/overrides/${usuario.id}`)
      .then((r) => r.json())
      .then((data: Record<string, boolean>) => {
        setOverrides(data);
        setOverridesOriginal(data);
        setCarregando(false);
      })
      .catch((e) => {
        setErro(e instanceof Error ? e.message : "Erro ao carregar");
        setCarregando(false);
      });
  }, [usuario]);

  if (!usuario) return null;

  const isMaster = usuario.papel === "master";
  const permissoesPapel = isMaster
    ? new Set(catalogo.map((c) => c.chave))
    : new Set(porPapel[usuario.papel] ?? []);

  /** Estado efetivo de uma permissão: true = tem, false = não tem */
  function temEfetivo(chave: string): boolean {
    if (chave in overrides) return overrides[chave];
    return permissoesPapel.has(chave);
  }

  /** Toggle: alterna entre "herdar do papel", "conceder", "bloquear" */
  function toggle(chave: string) {
    setOverrides((s) => {
      const novo = { ...s };
      const padraoTem = permissoesPapel.has(chave);
      const atualEfetivo = chave in novo ? novo[chave] : padraoTem;
      const novoEfetivo = !atualEfetivo;

      // Se o novo bate com o padrão, remove override (volta a herdar)
      if (novoEfetivo === padraoTem) {
        delete novo[chave];
      } else {
        novo[chave] = novoEfetivo;
      }
      return novo;
    });
  }

  function ativarTodasDoModulo(modulo: string, ativar: boolean) {
    setOverrides((s) => {
      const novo = { ...s };
      for (const p of modulos[modulo] ?? []) {
        const padrao = permissoesPapel.has(p.chave);
        if (ativar === padrao) delete novo[p.chave];
        else novo[p.chave] = ativar;
      }
      return novo;
    });
  }

  async function handleSalvar() {
    setBusy(true);
    setErro(null);
    try {
      // Calcula o diff: quem foi adicionado/removido vs original
      const chavesTodas = new Set([...Object.keys(overrides), ...Object.keys(overridesOriginal)]);
      const lote: Array<{ chave: string; concedida: boolean | null }> = [];
      for (const chave of chavesTodas) {
        const atual = chave in overrides ? overrides[chave] : null;
        const original = chave in overridesOriginal ? overridesOriginal[chave] : null;
        if (atual !== original) {
          lote.push({ chave, concedida: atual });
        }
      }
      if (lote.length === 0) {
        onClose();
        return;
      }
      await aplicarOverridesLote(usuario!.id, lote);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!confirm(`Remover TODOS os overrides de ${usuario!.nome}? Ele(a) voltará a herdar apenas as permissões do papel.`)) return;
    setBusy(true);
    try {
      await resetarOverridesUsuario(usuario!.id);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao resetar");
      setBusy(false);
    }
  }

  const totalOverrides = Object.keys(overrides).length;
  const meta = PAPEL_META[usuario.papel];

  return (
    <Dialog.Root open={!!usuario} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {usuario && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  className="fixed inset-0 z-50 grid place-items-center p-4">
                  <div className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
                    {/* HEADER */}
                    <div className="p-5 border-b border-border/60 flex items-start justify-between">
                      <div className="min-w-0">
                        <Dialog.Title className="font-display text-lg font-bold flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-brand-cyan" /> Permissões de {usuario.nome}
                        </Dialog.Title>
                        <Dialog.Description className="text-[12px] text-muted-foreground mt-1 flex items-center gap-2">
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-bold", meta.tone)}>
                            Papel: {meta.label}
                          </span>
                          <span>·</span>
                          <span>{totalOverrides > 0 ? `${totalOverrides} override${totalOverrides === 1 ? "" : "s"} ativo${totalOverrides === 1 ? "" : "s"}` : "Sem overrides — herda do papel"}</span>
                        </Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    {/* CONTEÚDO */}
                    <div className="p-5 overflow-y-auto flex-1">
                      {isMaster && (
                        <div className="rounded-lg border border-warning/30 bg-warning/8 p-3 mb-4 flex items-start gap-2 text-[12px] text-warning">
                          <Crown className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>Master tem acesso total automaticamente — overrides não se aplicam.</div>
                        </div>
                      )}

                      {carregando ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(modulos).map(([mod, perms]) => {
                            const todasAtivas = perms.every((p) => temEfetivo(p.chave));
                            const algumaAtiva = perms.some((p) => temEfetivo(p.chave));
                            return (
                              <div key={mod} className="rounded-xl border border-border bg-card-hover/30">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
                                  <div className="font-display font-bold text-[12px] uppercase tracking-wider">
                                    {MODULO_LABEL[mod] ?? mod}
                                  </div>
                                  {!isMaster && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => ativarTodasDoModulo(mod, true)}
                                        className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded text-success hover:bg-success/10"
                                      >
                                        + Tudo
                                      </button>
                                      <button
                                        onClick={() => ativarTodasDoModulo(mod, false)}
                                        className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded text-danger hover:bg-danger/10"
                                      >
                                        - Tudo
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {perms.map((p) => {
                                    const acaoMeta = ACAO_META[p.acao] ?? ACAO_META.execute;
                                    const Icon = acaoMeta.icon;
                                    const ativo = temEfetivo(p.chave);
                                    const padrao = permissoesPapel.has(p.chave);
                                    const ehOverride = p.chave in overrides;
                                    return (
                                      <button
                                        key={p.chave}
                                        onClick={() => !isMaster && toggle(p.chave)}
                                        disabled={isMaster}
                                        className={cn(
                                          "rounded-lg border p-2.5 text-left transition-smooth flex items-center gap-2.5 group",
                                          ativo
                                            ? "border-success/40 bg-success/8"
                                            : "border-border bg-card opacity-70",
                                          !isMaster && "hover:border-brand-cyan cursor-pointer",
                                        )}
                                      >
                                        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0", acaoMeta.tone, "bg-current/15")}>
                                          <Icon className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[12px] font-semibold leading-tight">{p.label}</div>
                                          <div className="text-[10px] text-muted-foreground truncate">{p.chave}</div>
                                        </div>
                                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                                          {ativo ? (
                                            <Check className="w-4 h-4 text-success" />
                                          ) : (
                                            <X className="w-4 h-4 text-muted-foreground" />
                                          )}
                                          {ehOverride && (
                                            <span className={cn(
                                              "text-[8px] uppercase tracking-wider font-bold px-1 rounded",
                                              ativo && !padrao ? "text-success bg-success/15" : "text-danger bg-danger/15",
                                            )}>
                                              override
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* dummy refs pra evitar tree-shake warning */}
                                {false && <span>{todasAtivas && algumaAtiva}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {erro && (
                        <div className="mt-3 rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {erro}
                        </div>
                      )}
                    </div>

                    {/* FOOTER */}
                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
                      {!isMaster && totalOverrides > 0 ? (
                        <Button variant="ghost" onClick={handleReset} disabled={busy} className="text-danger">
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Resetar overrides
                        </Button>
                      ) : <span />}
                      <div className="flex gap-2">
                        <Dialog.Close asChild>
                          <Button variant="ghost" disabled={busy}>Cancelar</Button>
                        </Dialog.Close>
                        {!isMaster && (
                          <Button
                            onClick={handleSalvar}
                            disabled={busy}
                            className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white"
                          >
                            {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                            <Save className="w-4 h-4 mr-1.5" /> Salvar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
