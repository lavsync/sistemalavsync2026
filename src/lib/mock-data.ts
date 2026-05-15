// Dados mockados realistas baseados na operação Xô Varal Buritis
// Para serem trocados por chamadas reais ao backend posteriormente.

export const MOCK_REVENUE_TIMESERIES = [
  { day: "01", value: 142, projected: 180 },
  { day: "02", value: 168, projected: 180 },
  { day: "03", value: 121, projected: 180 },
  { day: "04", value: 245, projected: 200 },
  { day: "05", value: 189, projected: 200 },
  { day: "06", value: 207, projected: 210 },
  { day: "07", value: 312, projected: 250 },
  { day: "08", value: 198, projected: 220 },
  { day: "09", value: 156, projected: 220 },
  { day: "10", value: 134, projected: 200 },
  { day: "11", value: 178, projected: 200 },
  { day: "12", value: 245, projected: 230 },
  { day: "13", value: 289, projected: 240 },
  { day: "14", value: 142, projected: 200 },
];

export const MOCK_HOURLY_OCCUPATION = [
  { hour: "06h", value: 8 },
  { hour: "08h", value: 22 },
  { hour: "10h", value: 41 },
  { hour: "12h", value: 38 },
  { hour: "14h", value: 32 },
  { hour: "16h", value: 51 },
  { hour: "18h", value: 78 },
  { hour: "20h", value: 92 },
  { hour: "22h", value: 64 },
  { hour: "00h", value: 28 },
];

export const MOCK_REVENUE_SPLIT = [
  { name: "Lavagem 8kg", value: 38, color: "var(--brand-cyan)" },
  { name: "Lavagem 14kg", value: 27, color: "var(--brand-blue)" },
  { name: "Secagem 22kg", value: 22, color: "var(--brand-purple)" },
  { name: "Premium", value: 13, color: "var(--brand-violet)" },
];

// Performance — last 30 days revenue with projection vs realized
export const MOCK_PERFORMANCE_30D = Array.from({ length: 30 }).map((_, i) => {
  const d = i + 1;
  const base = 160 + Math.sin(i / 3) * 60 + (i / 30) * 80;
  const noise = Math.sin(i * 1.7) * 30;
  const realizado = Math.round(base + noise + (i % 7 === 6 ? 90 : 0));
  const projetado = Math.round(180 + (i / 30) * 90);
  return { day: String(d).padStart(2, "0"), realizado, projetado };
});

// Performance — month over month (last 12)
export const MOCK_PERFORMANCE_MOM = [
  { mes: "Jun/25", receita: 4280, meta: 4500 },
  { mes: "Jul/25", receita: 4612, meta: 4500 },
  { mes: "Ago/25", receita: 4480, meta: 4800 },
  { mes: "Set/25", receita: 4910, meta: 4800 },
  { mes: "Out/25", receita: 5120, meta: 5000 },
  { mes: "Nov/25", receita: 5384, meta: 5200 },
  { mes: "Dez/25", receita: 6210, meta: 5500 },
  { mes: "Jan/26", receita: 5840, meta: 5500 },
  { mes: "Fev/26", receita: 5260, meta: 5400 },
  { mes: "Mar/26", receita: 5780, meta: 5500 },
  { mes: "Abr/26", receita: 6120, meta: 5800 },
  { mes: "Mai/26", receita: 4870, meta: 6000 },
];

// Performance — YoY comparison (current year vs previous)
export const MOCK_PERFORMANCE_YOY = [
  { mes: "Jan", atual: 5840, anterior: 4120 },
  { mes: "Fev", atual: 5260, anterior: 3980 },
  { mes: "Mar", atual: 5780, anterior: 4250 },
  { mes: "Abr", atual: 6120, anterior: 4480 },
  { mes: "Mai", atual: 4870, anterior: 4310 },
];

// Performance — occupation per weekday (avg hourly across day)
export const MOCK_PERFORMANCE_WEEKDAY = [
  { dia: "Seg", ocupacao: 42, ticket: 22.4 },
  { dia: "Ter", ocupacao: 38, ticket: 21.8 },
  { dia: "Qua", ocupacao: 47, ticket: 23.1 },
  { dia: "Qui", ocupacao: 51, ticket: 23.6 },
  { dia: "Sex", ocupacao: 64, ticket: 24.8 },
  { dia: "Sáb", ocupacao: 78, ticket: 26.2 },
  { dia: "Dom", ocupacao: 71, ticket: 25.4 },
];

