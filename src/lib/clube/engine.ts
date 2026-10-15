// LavSync · Clube · MOTOR ÚNICO de agregação e classificação mensal
//
// Fonte única da verdade para: classificação persistida (UI e cron),
// situação ao vivo (lista por unidade) e cards de resumo. Elimina as
// divergências históricas entre 3 implementações paralelas:
//   · janela do mês SEMPRE em horário de Brasília (-03:00)
//   · vendas SEMPRE paginadas (junho/26 tem 1091 — o teto de 1000 do
//     PostgREST cortava 91 vendas na versão antiga da UI)
//   · ciclos do cliente somam TODAS as unidades (regulamento: desconto
//     vale em qualquer unidade); unidade exibida = a de maior uso
import "server-only";
import { paginarTodos } from "@/lib/supabase/pagination";
import { classificar } from "./niveis";

// Cliente estrutural mínimo — aceita tanto o client de sessão quanto o admin.
// (supabase-js tipa por schema; aqui só precisamos de .from encadeável)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SbLike = { from: (table: string) => any };

export type AggCliente = {
  cliente_id: string;
  ciclos: number;
  ciclos_lavagem: number;
  ciclos_secagem: number;
  faturamento: number;
  unidade_principal: string;            // unidade com mais ciclos do cliente
  por_unidade: Map<string, number>;     // ciclos por unidade (transparência)
};

export type AgregadoCompetencia = {
  porCliente: Map<string, AggCliente>;
  semCadastro: { vendas: number; ciclos: number; faturamento: number };
};

/** Janela [início, fim] do mês em horário de Brasília. */
export function janelaMesBR(mesRef: string): { ini: string; fim: string } {
  const [ano, mes] = mesRef.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    ini: `${mesRef.slice(0, 8)}01T00:00:00-03:00`,
    fim: `${mesRef.slice(0, 7)}-${String(ultimoDia).padStart(2, "0")}T23:59:59.999-03:00`,
  };
}

/**
 * Agrega as vendas de sucesso da competência por CLIENTE (todas as
 * unidades). Combo divide lavagem/secagem meio a meio. Vendas sem
 * cliente_id não classificam — voltam somadas em `semCadastro`.
 */
export async function agregarCompetencia(sb: SbLike, mesRef: string): Promise<AgregadoCompetencia> {
  const { ini, fim } = janelaMesBR(mesRef);

  type V = {
    cliente_id: string | null; unidade_id: string; valor: number | string;
    tipo_servico: string | null; quantidade_ciclos: number | string | null;
  };
  const vendas = await paginarTodos<V>((r) =>
    sb.from("vendas")
      .select("cliente_id, unidade_id, valor, tipo_servico, quantidade_ciclos")
      .eq("situacao", "sucesso")
      .gte("data_venda", ini)
      .lte("data_venda", fim)
      .range(r.from, r.to),
  );

  const porCliente = new Map<string, AggCliente>();
  const semCadastro = { vendas: 0, ciclos: 0, faturamento: 0 };

  for (const v of vendas) {
    const ciclos = Math.max(1, Number(v.quantidade_ciclos) || 1);
    const valor = Number(v.valor) || 0;
    if (!v.cliente_id) {
      semCadastro.vendas += 1;
      semCadastro.ciclos += ciclos;
      semCadastro.faturamento += valor;
      continue;
    }
    const cur = porCliente.get(v.cliente_id) ?? {
      cliente_id: v.cliente_id, ciclos: 0, ciclos_lavagem: 0, ciclos_secagem: 0,
      faturamento: 0, unidade_principal: v.unidade_id, por_unidade: new Map<string, number>(),
    };
    cur.ciclos += ciclos;
    cur.faturamento += valor;
    if (v.tipo_servico === "lavagem") cur.ciclos_lavagem += ciclos;
    else if (v.tipo_servico === "secagem") cur.ciclos_secagem += ciclos;
    else if (v.tipo_servico === "combo") {
      cur.ciclos_lavagem += Math.ceil(ciclos / 2);
      cur.ciclos_secagem += Math.floor(ciclos / 2);
    }
    cur.por_unidade.set(v.unidade_id, (cur.por_unidade.get(v.unidade_id) ?? 0) + ciclos);
    porCliente.set(v.cliente_id, cur);
  }

  // Unidade principal = a de maior uso no mês
  for (const c of porCliente.values()) {
    let melhor = c.unidade_principal;
    let max = -1;
    for (const [uid, n] of c.por_unidade.entries()) {
      if (n > max) { max = n; melhor = uid; }
    }
    c.unidade_principal = melhor;
    c.faturamento = Math.round(c.faturamento * 100) / 100;
  }

  semCadastro.faturamento = Math.round(semCadastro.faturamento * 100) / 100;
  return { porCliente, semCadastro };
}

