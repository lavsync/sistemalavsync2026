"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function pegarTenant() {
  const sb = await createClient();
  const { data } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  return (data as { id: string } | null)?.id;
}

export type MaquinaInput = {
  id?: string;
  unidade_id: string;
  codigo: string;
  tipo: "lavadora" | "secadora" | "dobradora" | "totem";
  status: "ativa" | "manutencao" | "inativa";
  capacidade_kg?: number | null;
  equipamento_match?: string | null;
  fabricante?: string | null;
  modelo?: string | null;
  serial_number?: string | null;
  data_aquisicao?: string | null;
  valor_aquisicao?: number | null;
  ultima_manutencao_em?: string | null;
  proxima_manutencao_em?: string | null;
  localizacao?: string | null;
  observacoes?: string | null;
};

export async function salvarMaquina(input: MaquinaInput) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  if (input.id) {
    const { error } = await sb.from("maquinas").update(input).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("maquinas").insert({ ...input, tenant_id });
    if (error) throw error;
  }
  revalidatePath("/manutencao");
}

export async function deletarMaquina(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("maquinas").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/manutencao");
}

export type OSInput = {
  id?: string;
  unidade_id: string;
  maquina_id: string | null;
  tipo: "preventiva" | "corretiva" | "revisao";
  titulo: string;
  descricao?: string | null;
  status?: "aberta" | "em_andamento" | "concluida" | "cancelada";
  prioridade?: "baixa" | "media" | "alta" | "critica";
  custo_estimado?: number | null;
  custo_real?: number | null;
  concluida_em?: string | null;
};

export async function salvarOrdemServico(input: OSInput) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  if (input.id) {
    const { error } = await sb.from("ordens_servico").update(input).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("ordens_servico").insert({ ...input, tenant_id });
    if (error) throw error;
  }
  revalidatePath("/manutencao");
}

export async function deletarOrdemServico(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("ordens_servico").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/manutencao");
}

/** Cria máquina a partir de equipamento detectado (auto-cadastro) */
export async function autoCadastrarMaquina(unidadeId: string, equipamento: string) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  // Inferir tipo pelo prefixo
  const e = equipamento.toUpperCase();
  let tipo: "lavadora" | "secadora" | "totem" = "totem";
  if (e.startsWith("LV") || e.includes("LAVAD")) tipo = "lavadora";
  else if (e.startsWith("SC") || e.includes("SECAD")) tipo = "secadora";
  // Extrair "match" — número/serial dentro do equipamento
  const numMatch = equipamento.match(/(\d{4,})/);
  const match = numMatch ? numMatch[1] : equipamento.split(" ")[0];

  const { error } = await sb.from("maquinas").insert({
    tenant_id,
    unidade_id: unidadeId,
    codigo: equipamento.length > 50 ? equipamento.slice(0, 50) : equipamento,
    tipo,
    status: "ativa",
    equipamento_match: match,
  });
  if (error) throw error;
  revalidatePath("/manutencao");
}
