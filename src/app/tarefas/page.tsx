import { AppShell } from "@/components/shell/app-shell";
import { TarefasView } from "@/components/tarefas/tarefas-view";
import { listarTarefas, getResumoTarefas } from "@/lib/tarefas/queries";
import { listarColunasKanban } from "@/lib/tarefas/kanban-queries";
import { listarUnidades } from "@/lib/unidade-ativa";
import { listarUsuarios } from "@/lib/usuarios-queries";
import { listarRotinas } from "@/lib/corp/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [tarefas, resumo, unidades, usuarios, rotinas, colunasKanban] = await Promise.all([
    listarTarefas({ status: "todos", limit: 500 }),
    getResumoTarefas(),
    listarUnidades(),
    listarUsuarios(),
    listarRotinas(),
    listarColunasKanban(),
  ]);

  return (
    <AppShell>
      <TarefasView
        tarefas={tarefas}
        resumo={resumo}
        unidades={unidades.map((u) => ({ id: u.id, nome: u.nome }))}
        usuarios={usuarios.filter((u) => u.ativo).map((u) => ({ id: u.id, nome: u.nome }))}
        rotinas={rotinas.map((r) => ({ id: r.id, titulo: r.titulo }))}
        colunasKanban={colunasKanban}
      />
    </AppShell>
  );
}
