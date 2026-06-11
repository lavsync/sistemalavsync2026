// LavSync · XÔ CLUB · Regras de níveis
// 0-299    Bronze
// 300-799  Prata    · +5%  campanhas
// 800-1999 Ouro     · +10% campanhas
// 2000+    Diamante · +20% campanhas

import { Award, Crown, Gem, Medal } from "lucide-react";

export type NivelXoClub = "bronze" | "prata" | "ouro" | "diamante";

export type RegraNivelXC = {
  key: NivelXoClub;
  label: string;
  icon: typeof Award;
  cor: string;
  xcMin: number;
  xcMax: number | null;
  multiplicadorCampanha: number;
  beneficios: string[];
};

export const NIVEIS_XC: RegraNivelXC[] = [
  {
    key: "bronze", label: "Bronze", icon: Medal, cor: "warning",
    xcMin: 0, xcMax: 299, multiplicadorCampanha: 1.00,
    beneficios: ["Participa do programa", "Acumula 1 XC = R$ 1"],
  },
  {
    key: "prata", label: "Prata", icon: Award, cor: "muted-foreground",
    xcMin: 300, xcMax: 799, multiplicadorCampanha: 1.05,
    beneficios: ["+5% XC em campanhas especiais"],
  },
  {
    key: "ouro", label: "Ouro", icon: Crown, cor: "warning",
    xcMin: 800, xcMax: 1999, multiplicadorCampanha: 1.10,
    beneficios: ["+10% XC em campanhas", "Promoções exclusivas"],
  },
  {
    key: "diamante", label: "Diamante", icon: Gem, cor: "brand-cyan",
    xcMin: 2000, xcMax: null, multiplicadorCampanha: 1.20,
    beneficios: [
      "+20% XC em campanhas",
      "Benefícios exclusivos",
      "Ofertas antecipadas",
      "Cupons especiais",
    ],
  },
];

export function classificarXC(totalGanho: number): RegraNivelXC {
  for (let i = NIVEIS_XC.length - 1; i >= 0; i--) {
    if (totalGanho >= NIVEIS_XC[i].xcMin) return NIVEIS_XC[i];
  }
  return NIVEIS_XC[0];
}

export function proximoNivelXC(totalGanho: number): { proximo: RegraNivelXC | null; faltam: number } {
  for (const n of NIVEIS_XC) {
    if (totalGanho < n.xcMin) {
      return { proximo: n, faltam: n.xcMin - totalGanho };
    }
  }
  return { proximo: null, faltam: 0 };
}

export function regraNivel(nivel: NivelXoClub): RegraNivelXC {
  return NIVEIS_XC.find((n) => n.key === nivel) ?? NIVEIS_XC[0];
}

export function corDoNivelXC(nivel: NivelXoClub): string {
  return regraNivel(nivel).cor;
}

export function labelDoNivelXC(nivel: NivelXoClub): string {
  return regraNivel(nivel).label;
}

export function iconDoNivelXC(nivel: NivelXoClub): typeof Award {
  return regraNivel(nivel).icon;
}

/** 1 BRL = 1 XC (round). Multiplicador opcional. */
export function brlParaXC(brl: number, multiplicador: number = 1, conversao: number = 1): number {
  return Math.round(brl * conversao * multiplicador);
}
