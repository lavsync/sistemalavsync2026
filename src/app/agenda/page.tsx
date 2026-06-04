import { AppShell } from "@/components/shell/app-shell";
import { AgendaView } from "@/components/views/agenda-view";
import {
  getAgendaResumo,
  getEventosNoIntervalo,
  getFeriadosNoIntervalo,
} from "@/lib/agenda-queries";
import { createClient } from "@/lib/supabase/server";
import { addMonths, endOfMonth, format, parse, startOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ m?: string }>;

async function checkMigrationApplied(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("eventos").select("id").limit(1);
    if (!error) return true;
    const code = (error as { code?: string }).code;
    const msg = (error as { message?: string }).message ?? "";
    if (code === "PGRST205" || msg.includes("Could not find the table")) return false;
    return true;
  } catch {
    return true;
  }
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const anchor = sp?.m
    ? parse(sp.m + "-01", "yyyy-MM-dd", new Date())
    : startOfMonth(new Date());

  const gridInicio = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  const gridFim = addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 }), 1);

  const [migrated, eventos, feriados, resumo] = await Promise.all([
    checkMigrationApplied(),
    getEventosNoIntervalo(gridInicio.toISOString(), gridFim.toISOString()),
    getFeriadosNoIntervalo(format(gridInicio, "yyyy-MM-dd"), format(gridFim, "yyyy-MM-dd")),
    getAgendaResumo(startOfMonth(anchor).toISOString(), addMonths(startOfMonth(anchor), 1).toISOString()),
  ]);

  return (
    <AppShell>
      {!migrated && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <div className="font-semibold text-warning mb-0.5">Banco de dados precisa ser atualizado</div>
            <div className="text-muted-foreground">
              Aplique a migration <code className="font-mono text-[12px] bg-muted/40 px-1 py-0.5 rounded">supabase/migrations/0002_agenda.sql</code> no Supabase
              (SQL Editor → New query → cole o arquivo → Run) para habilitar criação de compromissos, tarefas e alertas.
              Até lá, a Agenda mostra somente a interface vazia.
            </div>
          </div>
        </div>
      )}
      <AgendaView
        anchorIso={anchor.toISOString()}
        eventos={eventos}
        feriados={feriados}
        resumo={resumo}
      />
    </AppShell>
  );
}