// Performance — utilization heatmap (weekday x hour)
export const MOCK_PERFORMANCE_HEATMAP = (() => {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
  const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22] as const;
  return days.flatMap((dia, di) =>
    hours.map((h, hi) => {
      const peak = Math.exp(-Math.pow(hi - 7, 2) / 6);
      const weekendBoost = di >= 5 ? 1.25 : 1;
      const value = Math.round(peak * 95 * weekendBoost + (di % 2) * 6);
      return { dia, hora: `${h}h`, value: Math.min(99, value) };
    })
  );
})();

// Clientes — segmentação RFM
export const MOCK_CLIENT_RFM = [
  { segment: "Campeões", count: 87, color: "var(--brand-cyan)", desc: "Frequentes + alto ticket" },
  { segment: "Leais", count: 142, color: "var(--brand-blue)", desc: "Recorrência consistente" },
  { segment: "Promissores", count: 64, color: "var(--brand-purple)", desc: "Novos com sinal positivo" },
  { segment: "Em risco", count: 38, color: "var(--warning)", desc: "Frequência caindo" },
  { segment: "Dormentes", count: 107, color: "var(--danger)", desc: "+45 dias sem voltar" },
];

// Clientes — novos vs recorrentes (12 semanas)
export const MOCK_CLIENT_GROWTH = Array.from({ length: 12 }).map((_, i) => ({
  semana: `S${i + 1}`,
  novos: Math.round(8 + Math.sin(i / 2) * 4 + (i / 12) * 5),
  recorrentes: Math.round(28 + Math.sin(i / 3) * 8 + (i / 12) * 12),
}));

// Clientes — top clientes (LTV ranking)
export const MOCK_TOP_CLIENTS = [
  { nome: "Maria L.", phone: "31 9****-2287", visitas: 38, ltv: 1840, lastVisit: "hoje", tag: "Campeão" },
  { nome: "João R.", phone: "31 9****-1162", visitas: 32, ltv: 1612, lastVisit: "2d", tag: "Campeão" },
  { nome: "Ana P.", phone: "31 9****-5544", visitas: 27, ltv: 1284, lastVisit: "1d", tag: "Leal" },
  { nome: "Carlos V.", phone: "31 9****-7720", visitas: 24, ltv: 1108, lastVisit: "5d", tag: "Leal" },
  { nome: "Beatriz S.", phone: "31 9****-3398", visitas: 18, ltv: 742, lastVisit: "4d", tag: "Leal" },
  { nome: "Pedro N.", phone: "31 9****-9921", visitas: 12, ltv: 412, lastVisit: "12d", tag: "Em risco" },
];

// Clientes — curva de retenção (cohort)
export const MOCK_CLIENT_RETENTION = [
  { mes: "M0", retencao: 100 },
  { mes: "M1", retencao: 64 },
  { mes: "M2", retencao: 48 },
  { mes: "M3", retencao: 41 },
  { mes: "M4", retencao: 36 },
  { mes: "M5", retencao: 33 },
  { mes: "M6", retencao: 31 },
];

// Resultados — DRE consolidada (mês corrente)
export const MOCK_DRE = {
  receitaBruta: 4870,
  deducoes: -390, // impostos, taxa cartão
  receitaLiquida: 4480,
  custoVariavel: -1294, // água, energia, produtos
  margemBruta: 3186,
  despesasFixas: -2480, // aluguel, internet, manutenção
  ebitda: 706,
  depreciacao: -180,
  resultadoLiquido: 526,
};

// Resultados — Receita vs Custos vs Lucro (últimos 12 meses)
export const MOCK_RESULT_TIMESERIES = [
  { mes: "Jun/25", receita: 4280, custos: 3520, lucro: 760 },
  { mes: "Jul/25", receita: 4612, custos: 3680, lucro: 932 },
  { mes: "Ago/25", receita: 4480, custos: 3720, lucro: 760 },
  { mes: "Set/25", receita: 4910, custos: 3840, lucro: 1070 },
  { mes: "Out/25", receita: 5120, custos: 3920, lucro: 1200 },
  { mes: "Nov/25", receita: 5384, custos: 4010, lucro: 1374 },
  { mes: "Dez/25", receita: 6210, custos: 4280, lucro: 1930 },
  { mes: "Jan/26", receita: 5840, custos: 4180, lucro: 1660 },
  { mes: "Fev/26", receita: 5260, custos: 4080, lucro: 1180 },
  { mes: "Mar/26", receita: 5780, custos: 4140, lucro: 1640 },
  { mes: "Abr/26", receita: 6120, custos: 4220, lucro: 1900 },
  { mes: "Mai/26", receita: 4870, custos: 4344, lucro: 526 },
];

