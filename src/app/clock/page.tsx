// LavSync · /clock — Central do CLOCK
// Conversa grande (mesma conversa do rail, vinda do ClockProvider), briefing do
// dia e alertas (/api/clock/novidades), histórico de ações do usuário
// (clock_acoes, lido com a sessão — RLS restringe ao próprio usuário) e o
// seletor de voz (só admin/master salva).
import { AppShell } from "@/components/shell/app-shell";
import { ClockView, type AcaoHistorico } from "@/components/views/clock-view";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/usuarios-queries";

const LIMITE_HISTORICO = 30;

async function carregarHistorico(usuarioId: string): Promise<{ acoes: AcaoHistorico[]; erro: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clock_acoes")
    .select("id, acao, resumo, risco, status, criado_em, decidido_em")
    .eq("usuario_id", usuarioId)
    .order("criado_em", { ascending: false })
    .limit(LIMITE_HISTORICO);
  if (error) return { acoes: [], erro: true };
  return { acoes: (data ?? []) as AcaoHistorico[], erro: false };
}

export default async function Page() {
  const usuario = await getUsuarioAtual();
  const historico = usuario ? await carregarHistorico(usuario.id) : { acoes: [], erro: false };
  const podeEscolherVoz = usuario?.papel === "master" || usuario?.papel === "admin";

  return (
    <AppShell hideClockRail>
      <ClockView
        nome={usuario?.nome ?? null}
        acoes={historico.acoes}
        historicoIndisponivel={historico.erro}
        podeEscolherVoz={podeEscolherVoz}
      />
    </AppShell>
  );
}
