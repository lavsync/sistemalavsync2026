"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Users, UserPlus, Search, MoreVertical, Shield, ShieldCheck, ShieldX,
  KeyRound, Power, Trash2, Copy, Check, X, Building2, Loader2,
  AlertTriangle, Crown, Eye, UserCog, Phone, Mail, Calendar,
  Sparkles, ChevronRight, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { UsuarioRow, Papel } from "@/lib/usuarios-queries";
import {
  criarUsuario, atualizarUsuario, alternarAtivoUsuario,
  resetarSenha, deletarUsuario,
  type CriarUsuarioResult,
} from "@/lib/usuarios-actions";

const PAPEL_META: Record<Papel, { label: string; icon: React.ElementType; tone: string; desc: string }> = {
  master:   { label: "Master",   icon: Crown,     tone: "bg-warning/15 text-warning border-warning/30",     desc: "Acesso total · todas as unidades · gerencia usuários" },
  admin:    { label: "Admin",    icon: ShieldCheck, tone: "bg-brand-purple/15 text-brand-purple border-brand-purple/30", desc: "Acesso a todas as unidades · gerencia usuários" },
  operador: { label: "Operador", icon: UserCog,   tone: "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30", desc: "Acesso restrito às unidades atribuídas · operação dia-a-dia" },
  viewer:   { label: "Viewer",   icon: Eye,       tone: "bg-muted text-muted-foreground border-border",      desc: "Somente leitura · sem editar" },
};

type Unidade = { id: string; nome: string };