// Resultados — composição de custos
export const MOCK_COST_BREAKDOWN = [
  { categoria: "Aluguel", valor: 1800, color: "var(--brand-purple)" },
  { categoria: "Energia elétrica", valor: 720, color: "var(--brand-cyan)" },
  { categoria: "Água + esgoto", valor: 380, color: "var(--brand-blue)" },
  { categoria: "Produtos químicos", valor: 194, color: "var(--brand-violet)" },
  { categoria: "Manutenção", valor: 320, color: "var(--warning)" },
  { categoria: "Internet + sistemas", valor: 220, color: "var(--success)" },
  { categoria: "Taxa cartão", valor: 290, color: "var(--danger)" },
  { categoria: "Outros", valor: 420, color: "var(--muted-foreground)" },
];

// Métricas — KPIs operacionais (gauges + variação)
export const MOCK_METRICS = [
  { key: "ticketMedio", label: "Ticket médio", value: 25.81, unit: "R$", min: 15, max: 40, target: 24, trend: 3.2, tone: "cyan" },
  { key: "freqMedia", label: "Frequência média", value: 2.3, unit: "x/mês", min: 1, max: 4, target: 2.5, trend: 8.5, tone: "purple" },
  { key: "ocupacao", label: "Ocupação média", value: 51, unit: "%", min: 0, max: 100, target: 60, trend: -4.2, tone: "warning" },
  { key: "cac", label: "CAC", value: 14.3, unit: "R$", min: 0, max: 50, target: 18, trend: -12, tone: "success" },
  { key: "ltv", label: "LTV médio", value: 268, unit: "R$", min: 100, max: 500, target: 250, trend: 17.8, tone: "cyan" },
  { key: "nps", label: "NPS", value: 64, unit: "", min: -100, max: 100, target: 60, trend: 6, tone: "success" },
  { key: "churn", label: "Churn 30d", value: 8.2, unit: "%", min: 0, max: 30, target: 10, trend: -1.4, tone: "success" },
  { key: "cicloDia", label: "Ciclos / dia", value: 38, unit: "", min: 0, max: 80, target: 45, trend: -7.1, tone: "warning" },
];

// Métricas — KPIs históricos (12 meses) — só os principais
export const MOCK_METRICS_HISTORY = Array.from({ length: 12 }).map((_, i) => ({
  mes: ["Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai"][i],
  ticket: 21 + Math.sin(i / 2) * 1.4 + (i / 12) * 4,
  freq: 1.9 + Math.sin(i / 3) * 0.2 + (i / 12) * 0.5,
  ocupacao: 38 + Math.sin(i / 2.5) * 8 + (i / 12) * 14,
  nps: 48 + Math.sin(i / 2) * 6 + (i / 12) * 14,
}));

// Métricas — custos unitários (R$ por ciclo)
export const MOCK_UNIT_COSTS = [
  { categoria: "Energia", valor: 1.84, target: 1.6 },
  { categoria: "Água", valor: 0.42, target: 0.5 },
  { categoria: "Produto", valor: 0.38, target: 0.4 },
  { categoria: "Cartão", valor: 0.62, target: 0.7 },
  { categoria: "Manutenção", valor: 0.84, target: 0.8 },
];

// Performance — per-machine revenue (last 30d)
export const MOCK_PERFORMANCE_BY_MACHINE = [
  { id: "SC-02", receita: 1840, ciclos: 168, margem: 64 },
  { id: "SC-01", receita: 1612, ciclos: 152, margem: 61 },
  { id: "LV-01", receita: 1284, ciclos: 198, margem: 52 },
  { id: "LV-02", receita: 1108, ciclos: 174, margem: 48 },
  { id: "LV-03", receita: 742, ciclos: 96, margem: 38 },
  { id: "LV-04", receita: 412, ciclos: 54, margem: 22 },
];

export const MOCK_MACHINES = [
  { id: "LV-01", type: "Lavadora 8kg", status: "running", utilization: 87 },
  { id: "LV-02", type: "Lavadora 8kg", status: "running", utilization: 64 },
  { id: "LV-03", type: "Lavadora 14kg", status: "idle", utilization: 41 },
  { id: "LV-04", type: "Lavadora 14kg", status: "warning", utilization: 22 },
  { id: "SC-01", type: "Secadora 22kg", status: "running", utilization: 78 },
  { id: "SC-02", type: "Secadora 22kg", status: "running", utilization: 81 },
];
