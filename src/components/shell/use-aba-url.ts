"use client";

// LavSync · Aba na URL (?aba=)
//
// Views com abas Radix leem a aba inicial da URL e gravam a troca nela. Assim o
// CLOCK abre a tela já na aba certa (/financeiro?aba=dre) e o link pode ser
// compartilhado. Os demais filtros da URL (unidade, mes, periodo...) são mantidos.
//
// A troca usa window.history.replaceState, que o App Router integra a
// useSearchParams/usePathname: a URL muda sem rolar a página e SEM refazer o
// render do servidor (trocar de aba não dispara de novo as consultas da página).
// Se a URL mudar por navegação (CLOCK chamando router.push na mesma rota com
// outra aba), a aba acompanha.
import * as React from "react";
import { useSearchParams } from "next/navigation";

export function useAbaUrl<T extends string>(
  validas: readonly T[],
  padrao: T,
  param: string = "aba",
): [T, (valor: string) => void] {
  const searchParams = useSearchParams();
  const daUrl = searchParams.get(param);
  const valida = (v: string | null): v is T => v !== null && (validas as readonly string[]).includes(v);

  const [aba, setAbaState] = React.useState<T>(valida(daUrl) ? daUrl : padrao);

  // URL mudou por fora (navegação do CLOCK, voltar do navegador): acompanha.
  // Ajuste durante o render, sem efeito (padrão do React para estado derivado).
  const [urlVista, setUrlVista] = React.useState(daUrl);
  if (daUrl !== urlVista) {
    setUrlVista(daUrl);
    if (valida(daUrl)) setAbaState(daUrl);
  }

  const setAba = React.useCallback((valor: string) => {
    if (!(validas as readonly string[]).includes(valor)) return;
    setAbaState(valor as T);
    const params = new URLSearchParams(window.location.search);
    if (params.get(param) === valor) return;
    params.set(param, valor);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    // validas é lista estática de cada view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  return [aba, setAba];
}
