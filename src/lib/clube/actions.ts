"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { proximoNivel, nomeMes, labelDoNivel } from "./niveis";
import { classificarCompetencia } from "./engine";

async function pegarTenant() {
  const sb = await createClient();
  const { data } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  return (data as { id: string } | null)?.id;
}

/**
 * Classifica todos os clientes baseado nas vendas do mês de REFERÊNCIA.
 * Resultado é aplicado no mês SEGUINTE (mes_aplicacao = mes_ref + 1).
 *
 * Ex: classificarMes("2026-05-01") → membros maio/26 usufruirão em junho/26.
 */
export async function classificarMes(mesRef: string): Promise<{
  classificados: number;
  porNivel: Record<string, number>;
}> {
  // pegarTenant usa a sessão do usuário (RLS) — funciona como gate de auth;
  // a escrita em lote roda com service_role pelo MOTOR ÚNICO (engine.ts),
  // o mesmo do fechamento automático do cron. Nunca reimplementar aqui.
  const tenant_id = await pegarTenant();
  if (!tenant_id) throw new Error("Tenant não encontrado");

  const r = await classificarCompetencia(createAdminClient(), tenant_id, mesRef);

  revalidatePath("/publicidade");
  return { classificados: r.classificados, porNivel: r.porNivel };
}

/**
 * Gera disparos de mensagem pra todos os classificados do mês_aplicacao.
 * Cria uma "campanha" no marketing_campanhas + envios pra cada cliente.
 */
export async function gerarDisparosClube(
  mesAplicacao: string,
  templateId: string,
  unidadeIds: string[] | null,
): Promise<{ campanhaId: string; envios: number }> {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  if (!tenant_id) throw new Error("Tenant não encontrado");

  // Pegar template
  const { data: tpl } = await sb.from("clube_templates_mensagem").select("*").eq("id", templateId).single();
  if (!tpl) throw new Error("Template não encontrado");
  const template = tpl as { tipo: string; titulo: string; mensagem: string; nivel_alvo: string | null };

  // Pegar classificações do mês
  let qC = sb.from("clube_classificacoes")
    .select(`
      id, ciclos_mes, nivel, desconto_pct, mes_ref, mes_aplicacao,
      cliente:clientes(id, nome, telefone, cpf),
      unidade:unidades(nome),
      unidade_id
    `)
    .eq("mes_aplicacao", mesAplicacao)
    .neq("nivel", "nao_classificado");
  if (unidadeIds && unidadeIds.length > 0) qC = qC.in("unidade_id", unidadeIds);
  if (template.nivel_alvo) qC = qC.eq("nivel", template.nivel_alvo);
  const { data: classif } = await qC;
  type CRaw = {
    id: string; ciclos_mes: number; nivel: string; desconto_pct: number;
    mes_ref: string; mes_aplicacao: string; unidade_id: string;
    cliente: { id: string; nome: string; telefone: string | null; cpf: string } | Array<{ id: string; nome: string; telefone: string | null; cpf: string }> | null;
    unidade: { nome: string } | Array<{ nome: string }> | null;
  };
  type C = Omit<CRaw, "cliente"> & { cliente: { id: string; nome: string; telefone: string | null; cpf: string } | null };
  const listaRaw = (classif ?? []) as unknown as CRaw[];
  const lista: C[] = listaRaw.map((r) => ({
    ...r,
    cliente: Array.isArray(r.cliente) ? (r.cliente[0] ?? null) : r.cliente,
  }));

  // Buscar pontos pra renderizar
  const cIds = lista.map((c) => c.cliente?.id).filter(Boolean) as string[];
  const pontosMap = new Map<string, number>();
  if (cIds.length > 0) {
    const { data: p } = await sb.from("clube_pontos").select("cliente_id, saldo_pontos").in("cliente_id", cIds);
    for (const x of (p ?? []) as Array<{ cliente_id: string; saldo_pontos: number }>) {
      pontosMap.set(x.cliente_id, x.saldo_pontos);
    }
  }

  // Criar campanha
  const { data: camp } = await sb.from("marketing_campanhas").insert({
    tenant_id,
    unidade_id: unidadeIds && unidadeIds.length === 1 ? unidadeIds[0] : null,
    nome: `Clube · ${template.titulo} · ${mesAplicacao}`,
    descricao: `Disparo automático do Clube de Vantagens — template "${template.titulo}"`,
    canal: "whatsapp",
    template_mensagem: template.mensagem,
    segmento: "todos",
    status: "concluida",
    total_destinatarios: lista.length,
    total_enviados: lista.length,
    concluida_em: new Date().toISOString(),
  }).select("id").single();
  if (!camp) throw new Error("Falha ao criar campanha");
  const campanhaId = (camp as { id: string }).id;

  // Renderizar mensagens e criar envios
  function renderizar(c: C): string {
    const cli = c.cliente!;
    const proxNiv = proximoNivel(c.ciclos_mes);
    const mesRef = new Date(c.mes_ref + "T12:00:00");
    const mesAplic = new Date(c.mes_aplicacao + "T12:00:00");
    const pontos = pontosMap.get(cli.id) ?? c.ciclos_mes;
    return template.mensagem
      .replace(/\{primeiro_nome\}/gi, cli.nome.split(" ")[0])
      .replace(/\{nome\}/gi, cli.nome)
      .replace(/\{cpf\}/gi, cli.cpf)
      .replace(/\{nivel\}/gi, labelDoNivel(c.nivel as never).toUpperCase())
      .replace(/\{ciclos\}/gi, String(c.ciclos_mes))
      .replace(/\{desconto\}/gi, String(c.desconto_pct))
      .replace(/\{pontos\}/gi, String(pontos))
      .replace(/\{faltam\}/gi, String(proxNiv.faltam))
      .replace(/\{proximo_nivel\}/gi, proxNiv.proximo ? proxNiv.proximo.label.toUpperCase() : "TOPO")
      .replace(/\{desconto_proximo\}/gi, String(proxNiv.proximo?.descontoPct ?? 0))
      .replace(/\{faltam_proximo\}/gi, String(proxNiv.faltam))
      .replace(/\{mes_ref_nome\}/gi, nomeMes(mesRef))
      .replace(/\{mes_aplic_nome\}/gi, nomeMes(mesAplic));
  }

  const envios = lista
    .filter((c) => c.cliente !== null)
    .map((c) => ({
      campanha_id: campanhaId,
      tenant_id,
      cliente_id: c.cliente!.id,
      destinatario_nome: c.cliente!.nome,
      destinatario_telefone: c.cliente!.telefone,
      destinatario_cpf: c.cliente!.cpf,
      mensagem_renderizada: renderizar(c),
      status: "pendente" as const,
      provider: "manual",
    }));

  for (let i = 0; i < envios.length; i += 200) {
    await sb.from("marketing_envios").insert(envios.slice(i, i + 200));
  }

  revalidatePath("/publicidade");
  return { campanhaId, envios: envios.length };
}
