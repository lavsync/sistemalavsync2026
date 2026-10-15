// LavSync · Financeiro · DRE em PDF (relatório para sócios)
// Renderizado no servidor com @react-pdf/renderer. A4 paisagem.
import "server-only";
import * as React from "react";
import { Document, Page, View, Text, Image, StyleSheet, Svg, Rect, Line, renderToBuffer } from "@react-pdf/renderer";
import { variacao, type DREPeriodoResultado, type LinhaDRE } from "../dre-periodo";
import type { Destaque } from "../dre-analise";
import { LOGO_BRANCO } from "./logos";

// Paleta do brandbook LavSync (modo claro, contraste AA)
const C = {
  navy: "#01385B", ocean: "#065A76", cyan: "#0B7285", cyanVivo: "#19C7CB",
  texto: "#0F172A", muted: "#475569", borda: "#E2E8F0", fundo: "#F8FAFC",
  verde: "#15803D", vermelho: "#DC2626", ambar: "#B45309",
};

// Helvetica (WinAnsi) não tem o sinal de menos tipográfico
const t = (s: string) => s.replace(/−/g, "-").replace(/→/g, "para");
const brl = (n: number, casas = 2) =>
  `${n < 0 ? "-" : ""}R$ ${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
const num = (n: number) => (Math.abs(n) < 0.005 ? "-" : n < 0
  ? `(${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
  : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pctTxt = (n: number | null, casas = 1) => (n == null ? "-" : `${n >= 0 ? "+" : "-"}${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);

const s = StyleSheet.create({
  page: { paddingBottom: 38, fontFamily: "Helvetica", fontSize: 8, color: C.texto, backgroundColor: "#FFFFFF" },
  header: { backgroundColor: C.navy, paddingHorizontal: 28, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: 118, height: 22.5 },
  hTitulo: { color: "#FFFFFF", fontSize: 15, fontFamily: "Helvetica-Bold" },
  hSub: { color: "#BFE9EC", fontSize: 9, marginTop: 3 },
  hDir: { alignItems: "flex-end" },
  hMeta: { color: "#BFE9EC", fontSize: 7.5, marginTop: 2 },
  faixa: { height: 3, backgroundColor: C.cyanVivo },
  corpo: { paddingHorizontal: 28, paddingTop: 14 },
  kpis: { flexDirection: "row", gap: 8, marginBottom: 12 },
  kpi: { flex: 1, borderWidth: 1, borderColor: C.borda, borderRadius: 6, padding: 9, backgroundColor: C.fundo },
  kpiLabel: { fontSize: 6.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  kpiValor: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 3 },
  kpiVar: { fontSize: 7, marginTop: 2 },
  secTitulo: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ocean, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  tabela: { borderWidth: 1, borderColor: C.borda, borderRadius: 4 },
  thRow: { flexDirection: "row", backgroundColor: C.ocean },
  th: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 7, paddingVertical: 4, paddingHorizontal: 4, textAlign: "right" },
  row: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: C.borda },
  td: { fontSize: 7.2, paddingVertical: 2.6, paddingHorizontal: 4, textAlign: "right" },
  desc: { flex: 2.6, textAlign: "left" },
  col: { flex: 1 },
  grupoRow: { flexDirection: "row", backgroundColor: "#EEF6F8", borderTopWidth: 0.5, borderTopColor: C.borda },
  grupoTxt: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.ocean, paddingVertical: 2.5, paddingHorizontal: 4, textTransform: "uppercase", letterSpacing: 0.6 },
  duas: { flexDirection: "row", gap: 12, marginTop: 12 },
  caixa: { flex: 1, borderWidth: 1, borderColor: C.borda, borderRadius: 6, padding: 10 },
  bullet: { flexDirection: "row", marginBottom: 4 },
  ponto: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2.5, marginRight: 6 },
  bulletTxt: { flex: 1, fontSize: 7.6, lineHeight: 1.35 },
  nota: { fontSize: 6.5, color: C.muted, marginTop: 6, lineHeight: 1.35 },
  rodape: { position: "absolute", bottom: 14, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 6.5, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.borda, paddingTop: 5 },
});

const GRUPOS: Partial<Record<LinhaDRE["grupo"], string>> = {
  csp: "Custo do serviço prestado", royalties: "Despesas operacionais", fixo: "Custos fixos", variavel: "Custos variáveis",
};

/** Projetado da franqueadora × real nos meses fechados do período (opcional). */
export type ProjetadoPdf = {
  nome: string;
  meses: number;             // meses fechados do período com projeção e real
  fat_proj: number; fat_real: number;
  res_proj: number; res_real: number;
  estimado: boolean;         // parte do custo real ainda estimada
};

export type DREPdfInput = {
  atual: DREPeriodoResultado;
  anterior: DREPeriodoResultado | null;
  tendencia: Array<{ rotulo: string; faturamento: number; resultado: number; tem: boolean }>;
  destaques: Destaque[];
  escopo: string;            // "Consolidado · Buritis, Castelo, Cabral" | "Unidade Cabral"
  geradoPor: string;
  geradoEm: string;          // já formatado (BR)
  projetado?: ProjetadoPdf | null;
};

function BlocoProjetado({ p }: { p: ProjetadoPdf }) {
  const pct = p.fat_proj > 0 ? (p.fat_real / p.fat_proj) * 100 : null;
  const pctFmt = pct == null ? "-" : `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
  const gapRes = p.res_real - p.res_proj;
  return (
    <View style={[s.caixa, { marginTop: 12 }]} wrap={false}>
      <Text style={s.secTitulo}>Projetado pela franqueadora × real</Text>
      <View style={s.kpis}>
        <Kpi label="Faturamento real" valor={brl(p.fat_real)} variacaoTxt={`projetado ${brl(p.fat_proj)}`} />
        <Kpi label="% do projetado" valor={pctFmt} cor={pct == null ? undefined : pct >= 95 ? C.verde : pct >= 70 ? C.ambar : C.vermelho} />
        <Kpi label="Resultado real" valor={brl(p.res_real)} cor={p.res_real >= 0 ? C.verde : C.vermelho} variacaoTxt={`projetado ${brl(p.res_proj)}`} />
        <Kpi label="Diferença no resultado" valor={brl(gapRes)} cor={gapRes >= 0 ? C.verde : C.vermelho} />
      </View>
      <Text style={s.nota}>
        {t(`${p.nome}. Compara só os ${p.meses} ${p.meses === 1 ? "mês fechado" : "meses fechados"} do período (o mês corrente fica de fora).`)}
        {p.estimado ? " Parte do custo real ainda é estimada pelo % de referência." : ""}
      </Text>
    </View>
  );
}

function Kpi({ label, valor, variacaoTxt, cor }: { label: string; valor: string; variacaoTxt?: string; cor?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValor, cor ? { color: cor } : {}]}>{valor}</Text>
      {variacaoTxt ? <Text style={[s.kpiVar, { color: C.muted }]}>{variacaoTxt}</Text> : null}
    </View>
  );
}

