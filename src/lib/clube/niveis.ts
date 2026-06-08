// LavSync · Clube de Vantagens · Regras de níveis
// Regras conforme briefing Daniel:
// 8-11   ciclos/mês → Bronze    → 5%  OFF mês seguinte
// 12-19  ciclos/mês → Prata     → 10% OFF mês seguinte
// 20-29  ciclos/mês → Ouro      → 15% OFF mês seguinte
// 30+    ciclos/mês → Diamante  → 20% OFF mês seguinte

export type NivelClube = "bronze" | "prata" | "ouro" | "diamante" | "nao_classificado";

export type RegraNivel = {
  key: NivelClube;
  label: string;
  emoji: string;
  ciclosMin: number;
  ciclosMax: number | null;     // null = sem teto
  descontoPct: number;
  cor: string;                  // CSS color token
};

export const NIVEIS: RegraNivel[] = [
  { key: "nao_classificado", label: "Sem classificação", emoji: "—", ciclosMin: 0,  ciclosMax: 7,    descontoPct: 0,  cor: "muted-foreground" },
  { key: "bronze",           label: "Bronze",            emoji: "🥉", ciclosMin: 8,  ciclosMax: 11,   descontoPct: 5,  cor: "warning" },
  { key: "prata",            label: "Prata",             emoji: "🥈", ciclosMin: 12, ciclosMax: 19,   descontoPct: 10, cor: "muted-foreground" },
  { key: "ouro",             label: "Ouro",              emoji: "🥇", ciclosMin: 20, ciclosMax: 29,   descontoPct: 15, cor: "warning" },
  { key: "diamante",         label: "Diamante",          emoji: "💎", ciclosMin: 30, ciclosMax: null, descontoPct: 20, cor: "brand-cyan" },
];

export function classificar(ciclos: number): RegraNivel {
  for (let i = NIVEIS.length - 1; i >= 0; i--) {
    const n = NIVEIS[i];
    if (ciclos >= n.ciclosMin) return n;
  }
  return NIVEIS[0];
}

export function proximoNivel(ciclos: number): { proximo: RegraNivel | null; faltam: number } {
  for (const n of NIVEIS) {
    if (n.key === "nao_classificado") continue;
    if (ciclos < n.ciclosMin) {
      return { proximo: n, faltam: n.ciclosMin - ciclos };
    }
  }
  return { proximo: null, faltam: 0 };
}

export function descontoDoNivel(nivel: NivelClube): number {
  return NIVEIS.find((n) => n.key === nivel)?.descontoPct ?? 0;
}

export function corDoNivel(nivel: NivelClube): string {
  return NIVEIS.find((n) => n.key === nivel)?.cor ?? "muted-foreground";
}

export function emojiDoNivel(nivel: NivelClube): string {
  return NIVEIS.find((n) => n.key === nivel)?.emoji ?? "—";
}

export function labelDoNivel(nivel: NivelClube): string {
  return NIVEIS.find((n) => n.key === nivel)?.label ?? nivel;
}

// 1 ciclo = 1 ponto (na hora). Pontos podem ser resgatados na store.
export function ciclosViramPontos(ciclos: number): number {
  return ciclos;
}

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function nomeMes(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return MESES_PT[date.getMonth()];
}

export function proximoMes(d: Date | string): Date {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}
