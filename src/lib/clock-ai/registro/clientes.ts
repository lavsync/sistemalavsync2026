// LavSync · CLOCK v2 · Registro · Clientes
//
// Base, RFM, gênero, top do mês, novos e crescimento; busca de cliente
// SEM diferença de acento (buscaCliente/norm, nos dois lados); inativos
// para win-back. LGPD: CPF nunca sai, telefone sai mascarado.
import "server-only";
import { paginarTodos } from "@/lib/supabase/pagination";
import { buscaCliente } from "@/lib/utils";
import {
  getClientesKpis, getSegmentacaoRFM, getDistribuicaoGenero, getTopClientesMes, getNovosClientes, getCrescimentoSemanal,
} from "@/lib/clientes-queries";
import { getMovimentosCliente } from "@/lib/xoclub/queries";
import { proximoNivel, labelDoNivel } from "@/lib/clube/niveis";
import type { NivelClube } from "@/lib/clube/niveis";
import type { DefConsulta } from "./tipos";
import {
  resolverUnidades, textoObrig, inteiro, mascararTelefone, mesBR, janelaMes, nomeUnidade, r2, ErroClock,
} from "./comum";

const P_UNIDADE = { type: "string", description: "Nome ou id da unidade. Vazio = todas as liberadas." };

const kpisSegmentos: DefConsulta = {
  id: "clientes_kpis_e_segmentos",
  modulo: "clientes",
  descricao:
    "Base de clientes: total, ativos em 90 dias, em risco (25 a 60 dias sem comprar), dormentes (60+), novos em 30 dias, LTV médio; segmentos RFM; " +
    "gênero; top 5 do mês; novos clientes dos últimos 30 dias contra os 30 anteriores; crescimento semanal (novos x recorrentes).",
  permissao: "clientes.view",
  params: { type: "object", properties: { unidade: P_UNIDADE } },
  async executar(ctx, p) {
    const ids = resolverUnidades(ctx, p.unidade).map((u) => u.id);
    const kpis = await getClientesKpis(ids);
    const rfm = await getSegmentacaoRFM(ids);
    const genero = await getDistribuicaoGenero(ids);
    const top = await getTopClientesMes(ids, 5);
    const novos = await getNovosClientes(ids, "30d", 1);
    const cresc = await getCrescimentoSemanal(ids, 8);
    return {
      base: {
        total: kpis.total, ativos_90d: kpis.ativos90d, em_risco: kpis.emRisco, dormentes: kpis.dormentes,
        novos_30d: kpis.novosUltimos30d, ltv_medio: r2(kpis.ltvMedio),
      },
      rfm: rfm.map((s) => ({ segmento: s.segment, clientes: s.count, descricao: s.desc })),
      genero: genero.map((g) => ({ genero: g.label, clientes: g.count, pct: r2(g.percent) })),
      top_do_mes: top.map((c) => ({ cliente_id: c.id, nome: c.nome, visitas: c.visitasMes, valor: r2(c.valorMes), ultima_compra: c.ultimaCompra })),
      novos_30d: { atual: novos.totalAtual, base: novos.totalAnterior, base_descricao: "os 30 dias anteriores", variacao_pct: r2(novos.variacaoPercent) },
      crescimento_semanal: cresc,
    };
  },
};

type ClienteBusca = {
  id: string; nome: string; cpf: string | null; telefone: string | null; unidade_id: string | null;
  ultima_compra_em: string | null; cadastrado_em: string | null; compras_total_qtd: number | null; compras_total_valor: number | string | null;
};

const buscarCliente: DefConsulta = {
  id: "buscar_cliente",
  modulo: "clientes",
  descricao:
    "Ficha do cliente por nome (sem diferença de acento), CPF ou telefone: nível vigente do Clube, ciclos no mês (somando todas as unidades) e quanto falta " +
    "para o próximo nível, saldo de LavCoins e últimos movimentos, última compra e histórico. Devolve cliente_id para ações.",
  permissao: "clientes.view",
  params: { type: "object", properties: { termo: { type: "string", description: "Nome (parcial), CPF ou telefone" }, unidade: P_UNIDADE }, required: ["termo"] },
  async executar(ctx, p) {
    const termo = textoObrig(p, "termo");
    const ids = resolverUnidades(ctx, p.unidade).map((u) => u.id);
    const digitos = termo.replace(/\D/g, "");
    const cols = "id, nome, cpf, telefone, unidade_id, ultima_compra_em, cadastrado_em, compras_total_qtd, compras_total_valor";

    let candidatos: ClienteBusca[];
    if (digitos.length >= 3) {
      const { data, error } = await ctx.sb.from("clientes").select(cols).in("unidade_id", ids)
        .or(`cpf.ilike.%${digitos}%,telefone.ilike.%${digitos}%`).limit(50);
      if (error) throw new Error(error.message);
      candidatos = (data ?? []) as ClienteBusca[];
    } else {
      if (termo.length < 2) throw new ErroClock("Informe ao menos duas letras do nome.");
      // Busca acento-insensível: normaliza os DOIS lados (ilike não ignora acento)
      candidatos = await paginarTodos<ClienteBusca>((r) =>
        ctx.sb.from("clientes").select(cols).in("unidade_id", ids).order("nome").range(r.from, r.to),
      );
    }
    const achados = candidatos.filter((c) => buscaCliente(termo, c));
    if (achados.length === 0) return { encontrado: false, termo };

    const mesAtual = mesBR(0);
    const { ini, fim } = janelaMes(mesAtual);
    const fichas = [];
    for (const c of achados.slice(0, 5)) {
      // Ciclos do Clube somam TODAS as unidades (regulamento)
      const vendas = await paginarTodos<{ quantidade_ciclos: number | string | null }>((r) =>
        ctx.sb.from("vendas").select("quantidade_ciclos").eq("cliente_id", c.id).eq("situacao", "sucesso")
          .gte("data_venda", ini).lte("data_venda", fim).range(r.from, r.to),
      );
      const ciclos = vendas.reduce((s, v) => s + Math.max(1, Number(v.quantidade_ciclos) || 1), 0);
      const { data: cl } = await ctx.sb.from("clube_classificacoes").select("nivel, desconto_pct")
        .eq("cliente_id", c.id).eq("mes_aplicacao", mesAtual).maybeSingle();
      const { data: xc } = await ctx.sb.from("xoclub_saldos").select("saldo_atual").eq("cliente_id", c.id).maybeSingle();
      const movs = await getMovimentosCliente(c.id, 5);
      const prox = proximoNivel(ciclos);
      const nivel = (cl as { nivel: NivelClube; desconto_pct: number } | null);
      fichas.push({
        cliente_id: c.id,
        nome: c.nome,
        telefone: mascararTelefone(c.telefone),
        unidade: nomeUnidade(ctx, c.unidade_id),
        cliente_desde: c.cadastrado_em,
        ultima_compra: c.ultima_compra_em,
        compras_total: c.compras_total_qtd ?? 0,
        valor_total: r2(Number(c.compras_total_valor) || 0),
        clube: {
          nivel_vigente: nivel ? labelDoNivel(nivel.nivel) : "sem desconto",
          desconto_vigente_pct: nivel?.desconto_pct ?? 0,
          ciclos_no_mes: ciclos,
          proximo_nivel: prox.proximo?.label ?? "topo",
          faltam_ciclos: prox.faltam,
        },
        lavcoins: {
          saldo: (xc as { saldo_atual: number } | null)?.saldo_atual ?? 0,
          ultimos_movimentos: movs.map((m) => ({ tipo: m.tipo, valor: m.valor, data: m.data_movimento })),
        },
      });
    }
    return { encontrado: true, total_encontrados: achados.length, mostrando: fichas.length, clientes: fichas };
  },
};

