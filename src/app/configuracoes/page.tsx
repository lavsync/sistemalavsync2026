import { AppShell } from "@/components/shell/app-shell";
import { UsuariosView } from "@/components/configuracoes/usuarios-view";
import { listarUsuarios, getUsuarioAtual } from "@/lib/usuarios-queries";
import { listarUnidades } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [usuarios, unidades, atual] = await Promise.all([
    listarUsuarios(),
    listarUnidades(),
    getUsuarioAtual(),
  ]);

  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <UsuariosView
          usuarios={usuarios}
          unidades={unidades.map((u) => ({ id: u.id, nome: u.nome }))}
          usuarioAtualId={atual?.id ?? null}
        />
      </div>
    </AppShell>
  );
}