function Grafico({ dados }: { dados: DREPdfInput["tendencia"] }) {
  const W = 360, base = 92, topo = 8, abaixo = 24, H = base + abaixo;
  const max = Math.max(1, ...dados.map((d) => Math.max(d.faturamento, Math.abs(d.resultado))));
  const escala = (base - topo) / max;
  const largura = W / Math.max(1, dados.length);
  const bw = Math.min(14, largura / 3);
  return (
    <View>
      <Svg width={W} height={H}>
        <Line x1={0} y1={base} x2={W} y2={base} strokeWidth={0.6} stroke={C.borda} />
        {dados.map((d, i) => {
          const x = i * largura + largura / 2;
          const hf = d.faturamento * escala;
          const hr = Math.abs(d.resultado) * escala;
          return (
            <React.Fragment key={d.rotulo}>
              <Rect x={x - bw - 1} y={base - hf} width={bw} height={hf} fill={d.tem ? C.ocean : C.borda} />
              <Rect x={x + 1} y={d.resultado >= 0 ? base - hr : base} width={bw} height={d.resultado >= 0 ? hr : Math.min(hr, abaixo)}
                fill={d.resultado >= 0 ? C.verde : C.vermelho} />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", width: W, marginTop: 2 }}>
        {dados.map((d) => (
          <Text key={d.rotulo} style={{ width: largura, textAlign: "center", fontSize: 6, color: C.muted }}>{d.rotulo}</Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
        {[["Faturamento", C.ocean], ["Resultado (lucro)", C.verde], ["Resultado (prejuízo)", C.vermelho]].map(([rot, cor]) => (
          <View key={rot} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <View style={{ width: 6, height: 6, backgroundColor: cor }} />
            <Text style={{ fontSize: 6.5, color: C.muted }}>{rot}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TabelaDRE({ atual, anterior }: { atual: DREPeriodoResultado; anterior: DREPeriodoResultado | null }) {
  const multi = atual.colunas.length > 1;
  const fat = atual.totais.faturamento;
  const cabecalho = [...(multi ? atual.colunas : []), multi ? "Total" : "Valor", "% fat.", "Anterior", "Var."];
  // Cabeçalho de grupo antes da 1ª linha de cada bloco (csp, fixos, variáveis…)
  const abreGrupo = atual.linhas.map((l, i) => {
    const g = GRUPOS[l.grupo];
    return g != null && (i === 0 || GRUPOS[atual.linhas[i - 1].grupo] !== g);
  });

  return (
    <View style={s.tabela}>
      <View style={s.thRow} fixed>
        <Text style={[s.th, s.desc]}>Demonstração do resultado</Text>
        {cabecalho.map((c) => <Text key={c} style={[s.th, s.col]}>{c}</Text>)}
      </View>
      {atual.linhas.map((l, i) => {
        const rotGrupo = GRUPOS[l.grupo] ?? null;
        const ant = anterior?.linhas.find((x) => x.chave === l.chave)?.total ?? null;
        // Custos (negativos) comparam pelo tamanho: custo que sobe aparece como +X% em vermelho
        const custo = ["csp", "fixo", "variavel", "royalties", "deducao"].includes(l.grupo) || l.chave === "desp";
        const v = ant == null ? null : custo ? variacao(Math.abs(l.total), Math.abs(ant)) : variacao(l.total, ant);
        const forte = l.destaque || l.grupo === "subtotal";
        const corRes = l.grupo === "resultado" ? (l.total >= 0 ? C.verde : C.vermelho) : undefined;
        const marca = l.origem === "estimado" || l.origem === "parcial" ? " *" : "";
        const corVar = v == null || Math.abs(v) < 0.05 ? C.muted : (custo ? (v > 0 ? C.vermelho : C.verde) : (v >= 0 ? C.verde : C.vermelho));
        return (
          <React.Fragment key={l.chave}>
            {abreGrupo[i] ? (
              <View style={s.grupoRow} wrap={false}><Text style={s.grupoTxt}>{rotGrupo}</Text></View>
            ) : null}
            <View style={[s.row, l.grupo === "resultado" ? { backgroundColor: "#F1F5F9", borderTopWidth: 1, borderTopColor: C.ocean } : {}]} wrap={false}>
              <Text style={[s.td, s.desc, forte ? { fontFamily: "Helvetica-Bold" } : { paddingLeft: rotGrupo ? 10 : 4 }]}>
                {t(l.descricao)}{marca}
              </Text>
              {multi && l.valores.map((x, i) => <Text key={i} style={[s.td, s.col]}>{num(x)}</Text>)}
              <Text style={[s.td, s.col, { fontFamily: "Helvetica-Bold" }, corRes ? { color: corRes } : {}]}>{num(l.total)}</Text>
              <Text style={[s.td, s.col, { color: C.muted }]}>{fat > 0 ? `${((l.total / fat) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%` : "-"}</Text>
              <Text style={[s.td, s.col, { color: C.muted }]}>{ant != null ? num(ant) : "-"}</Text>
              <Text style={[s.td, s.col, { color: corVar }]}>{pctTxt(v)}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function DREDocumento(p: DREPdfInput) {
  const { atual } = p;
  // Sem faturamento no período anterior não há comparativo honesto
  const anterior = p.anterior && p.anterior.meses_com_dados.length > 0 ? p.anterior : null;
  const T = atual.totais, A = anterior?.totais;
  const vf = A ? variacao(T.faturamento, A.faturamento) : null;
  const vr = A ? variacao(T.resultado, A.resultado) : null;
  const corTom = { positivo: C.verde, negativo: C.vermelho, neutro: C.cyan };

  return (
    <Document title={`DRE ${atual.titulo} - ${p.escopo}`} author="LavSync" creator="LavSync · Financeiro" subject="Demonstração do Resultado do Exercício">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header} fixed>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
            <Image src={LOGO_BRANCO} style={s.logo} />
            <Text style={[s.hTitulo, { marginTop: 8 }]}>Demonstração do Resultado (DRE)</Text>
            <Text style={s.hSub}>{atual.titulo} · {atual.intervalo} · {p.escopo}</Text>
          </View>
          <View style={s.hDir}>
            <Text style={s.hMeta}>Xô Varal Lavanderias</Text>
            <Text style={s.hMeta}>Gerado em {p.geradoEm}</Text>
            <Text style={s.hMeta}>por {p.geradoPor}</Text>
          </View>
        </View>
        <View style={s.faixa} fixed />

        <View style={s.corpo}>
          <View style={s.kpis}>
            <Kpi label="Faturamento bruto" valor={brl(T.faturamento)}
              variacaoTxt={A ? `${pctTxt(vf)} vs ${anterior!.titulo.toLowerCase()}` : undefined} />
            <Kpi label="Resultado líquido" valor={brl(T.resultado)} cor={T.resultado >= 0 ? C.verde : C.vermelho}
              variacaoTxt={A ? `${pctTxt(vr)} · antes ${brl(A.resultado)}` : undefined} />
            <Kpi label="Margem líquida" valor={`${T.margem.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`}
              cor={T.margem >= 0 ? C.texto : C.vermelho}
              variacaoTxt={A ? `${T.margem - A.margem >= 0 ? "+" : "-"}${Math.abs(T.margem - A.margem).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} p.p. vs anterior` : undefined} />
            <Kpi label="Despesas operacionais" valor={brl(T.despesas)}
              variacaoTxt={T.faturamento > 0 ? `${((T.despesas / T.faturamento) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do faturamento` : undefined} />
            <Kpi label="Retorno s/ investimento" valor={`${T.roi.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`}
              variacaoTxt="no período" />
          </View>

          <Text style={s.secTitulo}>Demonstrativo</Text>
          <TabelaDRE atual={atual} anterior={anterior} />
          <Text style={s.nota}>
            Valores em R$. Custos entre parênteses. * Linha estimada pelo % de referência do custo (sem pagamento lançado em todos os meses do período); as demais usam o valor efetivamente pago.
            Simples Nacional (Anexo III) calculado sobre a receita bruta dos 12 meses anteriores. Coluna &quot;Anterior&quot; = {anterior ? anterior.titulo.toLowerCase() : "sem dados"}.
          </Text>

          <View style={s.duas} wrap={false}>
            <View style={s.caixa}>
              <Text style={s.secTitulo}>Leitura do período</Text>
              {p.destaques.map((d, i) => (
                <View key={i} style={s.bullet}>
                  <View style={[s.ponto, { backgroundColor: corTom[d.tom] }]} />
                  <Text style={s.bulletTxt}>{t(d.texto)}</Text>
                </View>
              ))}
            </View>
            <View style={[s.caixa, { flexGrow: 0, flexShrink: 0, flexBasis: 384, width: 384 }]}>
              <Text style={s.secTitulo}>Evolução mensal (últimos {p.tendencia.length} meses)</Text>
              <Grafico dados={p.tendencia} />
            </View>
          </View>

          {p.projetado ? <BlocoProjetado p={p.projetado} /> : null}
        </View>

        <View style={s.rodape} fixed>
          <Text>LavSync · Documento gerencial para sócios. Não substitui as demonstrações contábeis oficiais.</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function gerarDREPdf(input: DREPdfInput): Promise<Buffer> {
  return renderToBuffer(<DREDocumento {...input} />);
}
