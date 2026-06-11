// LavSync · Stone Open Banking · Cron de sincronização automática
//
// Executado pelo Vercel Cron a cada 5 minutos.
// Itera unidades com:
//   - integracoes_stone.ativo = true
//   - integracoes_stone.consent_status = 'aprovado'
//   - integracoes_stone.sync_automatico = true
//   - última sincronização há > sync_intervalo_minutos
//
// Pra cada uma, sincroniza desde a última sync (ou últimas 24h).
// Limite: 50 unidades por execução (timeout Vercel = 5min em hobby, 15min em pro).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sincronizarStoneUnidade } from "@/lib/stone/sync";

export const runtime = "nodejs";
export const maxDuration = 300;                 // 5min — bom pra free e pro plans

const CRON_SECRET = process.env.CRON_SECRET ?? "";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET(req: NextRequest) {
  // Vercel Cron usa header Authorization: Bearer CRON_SECRET
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = admin();
  const inicio = Date.now();

  // Registra início do cron
  const { data: cronStatus } = await sb.from("stone_cron_status").insert({
    iniciado_em: new Date().toISOString(),
  }).select("id").single();
  const cronId = (cronStatus as { id: string } | null)?.id ?? null;

  let processadas = 0, sucesso = 0, erro = 0, vendasTotais = 0;
  const detalhes: Array<Record<string, unknown>> = [];
  let erroGlobal: string | null = null;

  try {
    // Identifica unidades elegíveis
    const { data: alvos } = await sb
      .from("integracoes_stone")
      .select("unidade_id, sync_intervalo_minutos, ultimo_sync_em")
      .eq("ativo", true)
      .eq("consent_status", "aprovado")
      .eq("sync_automatico", true)
      .limit(50);

    type Alvo = {
      unidade_id: string;
      sync_intervalo_minutos: number;
      ultimo_sync_em: string | null;
    };
    const lista = (alvos ?? []) as Alvo[];
    const agora = Date.now();

    for (const a of lista) {
      // Respeita o intervalo configurado por unidade
      if (a.ultimo_sync_em) {
        const decorrido = (agora - new Date(a.ultimo_sync_em).getTime()) / 60000;
        if (decorrido < a.sync_intervalo_minutos) {
          detalhes.push({ unidade_id: a.unidade_id, pulada: true, motivo: `só ${decorrido.toFixed(1)}min desde último sync` });
          continue;
        }
      }

      processadas += 1;
      try {
        // Janela = desde último sync (com 5min de buffer) até agora
        const from = a.ultimo_sync_em
          ? new Date(new Date(a.ultimo_sync_em).getTime() - 5 * 60 * 1000)
          : new Date(agora - 24 * 60 * 60 * 1000);
        const to = new Date(agora);

        const r = await sincronizarStoneUnidade({
          unidadeId: a.unidade_id,
          from,
          to,
          disparadoPor: "cron",
        });

        if (r.status === "erro") {
          erro += 1;
          detalhes.push({
            unidade_id: a.unidade_id,
            status: r.status,
            erro: r.erro,
            sync_log_id: r.syncLogId,
          });
        } else {
          sucesso += 1;
          vendasTotais += r.vendas_inseridas;
          detalhes.push({
            unidade_id: a.unidade_id,
            status: r.status,
            transacoes: r.transacoes_recebidas,
            vendas: r.vendas_inseridas,
            duplicadas: r.vendas_duplicadas,
          });
        }
      } catch (e) {
        erro += 1;
        detalhes.push({
          unidade_id: a.unidade_id,
          status: "erro",
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } catch (e) {
    erroGlobal = e instanceof Error ? e.message : String(e);
  }

  const duracao = Math.round((Date.now() - inicio) / 1000);

  if (cronId) {
    await sb.from("stone_cron_status").update({
      concluido_em: new Date().toISOString(),
      unidades_processadas: processadas,
      unidades_com_sucesso: sucesso,
      unidades_com_erro: erro,
      vendas_inseridas_total: vendasTotais,
      duracao_segundos: duracao,
      detalhes,
      erro_global: erroGlobal,
    }).eq("id", cronId);
  }

  return NextResponse.json({
    cron_id: cronId,
    duracao_segundos: duracao,
    unidades_processadas: processadas,
    unidades_com_sucesso: sucesso,
    unidades_com_erro: erro,
    vendas_inseridas_total: vendasTotais,
    erro_global: erroGlobal,
    detalhes,
  });
}