export type ResultadoClassificacao = {
  classificados: number;
  porNivel: Record<string, number>;
  totalClientesComUso: number;
  semCadastro: AgregadoCompetencia["semCadastro"];
};

/**
 * Classifica a competência e PERSISTE (clube_classificacoes + clube_pontos).
 * Escrita em lote — sem loop de queries por cliente. Usar client admin
 * (service_role) tanto no cron quanto na action da UI.
 */
export async function classificarCompetencia(
  sbAdmin: SbLike,
  tenantId: string,
  mesRef: string,
): Promise<ResultadoClassificacao> {
  const { porCliente, semCadastro } = await agregarCompetencia(sbAdmin, mesRef);

  const [ano, mes] = mesRef.split("-").map(Number);
  const mesAplic = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

  const porNivel: Record<string, number> = { bronze: 0, prata: 0, ouro: 0, diamante: 0 };
  const batch: Array<Record<string, unknown>> = [];
  for (const c of porCliente.values()) {
    const nivel = classificar(c.ciclos);
    if (nivel.key === "nao_classificado") continue;
    batch.push({
      tenant_id: tenantId, unidade_id: c.unidade_principal, cliente_id: c.cliente_id,
      mes_ref: mesRef, mes_aplicacao: mesAplic,
      ciclos_mes: c.ciclos, ciclos_lavagem: c.ciclos_lavagem, ciclos_secagem: c.ciclos_secagem,
      faturamento_mes: c.faturamento,
      nivel: nivel.key, desconto_pct: nivel.descontoPct,
    });
    porNivel[nivel.key] += 1;
  }

  // Reclassificação completa da competência — só do tenant que classifica
  // (o service role não tem RLS; sem o filtro apagaria a rede inteira).
  await sbAdmin.from("clube_classificacoes").delete().eq("mes_ref", mesRef).eq("tenant_id", tenantId);
  for (let i = 0; i < batch.length; i += 200) {
    const { error } = await sbAdmin.from("clube_classificacoes").insert(batch.slice(i, i + 200));
    if (error) throw new Error(`clube_classificacoes: ${error.message}`);
  }

  // ── Pontos em LOTE (1 ciclo = 1 ponto), sem N+1 ──
  // total_acumulado = soma de ciclos_mes de todas as classificações do
  // cliente; resgatado preservado.
  const clienteIds = [...porCliente.keys()];
  type ClassRow = { cliente_id: string; ciclos_mes: number };
  const todasClass = await paginarTodos<ClassRow>((r) =>
    sbAdmin.from("clube_classificacoes")
      .select("cliente_id, ciclos_mes")
      .range(r.from, r.to),
  );
  const totalPorCliente = new Map<string, number>();
  for (const c of todasClass) {
    totalPorCliente.set(c.cliente_id, (totalPorCliente.get(c.cliente_id) ?? 0) + c.ciclos_mes);
  }
  type PontosRow = { cliente_id: string; saldo_pontos: number; total_acumulado: number };
  const pontosExistentes = await paginarTodos<PontosRow>((r) =>
    sbAdmin.from("clube_pontos")
      .select("cliente_id, saldo_pontos, total_acumulado")
      .range(r.from, r.to),
  );
  const pontosMap = new Map(pontosExistentes.map((p) => [p.cliente_id, p]));

  const upserts: Array<Record<string, unknown>> = [];
  const afetados = new Set([...clienteIds, ...totalPorCliente.keys()]);
  for (const cid of afetados) {
    const total = totalPorCliente.get(cid) ?? 0;
    const atual = pontosMap.get(cid);
    const resgatado = atual ? atual.total_acumulado - atual.saldo_pontos : 0;
    upserts.push({
      tenant_id: tenantId, cliente_id: cid,
      total_acumulado: total,
      saldo_pontos: Math.max(0, total - resgatado),
      atualizado_em: new Date().toISOString(),
    });
  }
  for (let i = 0; i < upserts.length; i += 200) {
    const { error } = await sbAdmin.from("clube_pontos")
      .upsert(upserts.slice(i, i + 200), { onConflict: "cliente_id" });
    if (error) throw new Error(`clube_pontos: ${error.message}`);
  }

  return {
    classificados: batch.length,
    porNivel,
    totalClientesComUso: porCliente.size,
    semCadastro,
  };
}
