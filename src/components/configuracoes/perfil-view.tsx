"use client";

import * as React from "react";
import { Lock, Eye, EyeOff, Check, Loader2, AlertTriangle, KeyRound, Mail, User as UserIcon, Crown, Shield, ShieldCheck, UserCog, Eye as EyeRole } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UsuarioRow, Papel } from "@/lib/usuarios-queries";
import { alterarMinhaSenha } from "@/lib/usuarios-actions";

const PAPEL_ICON: Record<Papel, React.ElementType> = {
  master: Crown, admin: ShieldCheck, gerente: Shield, operador: UserCog, viewer: EyeRole,
};
const PAPEL_LABEL: Record<Papel, string> = {
  master: "Master", admin: "Admin", gerente: "Gerente", operador: "Operador", viewer: "Visualizador",
};

export function PerfilView({ usuario }: { usuario: UsuarioRow | null }) {
  const [senhaAtual, setSenhaAtual] = React.useState("");
  const [senhaNova, setSenhaNova] = React.useState("");
  const [senhaConfirmar, setSenhaConfirmar] = React.useState("");
  const [mostrarAtual, setMostrarAtual] = React.useState(false);
  const [mostrarNova, setMostrarNova] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState(false);

  if (!usuario) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
        Carregando perfil...
      </div>
    );
  }

  const PapelIcon = PAPEL_ICON[usuario.papel];
  const podeSubmeter =
    senhaAtual.length > 0 &&
    senhaNova.length >= 8 &&
    senhaNova === senhaConfirmar;

  async function handleAlterar() {
    setBusy(true);
    setErro(null);
    setSucesso(false);
    try {
      await alterarMinhaSenha({ senhaAtual, senhaNova });
      setSucesso(true);
      setSenhaAtual("");
      setSenhaNova("");
      setSenhaConfirmar("");
      setTimeout(() => setSucesso(false), 6000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao alterar senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* CARD: dados do usuário */}
      <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-[16px] font-bold text-white shrink-0"
            style={{
              background:
                usuario.papel === "master"
                  ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                  : "linear-gradient(135deg, #01385B 0%, #0F859A 50%, #19C7CB 100%)",
            }}
          >
            {iniciais(usuario.nome)}
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-[15px] truncate">{usuario.nome}</div>
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
              <PapelIcon className="w-3 h-3" /> {PAPEL_LABEL[usuario.papel]}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-[12px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-3.5 h-3.5" />
            <span className="truncate">{usuario.email}</span>
          </div>
          {usuario.telefone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserIcon className="w-3.5 h-3.5" />
              <span>{usuario.telefone}</span>
            </div>
          )}
        </div>
      </div>

      {/* CARD: alterar senha */}
      <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-brand-cyan" />
          <div className="font-display font-bold text-[14px]">Alterar minha senha</div>
        </div>
        <div className="text-[12px] text-muted-foreground mb-4">
          Informe sua senha atual e a nova senha (mínimo 8 caracteres).
        </div>

        <div className="space-y-3 max-w-md">
          <CampoSenha
            label="Senha atual"
            valor={senhaAtual}
            onChange={setSenhaAtual}
            mostrar={mostrarAtual}
            onToggle={() => setMostrarAtual((v) => !v)}
            placeholder="Sua senha atual"
            autoFocus
          />
          <CampoSenha
            label="Nova senha"
            valor={senhaNova}
            onChange={setSenhaNova}
            mostrar={mostrarNova}
            onToggle={() => setMostrarNova((v) => !v)}
            placeholder="Mínimo 8 caracteres"
            ajuda={senhaNova.length > 0 && senhaNova.length < 8 ? `Faltam ${8 - senhaNova.length} caractere${8 - senhaNova.length === 1 ? "" : "s"}` : null}
          />
          <CampoSenha
            label="Confirmar nova senha"
            valor={senhaConfirmar}
            onChange={setSenhaConfirmar}
            mostrar={mostrarNova}
            onToggle={() => setMostrarNova((v) => !v)}
            placeholder="Repita a nova senha"
            ajuda={senhaConfirmar && senhaNova !== senhaConfirmar ? "As senhas não coincidem" : null}
            ajudaTone="danger"
          />

          {erro && (
            <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {erro}
            </div>
          )}
          {sucesso && (
            <div className="rounded-lg border border-success/30 bg-success/8 px-3 py-2 text-[12px] text-success flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 shrink-0" /> Senha alterada com sucesso! Use a nova senha no próximo login.
            </div>
          )}

          <Button
            onClick={handleAlterar}
            disabled={!podeSubmeter || busy}
            className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white"
          >
            {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            <Lock className="w-4 h-4 mr-1.5" />
            Alterar senha
          </Button>
        </div>
      </div>
    </div>
  );
}

function CampoSenha({
  label, valor, onChange, mostrar, onToggle, placeholder, ajuda, ajudaTone = "muted", autoFocus,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  mostrar: boolean;
  onToggle: () => void;
  placeholder?: string;
  ajuda?: string | null;
  ajudaTone?: "muted" | "danger";
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">
        {label}
      </div>
      <div className="relative">
        <input
          type={mostrar ? "text" : "password"}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          autoFocus={autoFocus}
          className="form-input pr-10 font-mono"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={mostrar ? "Ocultar" : "Mostrar"}
        >
          {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {ajuda && (
        <div className={cn("text-[10px] mt-1", ajudaTone === "danger" ? "text-danger" : "text-muted-foreground")}>
          {ajuda}
        </div>
      )}
    </label>
  );
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