export function UsuariosView({
  usuarios, unidades, usuarioAtualId,
}: {
  usuarios: UsuarioRow[];
  unidades: Unidade[];
  usuarioAtualId: string | null;
}) {
  const [busca, setBusca] = React.useState("");
  const [novoOpen, setNovoOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<UsuarioRow | null>(null);
  const [senhaResetada, setSenhaResetada] = React.useState<{ usuario: string; senha: string } | null>(null);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.papel.includes(q),
    );
  }, [usuarios, busca]);

  const totalAtivos = usuarios.filter((u) => u.ativo).length;
  const totalMasters = usuarios.filter((u) => u.papel === "master").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configurações · Equipe"
        title="Gestão de usuários e permissões"
        subtitle={`${usuarios.length} usuário${usuarios.length === 1 ? "" : "s"} cadastrado${usuarios.length === 1 ? "" : "s"} · ${totalAtivos} ativos · ${totalMasters} master`}
        actions={
          <Button
            size="sm"
            className="text-xs h-9 bg-gradient-to-r from-brand-cyan to-brand-blue text-white"
            onClick={() => setNovoOpen(true)}
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" /> Novo usuário
          </Button>
        }
      />

      {/* Busca */}
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail ou papel..."
          className="flex-1 bg-transparent text-[13px] outline-none"
        />
        {busca && (
          <button onClick={() => setBusca("")} className="text-muted-foreground hover:text-danger">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lista de usuários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtrados.map((u) => (
          <UsuarioCard
            key={u.id}
            usuario={u}
            unidades={unidades}
            isSelf={u.id === usuarioAtualId}
            onEditar={() => setEditando(u)}
            onSenhaResetada={(s) => setSenhaResetada({ usuario: u.nome, senha: s })}
          />
        ))}
      </div>

      {filtrados.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center">
          <Users className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
          <div className="text-[13px] text-muted-foreground">
            {busca ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado ainda."}
          </div>
        </div>
      )}

      {/* Dialog: Novo usuário */}
      <NovoUsuarioDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        unidades={unidades}
      />

      {/* Dialog: Editar usuário */}
      <EditarUsuarioDialog
        usuario={editando}
        onClose={() => setEditando(null)}
        unidades={unidades}
      />

      {/* Dialog: Senha resetada */}
      <SenhaResetadaDialog
        info={senhaResetada}
        onClose={() => setSenhaResetada(null)}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// CARD do usuário
// ────────────────────────────────────────────────────────────
function UsuarioCard({
  usuario, unidades, isSelf, onEditar, onSenhaResetada,
}: {
  usuario: UsuarioRow;
  unidades: Unidade[];
  isSelf: boolean;
  onEditar: () => void;
  onSenhaResetada: (senha: string) => void;
}) {
  const PapelIcon = PAPEL_META[usuario.papel].icon;
  const [busy, setBusy] = React.useState(false);

  async function handleReset() {
    if (!confirm(`Resetar a senha de ${usuario.nome}? Será gerada uma nova senha temporária.`)) return;
    setBusy(true);
    try {
      const r = await resetarSenha(usuario.id);
      onSenhaResetada(r.senhaTemporaria);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao resetar");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle() {
    setBusy(true);
    try { await alternarAtivoUsuario(usuario.id, !usuario.ativo); }
    catch (e) { alert(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!confirm(`Deletar PERMANENTEMENTE ${usuario.nome}? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    try { await deletarUsuario(usuario.id); }
    catch (e) { alert(e instanceof Error ? e.message : "Erro"); setBusy(false); }
  }

  const unidadesNomes = !usuario.unidades_permitidas
    ? "Todas as unidades"
    : usuario.unidades_permitidas.length === 0
    ? "Nenhuma"
    : unidades.filter((u) => usuario.unidades_permitidas?.includes(u.id)).map((u) => u.nome).join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl border bg-card p-4 transition-smooth",
        usuario.ativo ? "border-border hover:border-border-strong" : "border-border opacity-60",
      )}
    >
      {!usuario.ativo && (
        <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Desativado
        </div>
      )}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-[14px] font-bold text-white shrink-0"
          style={{
            background:
              usuario.papel === "master"
                ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                : "linear-gradient(135deg, #01385B 0%, #0F859A 50%, #19C7CB 100%)",
          }}
        >
          {iniciais(usuario.nome)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-display font-bold text-[14px] truncate">{usuario.nome}</div>
            {isSelf && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/15 text-success">
                Você
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <Mail className="w-3 h-3" /> {usuario.email}
          </div>
          {usuario.telefone && (
            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" /> {usuario.telefone}
            </div>
          )}
        </div>

        {/* Ações */}
        {!isSelf && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                disabled={busy}
                className="w-8 h-8 rounded-md hover:bg-secondary inline-flex items-center justify-center disabled:opacity-50"
                aria-label="Ações"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoreVertical className="w-3.5 h-3.5" />}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-[180px] rounded-xl border border-border bg-popover shadow-2xl p-1 animate-in fade-in zoom-in-95"
              >
                <DropdownAction onClick={onEditar} icon={UserCog}>Editar</DropdownAction>
                <DropdownAction onClick={handleReset} icon={KeyRound}>Resetar senha</DropdownAction>
                <DropdownAction onClick={handleToggle} icon={Power} tone={usuario.ativo ? "warning" : "success"}>
                  {usuario.ativo ? "Desativar" : "Reativar"}
                </DropdownAction>
                <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
                <DropdownAction onClick={handleDelete} icon={Trash2} tone="danger">Deletar</DropdownAction>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {/* Tags inferiores */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border", PAPEL_META[usuario.papel].tone)}>
          <PapelIcon className="w-3 h-3" /> {PAPEL_META[usuario.papel].label}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">
          <Building2 className="w-3 h-3" /> {unidadesNomes}
        </span>
        {usuario.ultimo_acesso_em && (
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" /> último: {new Date(usuario.ultimo_acesso_em).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function DropdownAction({
  icon: Icon, children, onClick, tone = "default",
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const toneClass = {
    default: "text-foreground hover:bg-secondary",
    danger: "text-danger hover:bg-danger/10",
    warning: "text-warning hover:bg-warning/10",
    success: "text-success hover:bg-success/10",
  }[tone];
  return (
    <DropdownMenu.Item
      onSelect={onClick}
      className={cn("flex items-center gap-2 px-2.5 py-2 text-[12px] rounded-md cursor-pointer outline-none", toneClass)}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </DropdownMenu.Item>
  );
}

// ────────────────────────────────────────────────────────────
// DIALOG: Novo Usuário (com steps)
// ────────────────────────────────────────────────────────────
function NovoUsuarioDialog({
  open, onOpenChange, unidades,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unidades: Unidade[];
}) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [papel, setPapel] = React.useState<Papel>("operador");
  const [unidadesPermitidas, setUnidadesPermitidas] = React.useState<string[]>([]);
  const [observacoes, setObservacoes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<CriarUsuarioResult | null>(null);
  const [copiou, setCopiou] = React.useState(false);

  function reset() {
    setStep(1); setNome(""); setEmail(""); setTelefone("");
    setPapel("operador"); setUnidadesPermitidas([]);
    setObservacoes(""); setBusy(false); setErro(null); setResultado(null); setCopiou(false);
  }

  React.useEffect(() => { if (!open) reset(); }, [open]);

  async function handleCriar() {
    setBusy(true); setErro(null);
    try {
      const r = await criarUsuario({
        nome, email, telefone, papel,
        unidades_permitidas: papel === "master" || papel === "admin" ? null : unidadesPermitidas,
        observacoes,
      });
      if (!r.ok) { setErro(r.motivo); setBusy(false); return; }
      setResultado(r);
      setStep(3);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  function copiar() {
    if (resultado && resultado.ok) {
      navigator.clipboard.writeText(`E-mail: ${email}\nSenha: ${resultado.senhaTemporaria}`);
      setCopiou(true);
      setTimeout(() => setCopiou(false), 2000);
    }
  }

  const valido1 = nome.trim().length >= 2 && /^[^@]+@[^@]+\.[^@]+$/.test(email);
  const valido2 =
    papel === "master" || papel === "admin" || unidadesPermitidas.length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  className="fixed inset-0 z-50 grid place-items-center p-4 outline-none"
                >
                  <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
                    <div className="flex items-start justify-between p-5 border-b border-border/60">
                      <div>
                        <Dialog.Title className="font-display text-lg font-bold flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-brand-cyan" /> Novo usuário
                        </Dialog.Title>
                        <Dialog.Description className="text-[12px] text-muted-foreground mt-1">
                          Passo {step === 3 ? "✓" : `${step} de 2`} · Crie a conta e atribua permissões
                        </Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    {/* STEP 1 — Dados */}
                    {step === 1 && (
                      <div className="p-5 space-y-3">
                        <Field label="Nome completo *">
                          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" className="form-input" autoFocus />
                        </Field>
                        <Field label="E-mail *">
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@lavsync.com" className="form-input" />
                        </Field>
                        <Field label="Telefone (opcional)">
                          <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(31) 99999-9999" className="form-input" />
                        </Field>
                      </div>
                    )}

                    {/* STEP 2 — Permissões */}
                    {step === 2 && (
                      <div className="p-5 space-y-4">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                            Papel
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {(Object.keys(PAPEL_META) as Papel[]).map((p) => {
                              const meta = PAPEL_META[p];
                              const Icon = meta.icon;
                              const ativo = papel === p;
                              return (
                                <button
                                  key={p}
                                  onClick={() => setPapel(p)}
                                  className={cn(
                                    "text-left rounded-lg border p-3 transition-smooth flex items-start gap-3",
                                    ativo
                                      ? "border-brand-cyan bg-brand-cyan/5"
                                      : "border-border hover:border-border-strong bg-card",
                                  )}
                                >
                                  <div className={cn("w-8 h-8 rounded-md border flex items-center justify-center shrink-0", meta.tone)}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-[13px]">{meta.label}</div>
                                    <div className="text-[11px] text-muted-foreground">{meta.desc}</div>
                                  </div>
                                  {ativo && <Check className="w-4 h-4 text-brand-cyan shrink-0 mt-1" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {papel !== "master" && papel !== "admin" && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                              Unidades acessíveis *
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {unidades.map((u) => {
                                const ativo = unidadesPermitidas.includes(u.id);
                                return (
                                  <button
                                    key={u.id}
                                    onClick={() => setUnidadesPermitidas((s) => ativo ? s.filter((x) => x !== u.id) : [...s, u.id])}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-smooth",
                                      ativo
                                        ? "bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan"
                                        : "bg-secondary border-border text-muted-foreground hover:text-foreground",
                                    )}
                                  >
                                    {ativo && <Check className="w-3 h-3" />}
                                    <Building2 className="w-3 h-3" /> {u.nome}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2">
                              {papel === "operador"
                                ? "O operador só verá dados das unidades selecionadas."
                                : "O viewer terá leitura apenas nas unidades selecionadas."}
                            </p>
                          </div>
                        )}

                        <Field label="Observações (opcional)">
                          <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Notas internas sobre este usuário" className="form-input resize-none" />
                        </Field>
                      </div>
                    )}

                    {/* STEP 3 — Senha gerada */}
                    {step === 3 && resultado && resultado.ok && (
                      <div className="p-5 space-y-4">
                        <div className="rounded-xl border border-success/30 bg-success/8 p-4 flex items-start gap-3">
                          <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                          <div>
                            <div className="font-display font-bold text-success">Usuário criado!</div>
                            <div className="text-[12px] text-success/80 mt-0.5">
                              Anote ou envie a senha temporária agora — ela <strong>não será mostrada de novo</strong>.
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border-2 border-brand-cyan/30 bg-brand-cyan/5 p-4 space-y-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">E-mail</div>
                            <div className="font-mono text-[14px] font-semibold">{email}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Senha temporária</div>
                            <div className="font-mono text-[18px] font-bold text-brand-cyan tracking-wider select-all">
                              {resultado.senhaTemporaria}
                            </div>
                          </div>
                          <button
                            onClick={copiar}
                            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-brand-cyan text-primary-foreground font-semibold text-[12px] hover:bg-brand-cyan/90"
                          >
                            {copiou ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar e-mail + senha</>}
                          </button>
                        </div>

                        <div className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-[11px] text-warning flex gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          O usuário deve trocar a senha no primeiro login (recomendado).
                        </div>
                      </div>
                    )}

                    {erro && (
                      <div className="mx-5 mb-4 rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>
                    )}

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
                      {step === 1 && (
                        <>
                          <Dialog.Close asChild><Button variant="ghost">Cancelar</Button></Dialog.Close>
                          <Button onClick={() => setStep(2)} disabled={!valido1} className="bg-brand-cyan text-primary-foreground">
                            Próximo <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </>
                      )}
                      {step === 2 && (
                        <>
                          <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
                          <Button onClick={handleCriar} disabled={!valido2 || busy} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
                            {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                            <Sparkles className="w-4 h-4 mr-1" /> Criar usuário
                          </Button>
                        </>
                      )}
                      {step === 3 && (
                        <Button onClick={() => onOpenChange(false)} className="ml-auto bg-success text-white">
                          Concluir
                        </Button>
                      )}
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

// ────────────────────────────────────────────────────────────
// DIALOG: Editar usuário (sem senha)
// ────────────────────────────────────────────────────────────
function EditarUsuarioDialog({
  usuario, onClose, unidades,
}: {
  usuario: UsuarioRow | null;
  onClose: () => void;
  unidades: Unidade[];
}) {
  const [nome, setNome] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [papel, setPapel] = React.useState<Papel>("operador");
  const [unidadesPermitidas, setUnidadesPermitidas] = React.useState<string[]>([]);
  const [observacoes, setObservacoes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (usuario) {
      setNome(usuario.nome);
      setTelefone(usuario.telefone ?? "");
      setPapel(usuario.papel);
      setUnidadesPermitidas(usuario.unidades_permitidas ?? []);
      setObservacoes(usuario.observacoes ?? "");
      setErro(null);
    }
  }, [usuario]);

  if (!usuario) return null;

  async function handleSalvar() {
    setBusy(true); setErro(null);
    try {
      await atualizarUsuario({
        id: usuario!.id, nome, telefone, papel,
        unidades_permitidas: papel === "master" || papel === "admin" ? null : unidadesPermitidas,
        observacoes,
      });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

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
                  className="fixed inset-0 z-50 grid place-items-center p-4 outline-none">
                  <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
                    <div className="p-5 border-b border-border/60 flex items-start justify-between">
                      <div>
                        <Dialog.Title className="font-display text-lg font-bold flex items-center gap-2">
                          <UserCog className="w-4 h-4 text-brand-cyan" /> Editar usuário
                        </Dialog.Title>
                        <Dialog.Description className="text-[12px] text-muted-foreground mt-1">
                          {usuario.email}
                        </Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                      <Field label="Nome">
                        <input value={nome} onChange={(e) => setNome(e.target.value)} className="form-input" />
                      </Field>
                      <Field label="Telefone">
                        <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="form-input" />
                      </Field>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">Papel</div>
                        <select value={papel} onChange={(e) => setPapel(e.target.value as Papel)} className="form-input">
                          {(Object.keys(PAPEL_META) as Papel[]).map((p) => (
                            <option key={p} value={p}>{PAPEL_META[p].label}</option>
                          ))}
                        </select>
                      </div>

                      {papel !== "master" && papel !== "admin" && (
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">Unidades</div>
                          <div className="flex flex-wrap gap-2">
                            {unidades.map((u) => {
                              const ativo = unidadesPermitidas.includes(u.id);
                              return (
                                <button key={u.id}
                                  onClick={() => setUnidadesPermitidas((s) => ativo ? s.filter((x) => x !== u.id) : [...s, u.id])}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold border",
                                    ativo ? "bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan" : "bg-secondary border-border text-muted-foreground",
                                  )}>
                                  {ativo && <Check className="w-3 h-3" />}
                                  <Building2 className="w-3 h-3" /> {u.nome}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <Field label="Observações">
                        <textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="form-input resize-none" />
                      </Field>

                      {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
                    </div>

                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-end gap-2">
                      <Dialog.Close asChild><Button variant="ghost">Cancelar</Button></Dialog.Close>
                      <Button onClick={handleSalvar} disabled={busy} className="bg-brand-cyan text-primary-foreground">
                        {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Salvar alterações
                      </Button>
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

// ────────────────────────────────────────────────────────────
// DIALOG: Senha resetada
// ────────────────────────────────────────────────────────────
function SenhaResetadaDialog({
  info, onClose,
}: {
  info: { usuario: string; senha: string } | null;
  onClose: () => void;
}) {
  const [copiou, setCopiou] = React.useState(false);
  React.useEffect(() => setCopiou(false), [info]);

  if (!info) return null;

  return (
    <Dialog.Root open={!!info} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {info && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                  className="fixed inset-0 z-50 grid place-items-center p-4">
                  <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
                    <div className="p-5 border-b border-border/60">
                      <Dialog.Title className="font-display text-lg font-bold flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-brand-cyan" /> Senha resetada
                      </Dialog.Title>
                      <Dialog.Description className="text-[12px] text-muted-foreground mt-1">
                        Nova senha para {info.usuario}
                      </Dialog.Description>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="rounded-xl border-2 border-brand-cyan/30 bg-brand-cyan/5 p-4">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Nova senha temporária</div>
                        <div className="font-mono text-[18px] font-bold text-brand-cyan tracking-wider select-all">{info.senha}</div>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(info.senha); setCopiou(true); setTimeout(() => setCopiou(false), 2000); }}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-brand-cyan text-primary-foreground font-semibold text-[12px] hover:bg-brand-cyan/90"
                      >
                        {copiou ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar senha</>}
                      </button>
                      <div className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-[11px] text-warning flex gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        Envie esta senha pro usuário pelo canal seguro. Esta tela não pode ser reaberta.
                      </div>
                    </div>
                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex justify-end">
                      <Button onClick={onClose} className="bg-brand-cyan text-primary-foreground">Concluir</Button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

void Shield; void ShieldX;
