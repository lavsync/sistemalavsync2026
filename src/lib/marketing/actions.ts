"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { resolverAlvosCampanha, type Campanha } from "./queries";

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

function renderizar(template: string, dados: { nome?: string; primeiro_nome?: string; cpf?: string; ultima_compra?: string }) {
  return template
    .replace(/\{nome\}/gi, dados.nome ?? "cliente")
    .replace(/\{primeiro_nome\}/gi, dados.primeiro_nome ?? dados.nome?.split(" ")[0] ?? "cliente")
    .replace(/\{cpf\}/gi, dados.cpf ?? "")
    .replace(/\{ultima_compra\}/gi, dados.ultima_compra ?? "");
}

/**
 * Dispara a campanha — cria registros em marketing_envios em status "pendente".
 * NÃO chama API externa ainda — apenas registra. Próximo passo: integrar Z-API.
 * Daniel pode exportar a tabela como CSV e disparar manualmente enquanto isso.
 */
export async function dispararCampanha(campanhaId: string): Promise<{ destinatarios: number; envios: number }> {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  const { data: camp } = await sb.from("marketing_campanhas").select("*").eq("id", campanhaId).single();
  if (!camp) throw new Error("Campanha não encontrada");

  const alvos = await resolverAlvosCampanha(camp as Campanha);
  if (alvos.length === 0) {
    await sb.from("marketing_campanhas").update({ status: "concluida", concluida_em: new Date().toISOString() }).eq("id", campanhaId);
    return { destinatarios: 0, envios: 0 };
  }

  const c = camp as Campanha;
  const envios = alvos.map((a) => ({
    campanha_id: campanhaId,
    tenant_id,
    cliente_id: a.id,
    destinatario_nome: a.nome,
    destinatario_telefone: a.telefone,
    destinatario_cpf: a.cpf,
    mensagem_renderizada: renderizar(c.template_mensagem, {
      nome: a.nome,
      primeiro_nome: a.nome.split(" ")[0],
      cpf: a.cpf,
      ultima_compra: a.ultima_compra_em ? new Date(a.ultima_compra_em).toLocaleDateString("pt-BR") : "",
    }),
    status: "pendente" as const,
    provider: "manual",
  }));

  // insert em batches de 200
  for (let i = 0; i < envios.length; i += 200) {
    await sb.from("marketing_envios").insert(envios.slice(i, i + 200));
  }

  await sb.from("marketing_campanhas").update({
    status: "concluida",
    total_destinatarios: alvos.length,
    total_enviados: alvos.length,
    concluida_em: new Date().toISOString(),
  }).eq("id", campanhaId);

  revalidatePath("/publicidade");
  return { destinatarios: alvos.length, envios: alvos.length };
}
