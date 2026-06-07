// LavSync · CLOCK AI · Engine de insights automáticos
// Aplica heurísticas sobre vendas reais e retorna lista priorizada de insights
// acionáveis. Sem chamadas externas de IA — usa só dados internos.
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type InsightSeveridade = "success" | "info" | "warn" | "danger";
export type InsightIcone =
  | "Clock" | "TrendingDown" | "TrendingUp" | "Crown" | "AlertTriangle"
  | "Wallet" | "Sparkles" | "Users" | "Calendar" | "Tag" | "DollarSign";

export type Insight = {
  id: string;
  severidade: InsightSeveridade;
  icone: InsightIcone;
  titulo: string;
  descricao: string;
  destaque?: string;        // chamariz numérico (ex: "R$ 1.890")
  acao_sugerida?: string;   // CTA curto
  prioridade: number;       // ordenação descending (10 = topo)
};

type VendaLite = {
  data_venda: string;
  valor: number | string;
  cpf: string | null;
  cupom_codigo: string | null;
  valor_sem_desconto: number | string | null;
  tipo_servico: string | null;
};

const DOW_NOMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function gerarInsightsUnidade(unidadeId: string): Promise<Insight[]> {
  const sb = await createClient();

  // Buscar vendas dos últimos 90 dias a partir da ÚLTIMA venda (não de hoje, pra não
  // virar tudo "sem dado" quando a base está atrasada).
  const { data: ultima } = await sb
    .from("vendas")
    .select("data_venda")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .order("data_venda", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ultima?.data_venda) return [];

  const ate = new Date(ultima.data_venda as string);
  const desde90 = new Date(ate.getTime() - 90 * 24 * 60 * 60 * 1000);
  const desde30 = new Date(ate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const desde60 = new Date(ate.getTime() - 60 * 24 * 60 * 60 * 1000);

  const { data: vendas90Raw, error } = await sb
    .from("vendas")
    .select("data_venda, valor, cpf, cupom_codigo, valor_sem_desconto, tipo_servico")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .gte("data_venda", desde90.toISOString())
    .lte("data_venda", ate.toISOString());
  if (error) throw error;
  const vendas90 = (vendas90Raw ?? []) as VendaLite[];
  if (vendas90.length === 0) return [];

  const out: Insight[] = [];

  // ─── 1. Hora ociosa custosa (24h, identifica blocos sem venda) ─────
  {
    const porHora = new Array(24).fill(0);
    const diasNaJanela = new Set<string>();
    for (const v of vendas90) {
      const d = new Date(v.data_venda);
      porHora[d.getHours()]++;
      diasNaJanela.add(d.toISOString().slice(0, 10));
    }
    const nDias = Math.max(1, diasNaJanela.size);
    // Bloco de horas consecutivas com média < 0.1 venda/dia
    let blocos: Array<{ ini: number; fim: number }> = [];
    let ini = -1;
    for (let h = 0; h < 24; h++) {
      const media = porHora[h] / nDias;
      if (media < 0.1) {
        if (ini < 0) ini = h;
      } else {
        if (ini >= 0) blocos.push({ ini, fim: h - 1 });
        ini = -1;
      }
    }
    if (ini >= 0) blocos.push({ ini, fim: 23 });
    // Pega o maior bloco (3+ horas)
    blocos = blocos.filter((b) => b.fim - b.ini + 1 >= 3);
    if (blocos.length > 0) {
      const maior = blocos.reduce((a, b) => (b.fim - b.ini > a.fim - a.ini ? b : a));
      const horas = maior.fim - maior.ini + 1;
      // estimativa custo: aluguel rateado por hora ~ R$5,55/h (4000/720)
      const custoEstimado = horas * nDias * 5.55;
      out.push({
        id: "hora-ociosa",
        severidade: "warn",
        icone: "Clock",
        titulo: `Janela ociosa entre ${String(maior.ini).padStart(2, "0")}h–${String(maior.fim + 1).padStart(2, "0")}h custou ~${fmtBRL(custoEstimado)} em ${nDias} dias`,
        descricao: `Energia + aluguel rateado nessa janela sem venda. Considere reduzir consumo (luz, ar) ou criar promoção pra atrair clientes nesse horário.`,
        destaque: `${horas}h sem vendas`,
        acao_sugerida: "Modelar standby",
        prioridade: 8,
      });
    }
  }

  // ─── 2. Crescimento/queda mês a mês ─────
  {
    const v30 = vendas90.filter((v) => new Date(v.data_venda) >= desde30);
    const v60 = vendas90.filter((v) => {
      const d = new Date(v.data_venda);
      return d >= desde60 && d < desde30;
    });
    const fat30 = v30.reduce((s, v) => s + Number(v.valor), 0);
    const fat60 = v60.reduce((s, v) => s + Number(v.valor), 0);
    if (fat60 > 0) {
      const delta = ((fat30 - fat60) / fat60) * 100;
      if (delta >= 15) {
        out.push({
          id: "crescimento",
          severidade: "success",
          icone: "TrendingUp",
          titulo: `Faturamento cresceu ${delta.toFixed(0)}% nos últimos 30 dias vs 30 anteriores`,
          descricao: `Você passou de ${fmtBRL(fat60)} pra ${fmtBRL(fat30)}. Investigue o que mudou pra manter o momentum.`,
          destaque: `+${delta.toFixed(0)}%`,
          acao_sugerida: "Ver Performance",
          prioridade: 9,
        });
      } else if (delta <= -10) {
        out.push({
          id: "queda",
          severidade: "danger",
          icone: "TrendingDown",
          titulo: `Faturamento caiu ${Math.abs(delta).toFixed(0)}% nos últimos 30 dias`,
          descricao: `${fmtBRL(fat60)} → ${fmtBRL(fat30)}. Pode ser sazonalidade ou concorrência. Verifique também se há queda de horas ativas.`,
          destaque: `${delta.toFixed(0)}%`,
          acao_sugerida: "Comparar períodos",
          prioridade: 10,
        });
      }
    }
  }

  // ─── 3. DOW (dia da semana) muito acima/abaixo da média ─────
  {
    const v30 = vendas90.filter((v) => new Date(v.data_venda) >= desde30);
    const porDow = new Array(7).fill(0);
    const diasPorDow = new Array(7).fill(new Set<string>()).map(() => new Set<string>());
    for (const v of v30) {
      const d = new Date(v.data_venda);
      const dw = d.getDay();
      porDow[dw] += Number(v.valor);
      diasPorDow[dw].add(d.toISOString().slice(0, 10));
    }
    const mediaPorDow = porDow.map((tot, i) => (diasPorDow[i].size > 0 ? tot / diasPorDow[i].size : 0));
    const overall = mediaPorDow.reduce((s, v) => s + v, 0) / 7;
    if (overall > 0) {
      // pior dia
      let piorIdx = 0, piorVal = mediaPorDow[0];
      for (let i = 1; i < 7; i++) if (mediaPorDow[i] < piorVal) { piorIdx = i; piorVal = mediaPorDow[i]; }
      const pctVsMedia = ((piorVal - overall) / overall) * 100;
      if (pctVsMedia < -30 && piorVal > 0) {
        out.push({
          id: "dow-fraco",
          severidade: "warn",
          icone: "Calendar",
          titulo: `${DOW_NOMES[piorIdx][0].toUpperCase()}${DOW_NOMES[piorIdx].slice(1)} é seu pior dia (${pctVsMedia.toFixed(0)}% vs média)`,
          descricao: `Média ${fmtBRL(piorVal)} vs ${fmtBRL(overall)} nos outros dias. Promoção temática (ex: "happy ${DOW_NOMES[piorIdx]}" -20%) pode ajudar.`,
          destaque: `${fmtBRL(piorVal)}/${DOW_NOMES[piorIdx]}`,
          acao_sugerida: "Planejar promoção",
          prioridade: 6,
        });
      }
      // melhor dia
      let melIdx = 0, melVal = mediaPorDow[0];
      for (let i = 1; i < 7; i++) if (mediaPorDow[i] > melVal) { melIdx = i; melVal = mediaPorDow[i]; }
      const pctMel = ((melVal - overall) / overall) * 100;
      if (pctMel > 40) {
        out.push({
          id: "dow-forte",
          severidade: "info",
          icone: "Sparkles",
          titulo: `${DOW_NOMES[melIdx][0].toUpperCase()}${DOW_NOMES[melIdx].slice(1)} é seu campeão (${pctMel.toFixed(0)}% acima da média)`,
          descricao: `Média ${fmtBRL(melVal)}. Aproveite pra reforçar estoque de produtos e equipe nesse dia.`,
          destaque: `+${pctMel.toFixed(0)}%`,
          prioridade: 5,
        });
      }
    }
  }

  // ─── 4. Ticket médio caindo ─────
  {
    const v30 = vendas90.filter((v) => new Date(v.data_venda) >= desde30);
    const v60 = vendas90.filter((v) => {
      const d = new Date(v.data_venda);
      return d >= desde60 && d < desde30;
    });
    const tk30 = v30.length > 0 ? v30.reduce((s, v) => s + Number(v.valor), 0) / v30.length : 0;
    const tk60 = v60.length > 0 ? v60.reduce((s, v) => s + Number(v.valor), 0) / v60.length : 0;
    if (tk60 > 0 && tk30 < tk60 * 0.92) {
      const delta = ((tk30 - tk60) / tk60) * 100;
      out.push({
        id: "ticket-cai",
        severidade: "warn",
        icone: "TrendingDown",
        titulo: `Ticket médio caiu ${Math.abs(delta).toFixed(1)}% nos últimos 30 dias`,
        descricao: `${fmtBRL(tk60)} → ${fmtBRL(tk30)}. Pode indicar mais ciclos curtos ou queda no mix premium (combo lava+seca).`,
        destaque: `${fmtBRL(tk30)}`,
        acao_sugerida: "Revisar preços/cupons",
        prioridade: 7,
      });
    }
  }

  // ─── 5. Cupom de alta perda de receita ─────
  {
    const v30 = vendas90.filter((v) => new Date(v.data_venda) >= desde30 && v.cupom_codigo);
    const perdaPorCupom = new Map<string, { usos: number; perda: number }>();
    for (const v of v30) {
      const desconto = Math.max(0, (Number(v.valor_sem_desconto) || 0) - Number(v.valor));
      if (desconto > 0 && v.cupom_codigo) {
        const cur = perdaPorCupom.get(v.cupom_codigo) ?? { usos: 0, perda: 0 };
        cur.usos++;
        cur.perda += desconto;
        perdaPorCupom.set(v.cupom_codigo, cur);
      }
    }
    if (perdaPorCupom.size > 0) {
      const arr = Array.from(perdaPorCupom.entries()).sort((a, b) => b[1].perda - a[1].perda);
      const [topCod, topData] = arr[0];
      if (topData.perda > 100) {
        out.push({
          id: `cupom-${topCod}`,
          severidade: "info",
          icone: "Tag",
          titulo: `Cupom "${topCod}" gerou ${fmtBRL(topData.perda)} de desconto em 30 dias`,
          descricao: `${topData.usos} usos. Valide se o ROI compensa: clientes desse cupom voltam fora de promoção?`,
          destaque: `${topData.usos} usos`,
          acao_sugerida: "Auditar campanha",
          prioridade: 5,
        });
      }
    }
  }

  // ─── 6. Cliente VIP em risco (top LTV sem comprar há 30+ dias) ─────
  {
    const porCpf = new Map<string, { fat: number; ultimo: Date }>();
    for (const v of vendas90) {
      if (!v.cpf) continue;
      const cur = porCpf.get(v.cpf) ?? { fat: 0, ultimo: new Date(0) };
      cur.fat += Number(v.valor);
      const d = new Date(v.data_venda);
      if (d > cur.ultimo) cur.ultimo = d;
      porCpf.set(v.cpf, cur);
    }
    const arr = Array.from(porCpf.entries())
      .sort((a, b) => b[1].fat - a[1].fat)
      .slice(0, 20);
    const emRisco = arr.filter(([, d]) => {
      const dias = (ate.getTime() - d.ultimo.getTime()) / (24 * 60 * 60 * 1000);
      return dias >= 30;
    });
    if (emRisco.length >= 3) {
      const ltvSomado = round2(emRisco.reduce((s, [, d]) => s + d.fat, 0));
      out.push({
        id: "vip-risco",
        severidade: "danger",
        icone: "Crown",
        titulo: `${emRisco.length} clientes VIP sem comprar há 30+ dias`,
        descricao: `Esses clientes geraram ${fmtBRL(ltvSomado)} em 90 dias. Win-back com cupom personalizado pode resgatar boa parte.`,
        destaque: `${fmtBRL(ltvSomado)} em risco`,
        acao_sugerida: "Disparar win-back",
        prioridade: 9,
      });
    }
  }

  // ─── 7. Concentração de vendas (3 horas que somam >50%) ─────
  {
    const v30 = vendas90.filter((v) => new Date(v.data_venda) >= desde30);
    if (v30.length > 50) {
      const porHora = new Array(24).fill(0);
      let total = 0;
      for (const v of v30) {
        const d = new Date(v.data_venda);
        const vv = Number(v.valor);
        porHora[d.getHours()] += vv;
        total += vv;
      }
      if (total > 0) {
        const ordenadas = porHora.map((val, h) => ({ h, val })).sort((a, b) => b.val - a.val).slice(0, 3);
        const soma = ordenadas.reduce((s, x) => s + x.val, 0);
        const pct = (soma / total) * 100;
        if (pct >= 50) {
          const horas = ordenadas.map((x) => `${String(x.h).padStart(2, "0")}h`).sort();
          out.push({
            id: "concentracao",
            severidade: "info",
            icone: "Clock",
            titulo: `${pct.toFixed(0)}% do faturamento concentra em 3 horas (${horas.join(", ")})`,
            descricao: `Forte concentração. Risco operacional se houver falha de equipamento nesses horários. Considere distribuir promoções pra balancear.`,
            destaque: horas.join(" · "),
            prioridade: 4,
          });
        }
      }
    }
  }

  // ─── 8. Novos clientes em ritmo bom (≥10% das vendas são de primeira compra) ─────
  {
    const v30 = vendas90.filter((v) => new Date(v.data_venda) >= desde30 && v.cpf);
    if (v30.length > 30) {
      // CPFs cuja primeira venda histórica caiu nos 30d
      const primeiraPorCpf = new Map<string, Date>();
      for (const v of vendas90) {
        if (!v.cpf) continue;
        const d = new Date(v.data_venda);
        const cur = primeiraPorCpf.get(v.cpf);
        if (!cur || d < cur) primeiraPorCpf.set(v.cpf, d);
      }
      const novosNoMes = new Set<string>();
      for (const v of v30) {
        if (!v.cpf) continue;
        const pri = primeiraPorCpf.get(v.cpf);
        if (pri && pri >= desde30) novosNoMes.add(v.cpf);
      }
      const cpfsTotal = new Set(v30.map((v) => v.cpf).filter(Boolean) as string[]);
      const pctNovos = (novosNoMes.size / cpfsTotal.size) * 100;
      if (pctNovos >= 20) {
        out.push({
          id: "novos-fortes",
          severidade: "success",
          icone: "Users",
          titulo: `${pctNovos.toFixed(0)}% dos clientes do mês são novos (${novosNoMes.size} pessoas)`,
          descricao: `Aquisição forte. Vale ativar onboarding (cupom 2ª lavagem) pra converter em recorrentes.`,
          destaque: `${novosNoMes.size} novos`,
          acao_sugerida: "Criar campanha onboarding",
          prioridade: 7,
        });
      } else if (pctNovos < 5 && cpfsTotal.size > 30) {
        out.push({
          id: "novos-fracos",
          severidade: "warn",
          icone: "Users",
          titulo: `Só ${pctNovos.toFixed(1)}% dos clientes são novos — aquisição em queda`,
          descricao: `Você está se sustentando em base recorrente. Sem aquisição contínua, qualquer churn vira queda direta de receita.`,
          destaque: `${novosNoMes.size} novos`,
          acao_sugerida: "Plano de mídia local",
          prioridade: 8,
        });
      }
    }
  }

  // ─── 9. Mix lavagem × secagem desequilibrado ─────
  {
    const v30 = vendas90.filter((v) => new Date(v.data_venda) >= desde30);
    let fatLav = 0, fatSec = 0;
    for (const v of v30) {
      const val = Number(v.valor);
      if (v.tipo_servico === "lavagem") fatLav += val;
      else if (v.tipo_servico === "secagem") fatSec += val;
    }
    const tot = fatLav + fatSec;
    if (tot > 0) {
      const pctLav = (fatLav / tot) * 100;
      if (pctLav >= 70) {
        out.push({
          id: "mix-lav-alto",
          severidade: "info",
          icone: "Wallet",
          titulo: `Lavagem domina o mix (${pctLav.toFixed(0)}%) — secagem subutilizada`,
          descricao: `Clientes lavam mas não secam aqui (talvez levem pra casa). Cupom combinado lava+seca pode aumentar ticket médio e ocupação.`,
          destaque: `${pctLav.toFixed(0)}% / ${(100 - pctLav).toFixed(0)}%`,
          acao_sugerida: "Combo lava+seca",
          prioridade: 6,
        });
      } else if (pctLav <= 35) {
        out.push({
          id: "mix-sec-alto",
          severidade: "info",
          icone: "Wallet",
          titulo: `Secagem domina o mix (${(100 - pctLav).toFixed(0)}%) — lavadoras subutilizadas`,
          descricao: `Clientes só passam pra secar. Avalie por que a lavagem não converte: preço? Concorrência? Posicionamento.`,
          destaque: `${(100 - pctLav).toFixed(0)}% sec`,
          acao_sugerida: "Diagnóstico de lavadoras",
          prioridade: 6,
        });
      }
    }
  }

  // ─── 10. Atraso de dados (última venda há +7 dias) ─────
  {
    const diasAtras = (Date.now() - ate.getTime()) / (24 * 60 * 60 * 1000);
    if (diasAtras > 7) {
      out.push({
        id: "dados-atrasados",
        severidade: "warn",
        icone: "AlertTriangle",
        titulo: `Última venda foi há ${Math.floor(diasAtras)} dias — base desatualizada`,
        descricao: `Os insights e KPIs estão usando dados antigos. Importe a planilha mais recente em /performance pra garantir decisões em tempo real.`,
        acao_sugerida: "Importar planilha",
        prioridade: 10,
      });
    }
  }

  // Ordenar por prioridade desc
  return out.sort((a, b) => b.prioridade - a.prioridade);
}
