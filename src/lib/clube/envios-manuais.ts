"use server";
// LavSync · Clube · Marcação de envio manual (WhatsApp Web assistido)
import { createClient } from "@/lib/supabase/server";

export type TipoEnvioManual = "qualificacao" | "xoclub";

/** Marca/desmarca que o cliente recebeu a mensagem do mês (por tipo). */
export async function marcarEnvioManual(args: {
  clienteId: string;
  unidadeId?: string | null;
  mesRef: string;               // YYYY-MM-01
  tipo: TipoEnvioManual;
  enviado: boolean;
}): Promise<{ ok: boolean; erro?: string }> {
  const sb = await createClient();
  const { data: t } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  const tenantId = (t as { id: string } | null)?.id;
  if (!tenantId) return { ok: false, erro: "Tenant não encontrado" };

  if (!args.enviado) {
    const { error } = await sb.from("clube_envios_manuais")
      .delete()
      .eq("cliente_id", args.clienteId)
      .eq("mes_ref", args.mesRef)
      .eq("tipo", args.tipo);
    return error ? { ok: false, erro: error.message } : { ok: true };
  }

  const { data: u } = await sb.auth.getUser();
  const { error } = await sb.from("clube_envios_manuais").upsert({
    tenant_id: tenantId,
    cliente_id: args.clienteId,
    unidade_id: args.unidadeId ?? null,
    mes_ref: args.mesRef,
    tipo: args.tipo,
    enviado_em: new Date().toISOString(),
    enviado_por: u?.user?.id ?? null,
  }, { onConflict: "cliente_id,mes_ref,tipo" });
  return error ? { ok: false, erro: error.message } : { ok: true };
}

/** IDs de clientes já marcados como enviados no mês, por tipo. */
export async function listarEnviosManuais(
  mesRef: string,
  tipo: TipoEnvioManual,
): Promise<string[]> {
  const sb = await createClient();
  const ids: string[] = [];
  // paginação manual simples (pode passar de 1000 clientes)
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("clube_envios_manuais")
      .select("cliente_id")
      .eq("mes_ref", mesRef)
      .eq("tipo", tipo)
      .range(from, from + 999);
    const rows = (data ?? []) as Array<{ cliente_id: string }>;
    ids.push(...rows.map((r) => r.cliente_id));
    if (rows.length < 1000) break;
  }
  return ids;
}
