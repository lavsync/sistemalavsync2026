"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, ShieldCheck, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { UsuariosView } from "@/components/configuracoes/usuarios-view";
import { PerfilView } from "@/components/configuracoes/perfil-view";
import { PermissoesView } from "@/components/configuracoes/permissoes-view";
import type { UsuarioRow } from "@/lib/usuarios-queries";
import type { PermissaoCatalogo, Papel } from "@/lib/permissoes/queries";

type Unidade = { id: string; nome: string };

const TABS = [
  { id: "perfil",     label: "Meu perfil",  icon: UserCircle,   desc: "Sua conta e senha" },
  { id: "usuarios",   label: "Usuários",    icon: Users,        desc: "Criar, editar, resetar senhas" },
  { id: "permissoes", label: "Permissões",  icon: ShieldCheck,  desc: "Por papel e por usuário" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ConfiguracoesView({
  tabInicial, usuarios, unidades, usuarioAtual, catalogo, porPapel,
}: {
  tabInicial: TabId;
  usuarios: UsuarioRow[];
  unidades: Unidade[];
  usuarioAtual: UsuarioRow | null;
  catalogo: PermissaoCatalogo[];
  porPapel: Record<Papel, string[]>;
}) {
  const [tab, setTab] = React.useState<TabId>(tabInicial);
  const router = useRouter();
  const sp = useSearchParams();

  function trocarTab(t: TabId) {
    setTab(t);
    const params = new URLSearchParams(sp.toString());
    params.set("tab", t);
    router.replace(`/configuracoes?${params.toString()}`);
  }

  const podeAdmin = usuarioAtual?.papel === "master" || usuarioAtual?.papel === "admin";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema · Configurações"
        title="Configurações"
        subtitle="Sua conta, usuários e permissões de acesso"
      />

      {/* Tabs */}
      <div className="rounded-2xl border border-border bg-card p-1.5 inline-flex gap-1">
        {TABS.map((t) => {
          if ((t.id === "usuarios" || t.id === "permissoes") && !podeAdmin) return null;
          const Icon = t.icon;
          const ativo = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => trocarTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-smooth",
                ativo
                  ? "bg-gradient-to-r from-brand-cyan to-brand-blue text-white shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      {tab === "perfil" && (
        <PerfilView usuario={usuarioAtual} />
      )}
      {tab === "usuarios" && podeAdmin && (
        <UsuariosView
          usuarios={usuarios}
          unidades={unidades}
          usuarioAtualId={usuarioAtual?.id ?? null}
        />
      )}
      {tab === "permissoes" && podeAdmin && (
        <PermissoesView
          usuarios={usuarios}
          catalogo={catalogo}
          porPapel={porPapel}
        />
      )}
    </div>
  );
}
