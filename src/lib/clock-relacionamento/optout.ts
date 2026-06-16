// LavSync · CLOCK Relacionamento · Opt-out
//
// SAIR = opt-out total · SAIRPROMO = só promoções (mantém operacional).
// Mensagens de escopo 'operacional' ignoram opt-out 'promo'.
// Doc: docs/CLOCK-RELACIONAMENTO.md §10.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type OptOutFlags = { todas: boolean; promo: boolean };

/** Carrega flags de opt-out para um conjunto de clientes (1 query, sem N+1). */
export async function carregarOptOuts(
  tenantId: string,
  clienteIds: string[],
): Promise<Map<string, OptOutFlags>> {
  const mapa = new Map<string, OptOutFlags>();
  if (clienteIds.length === 0) return mapa;
  const sb = createAdminClient();
  const { data } = await sb
    .from("msg_optout")
    .select("cliente_id, escopo")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .in("cliente_id", clienteIds);
  for (const r of (data ?? []) as Array<{ cliente_id: string; escopo: string }>) {
    const f = mapa.get(r.cliente_id) ?? { todas: false, promo: false };
    if (r.escopo === "todas") f.todas = true;
    if (r.escopo === "promo") f.promo = true;
    mapa.set(r.cliente_id, f);
  }
  return mapa;
}

/** Uma mensagem deve ser suprimida para este cliente? */
export function suprimido(escopoMsg: "promo" | "operacional", flags?: OptOutFlags): boolean {
  if (!flags) return false;
  if (flags.todas) return true;               // SAIR bloqueia tudo
  if (escopoMsg === "promo" && flags.promo) return true; // SAIRPROMO bloqueia só promo
  return false;
}

/**
 * Registra opt-out (chamado pelo router inbound no Sprint 3, ou manualmente).
 * 'SAIR' → escopo 'todas'; 'SAIRPROMO' → escopo 'promo'.
 */
export async function registrarOptOut(args: {
  tenantId: string;
  clienteId?: string | null;
  telefone?: string | null;
  escopo: "todas" | "promo";
  origem: "SAIR" | "SAIRPROMO" | "manual" | "lgpd";
}): Promise<void> {
  const sb = createAdminClient();
  if (args.clienteId) {
    await sb.from("msg_optout").upsert(
      {
        tenant_id: args.tenantId,
        cliente_id: args.clienteId,
        telefone: args.telefone ?? null,
        escopo: args.escopo,
        origem: args.origem,
        ativo: true,
        em: new Date().toISOString(),
      },
      { onConflict: "tenant_id,cliente_id,escopo" },
    );
  } else {
    await sb.from("msg_optout").insert({
      tenant_id: args.tenantId,
      telefone: args.telefone ?? null,
      escopo: args.escopo,
      origem: args.origem,
      ativo: true,
    });
  }
}

/** Interpreta o texto recebido do cliente. Retorna o escopo de opt-out ou null. */
export function interpretarPalavraOptOut(texto: string): "todas" | "promo" | null {
  const t = texto.trim().toUpperCase().replace(/\s+/g, "");
  if (t === "SAIRPROMO") return "promo";
  if (t === "SAIR") return "todas";
  return null;
}
