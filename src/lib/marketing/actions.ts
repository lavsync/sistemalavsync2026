"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { resolverAlvosCampanha, type Campanha } from "./queries";
import { renderizarParaEnvio } from "@/lib/clock-relacionamento/template-engine";
import { carregarOptOuts, suprimido } from "@/lib/clock-relacionamento/optout";
import { enfileirar, type ItemFila } from "@/lib/clock-relacionamento/fila";

async function pegarTenant() {
  const sb = await createClient();
  const { data } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  return (data as { id: string } | null)?.id;
}

export type CampanhaInput = {
  id?: string;
  unidade_id: string;
  nome: string;
  descricao?: string | null;
  canal: "whatsapp" | "email" | "sms";
  template_mensagem: string;
  segmento: "campeoes" | "fieis" | "em_risco" | "dormentes" | "novos" | "todos";
  filtro_dias_sem_compra?: number | null;
  filtro_ltv_minimo?: number | null;
  status?: "rascunho" | "agendada" | "enviando" | "concluida" | "cancelada";
  agendada_para?: string | null;
};

export async function salvarCampanha(input: CampanhaInput) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  if (input.id) {
    const { error } = await sb.from("marketing_campanhas").update(input).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("marketing_campanhas").insert({ ...input, tenant_id });
    if (error) throw error;
  }
  revalidatePath("/publicidade");
}

export async function deletarCampanha(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("marketing_campanhas").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/publicidade");
}

/**
 * Dispara a campanha pela engine CLOCK Relacionamento:
 *  1. resolve alvos (RFM/filtros)
 *  2. aplica opt-out (SAIR/SAIRPROMO) — campanha é escopo 'promo'
 *  3. renderiza com o motor de templates ({{var}} + compat {var} + rodapé opt-out)
 *  4. grava marketing_envios (log de auditoria da campanha / export)
 *  5. enfileira em msg_fila (fila unificada de despacho)
 *
 * Sprint 1: a fila fica em dry-run até o provider WhatsApp (Meta Cloud API) entrar.
 * Doc: docs/CLOCK-RELACIONAMENTO.md §7-8.
 */
export async function dispararCampanha(
  campanhaId: string,
): Promise<{ destinatarios: number; envios: number; suprimidos: number }> {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  if (!tenant_id) throw new Error("Tenant não resolvido");
  const { data: camp } = await sb.from("marketing_campanhas").select("*").eq("id", campanhaId).single();
  if (!camp) throw new Error("Campanha não encontrada");

  const c = camp as Campanha;
  const alvos = await resolverAlvosCampanha(c);
  if (alvos.length === 0) {
    await sb.from("marketing_campanhas").update({ status: "concluida", concluida_em: new Date().toISOString() }).eq("id", campanhaId);
    return { destinatarios: 0, envios: 0, suprimidos: 0 };
  }

  // Opt-out: filtra quem pediu SAIR/SAIRPROMO (campanha = 'promo').
  const flags = await carregarOptOuts(tenant_id, alvos.map((a) => a.id));
  const elegiveis = alvos.filter((a) => !suprimido("promo", flags.get(a.id)));
  const suprimidos = alvos.length - elegiveis.length;

  const renderizado = elegiveis.map((a) => ({
    a,
    corpo: renderizarParaEnvio(
      c.template_mensagem,
      {
        nome_cliente: a.nome,
        nome: a.nome,
        primeiro_nome: a.nome.split(" ")[0],
        telefone_cliente: a.telefone ?? "",
        cpf: a.cpf,
        dias_desde_ultima: a.dias_sem_compra ?? "",
        ultima_compra: a.ultima_compra_em ? new Date(a.ultima_compra_em).toLocaleDateString("pt-BR") : "",
      },
      "promo",
    ),
  }));

  // 4. log de auditoria por campanha (mantém export funcionando)
  const envios = renderizado.map(({ a, corpo }) => ({
    campanha_id: campanhaId, tenant_id, cliente_id: a.id,
    destinatario_nome: a.nome, destinatario_telefone: a.telefone, destinatario_cpf: a.cpf,
    mensagem_renderizada: corpo, status: "pendente" as const, provider: "fila",
  }));
  for (let i = 0; i < envios.length; i += 200) {
    await sb.from("marketing_envios").insert(envios.slice(i, i + 200));
  }

  // 5. fila unificada de despacho (dedupe por campanha+cliente)
  const itens: ItemFila[] = renderizado.map(({ a, corpo }) => ({
    tenant_id, unidade_id: c.unidade_id, tipo: "campanha", escopo: "promo",
    cliente_id: a.id, campanha_id: campanhaId, canal: c.canal,
    destinatario_nome: a.nome, destinatario_telefone: a.telefone, destinatario_cpf: a.cpf,
    corpo_renderizado: corpo, dedupe_key: `camp:${campanhaId}:${a.id}`,
  }));
  await enfileirar(itens);

  await sb.from("marketing_campanhas").update({
    status: "concluida",
    total_destinatarios: alvos.length,
    total_enviados: elegiveis.length,
    concluida_em: new Date().toISOString(),
  }).eq("id", campanhaId);

  revalidatePath("/publicidade");
  return { destinatarios: alvos.length, envios: elegiveis.length, suprimidos };
}