const clientesInativos: DefConsulta = {
  id: "clientes_inativos",
  modulo: "clientes",
  descricao:
    "Clientes sem comprar há N dias ou mais (padrão 30), por unidade, ordenados pelo valor histórico (melhores para win-back), com saldo de LavCoins. " +
    "Devolve o total e os primeiros da lista.",
  permissao: "clientes.view",
  params: {
    type: "object",
    properties: {
      dias_min: { type: "integer", description: "Mínimo de dias sem comprar (padrão 30)" },
      dias_max: { type: "integer", description: "Máximo de dias sem comprar (opcional; ex.: 60 para 'em risco')" },
      unidade: P_UNIDADE,
      limite: { type: "integer", description: "Quantos listar (padrão 15, máximo 50)" },
    },
  },
  async executar(ctx, p) {
    const ids = resolverUnidades(ctx, p.unidade).map((u) => u.id);
    const min = inteiro(p, "dias_min", 30, 1, 3650);
    const max = p.dias_max == null ? null : inteiro(p, "dias_max", 3650, min, 3650);
    const limite = inteiro(p, "limite", 15, 1, 50);
    const agora = Date.now();
    const corte = new Date(agora - min * 86_400_000).toISOString();
    const corteMax = max ? new Date(agora - max * 86_400_000).toISOString() : null;
    type Row = { id: string; nome: string; telefone: string | null; unidade_id: string | null; ultima_compra_em: string; compras_total_qtd: number | null; compras_total_valor: number | string | null };
    const rows = await paginarTodos<Row>((r) => {
      let q = ctx.sb.from("clientes")
        .select("id, nome, telefone, unidade_id, ultima_compra_em, compras_total_qtd, compras_total_valor")
        .in("unidade_id", ids)
        .lt("ultima_compra_em", corte);
      if (corteMax) q = q.gte("ultima_compra_em", corteMax);
      return q.order("id").range(r.from, r.to);
    });
    const ordenados = rows.sort((a, b) => (Number(b.compras_total_valor) || 0) - (Number(a.compras_total_valor) || 0));
    const top = ordenados.slice(0, limite);
    const { data: ss } = top.length
      ? await ctx.sb.from("xoclub_saldos").select("cliente_id, saldo_atual").in("cliente_id", top.map((c) => c.id))
      : { data: [] };
    const saldo = new Map(((ss ?? []) as Array<{ cliente_id: string; saldo_atual: number }>).map((s) => [s.cliente_id, s.saldo_atual]));
    const porUnidade: Record<string, number> = {};
    for (const c of rows) porUnidade[nomeUnidade(ctx, c.unidade_id)] = (porUnidade[nomeUnidade(ctx, c.unidade_id)] ?? 0) + 1;
    return {
      criterio: max ? `entre ${min} e ${max} dias sem comprar` : `${min} dias ou mais sem comprar`,
      total: rows.length,
      por_unidade: porUnidade,
      mostrando: top.length,
      clientes: top.map((c) => ({
        cliente_id: c.id,
        nome: c.nome,
        telefone: mascararTelefone(c.telefone),
        unidade: nomeUnidade(ctx, c.unidade_id),
        dias_parado: Math.floor((agora - new Date(c.ultima_compra_em).getTime()) / 86_400_000),
        compras_total: c.compras_total_qtd ?? 0,
        valor_total: r2(Number(c.compras_total_valor) || 0),
        lavcoins: saldo.get(c.id) ?? 0,
      })),
    };
  },
};

export const CONSULTAS_CLIENTES: DefConsulta[] = [kpisSegmentos, buscarCliente, clientesInativos];
