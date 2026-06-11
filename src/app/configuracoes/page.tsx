import { AppShell } from "@/components/shell/app-shell";
import { ConfiguracoesView } from "@/components/configuracoes/configuracoes-view";
import { listarUsuarios, getUsuarioAtual } from "@/lib/usuarios-queries";
import { listarUnidades } from "@/lib/unidade-ativa";
import {
  listarCatalogoPermissoes,
  listarPermissoesPorPapel,
} from "@/lib/permissoes/queries";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const [usuarios, unidades, atual, catalogo, porPapel] = await Promise.all([
    listarUsuarios(),
    listarUnidades(),
    getUsuarioAtual(),
    listarCatalogoPermissoes(),
    listarPermissoesPorPapel(),
  ]);

  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <ConfiguracoesView
          tabInicial={(sp.tab as "perfil" | "usuarios" | "permissoes") ?? "perfil"}
          usuarios={usuarios}
          unidades={unidades.map((u) => ({ id: u.id, nome: u.nome }))}
          usuarioAtual={atual}
          catalogo={catalogo}
          porPapel={porPapel}
        />
      </div>
    </AppShell>
  );
}
