// LavSync · Helpers de seleção multi-unidade
// URL: ?unidade=todas | ID | ID1,ID2,ID3
// Retorna sempre um Set<string> e helper booleano "todas".

export type Unidade = { id: string; nome: string };

export type SelecaoUnidades = {
  ids: string[];           // array vazio = todas
  todas: boolean;
  rotulo: string;          // "Todas unidades" · "Buritis" · "Buritis + Castelo" · "3 unidades"
};

export function parseSelecaoUnidades(
  param: string | undefined | null,
  unidadesDisponiveis: Unidade[],
): SelecaoUnidades {
  // Sem param ou "todas" → todas
  if (!param || param === "todas" || param.trim() === "") {
    return {
      ids: unidadesDisponiveis.map((u) => u.id),
      todas: true,
      rotulo: "Todas unidades",
    };
  }
  const idsRequisitados = param.split(",").map((s) => s.trim()).filter(Boolean);
  const validas = idsRequisitados.filter((id) => unidadesDisponiveis.some((u) => u.id === id));
  if (validas.length === 0) {
    return {
      ids: unidadesDisponiveis.map((u) => u.id),
      todas: true,
      rotulo: "Todas unidades",
    };
  }
  if (validas.length === unidadesDisponiveis.length) {
    return { ids: validas, todas: true, rotulo: "Todas unidades" };
  }
  const nomes = validas
    .map((id) => unidadesDisponiveis.find((u) => u.id === id)?.nome)
    .filter(Boolean) as string[];
  const rotulo = nomes.length <= 2 ? nomes.join(" + ") : `${nomes.length} unidades`;
  return { ids: validas, todas: false, rotulo };
}

/** Serializa pra usar em URL — "todas" se for tudo, ID único se 1, comma-separated se múltiplas. */
export function serializarSelecao(ids: string[], totalDisponiveis: number): string {
  if (ids.length === 0 || ids.length === totalDisponiveis) return "todas";
  if (ids.length === 1) return ids[0];
  return ids.join(",");
}
