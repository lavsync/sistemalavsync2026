"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { classificar, proximoNivel, nomeMes, proximoMes, labelDoNivel } from "./niveis";

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
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  if (!tenant_id) throw new Error("Tenant não encontrado");

  const ini = new Date(mesRef + "T00:00:00");
  const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 0, 23, 59, 59, 999);
  const mesAplicDate = proximoMes(ini);
  const mesAplicStr = mesAplicDate.toISOString().slice(0, 10);

  // Agregar vendas por cliente_id no mês_ref
  const { data: vendas, error } = await sb
    .from("vendas")
    .select("cliente_id, unidade_id, valor, tipo_servico, quantidade_ciclos")
    .eq("situacao", "sucesso")
    .gte("data_venda", ini.toISOString())
    .lte("data_venda", fim.toISOString())
    .not("cliente_id", "is", null);
  if (error) throw error;

  type V = { cliente_id: string; unidade_id: string; valor: number | string; tipo_servico: string | null; quantidade_ciclos: number | string | null };
  const rows = (vendas ?? []) as V[];

  // Agregar
  type Agg = { ciclos: number; lav: number; sec: number; fat: number; unidade_id: string };
  const agg = new Map<string, Agg>();
  for (const v of rows) {
    if (!v.cliente_id) continue;
    const ciclos = Number(v.quantidade_ciclos) || 1;
    const fat = Number(v.valor) || 0;
    const cur = agg.get(v.cliente_id) ?? { ciclos: 0, lav: 0, sec: 0, fat: 0, unidade_id: v.unidade_id };
    cur.ciclos += ciclos;
    cur.fat += fat;
    if (v.tipo_servico === "lavagem") cur.lav += ciclos;
    else if (v.tipo_servico === "secagem") cur.sec += ciclos;
    agg.set(v.cliente_id, cur);
  }

  // Inserir/atualizar classificações (upsert por cliente_id+mes_ref)
  let classificados = 0;
  const porNivel: Record<string, number> = { bronze: 0, prata: 0, ouro: 0, diamante: 0 };
  const batch: Array<Record<string, unknown>> = [];

  for (const [cliente_id, a] of agg.entries()) {
    const nivel = classificar(a.ciclos);
    if (nivel.key === "nao_classificado") continue; // < 8 ciclos não entra
    batch.push({
      tenant_id,
      unidade_id: a.unidade_id,
      cliente_id,
      mes_ref: mesRef,
      mes_aplicacao: mesAplicStr,
      ciclos_mes: a.ciclos,
      ciclos_lavagem: a.lav,
      ciclos_secagem: a.sec,
      faturamento_mes: Math.round(a.fat * 100) / 100,
      nivel: nivel.key,
      desconto_pct: nivel.descontoPct,
    });
    classificados++;
    porNivel[nivel.key] += 1;
  }

  // Apagar classificações anteriores deste mes_ref (re-classificação completa)
  await sb.from("clube_classificacoes").delete().eq("mes_ref", mesRef);

  // Inserir em lotes de 200
  for (let i = 0; i < batch.length; i += 200) {
    const slice = batch.slice(i, i + 200);
    const { error: insErr } = await sb.from("clube_classificacoes").insert(slice);
    if (insErr) throw insErr;
  }

  // Atualizar pontos acumulados (1 ciclo = 1 ponto)
  for (const [cliente_id, a] of agg.entries()) {
    const { data: existente } = await sb
      .from("clube_pontos")
      .select("saldo_pontos, total_acumulado")
      .eq("cliente_id", cliente_id)
      .maybeSingle();
    if (existente) {
      // Recalcula total a partir do zero pra ser idempotente
      const { data: todasClass } = await sb
        .from("clube_classificacoes")
        .select("ciclos_mes")
        .eq("cliente_id", cliente_id);
      const totalCiclos = ((todasClass ?? []) as Array<{ ciclos_mes: number }>).reduce((s, c) => s + c.ciclos_mes, 0);
      const exist = existente as { saldo_pontos: number; total_acumulado: number };
      await sb.from("clube_pontos").update({
        total_acumulado: totalCiclos,
        saldo_pontos: Math.max(0, totalCiclos - (exist.total_acumulado - exist.saldo_pontos)),
      }).eq("cliente_id", cliente_id);
    } else {
      await sb.from("clube_pontos").insert({
        tenant_id, cliente_id,
        saldo_pontos: a.ciclos,
        total_acumulado: a.ciclos,
      });
    }
  }

  revalidatePath("/publicidade");
  return { classificados, porNivel };
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
