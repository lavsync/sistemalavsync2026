import { AppShell } from "@/components/shell/app-shell";
import { RotinasCorporativasView } from "@/components/corp/rotinas-view";
import {
  getOrgTree, listarCategorias, listarTemplates, listarRotinas, getDashboardRotinas,
} from "@/lib/corp/queries";
import { getMinhasRotinasHoje } from "@/lib/corp/minhas-rotinas";
import { listarUnidades } from "@/lib/unidade-ativa";
import { listarUsuarios } from "@/lib/usuarios-queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [tree, categorias, templates, rotinas, dashboard, unidades, usuarios, minhasHoje] = await Promise.all([
    getOrgTree(),
    listarCategorias(),
    listarTemplates(),
    listarRotinas(),
    getDashboardRotinas(),
    listarUnidades(),
    listarUsuarios(),
    getMinhasRotinasHoje(),
  ]);

  return (
    <AppShell>
      <RotinasCorporativasView
        tree={tree}
        categorias={categorias}
        templates={templates}
        rotinas={rotinas}
        dashboard={dashboard}
        unidades={unidades.map((u) => ({ id: u.id, nome: u.nome }))}
        usuarios={usuarios.filter((u) => u.ativo).map((u) => ({ id: u.id, nome: u.nome }))}
        minhasHoje={minhasHoje}
      />
    </AppShell>
  );
}
