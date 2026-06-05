// LavSync · Cadastros (hub /cadastros) — server queries com contadores
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CadastroContadores = {
  clientes: number;
  fornecedores: number;
  despesas: number;
  categoriasFinanceiras: number;
  maquinas: number;
  planos: number;
  servicos: number;
  campanhas: number;
  parceiros: number;
  unidades: number;
  usuarios: number;
};

async function safeCount(supabase: Awaited<ReturnType<typeof createClient>>, table: string): Promise<number> {
  try {
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getContadoresCadastros(): Promise<CadastroContadores> {
  const supabase = await createClient();
  const [
    clientes, fornecedores, despesas, cats, maquinas, planos,
    servicos, campanhas, parceiros, unidades, usuarios,
  ] = await Promise.all([
    safeCount(supabase, "clientes"),
    safeCount(supabase, "fornecedores"),
    safeCount(supabase, "despesas"),
    safeCount(supabase, "categorias_financeiras"),
    safeCount(supabase, "maquinas"),
    safeCount(supabase, "planos"),
    safeCount(supabase, "servicos"),
    safeCount(supabase, "campanhas"),
    safeCount(supabase, "parceiros"),
    safeCount(supabase, "unidades"),
    safeCount(supabase, "usuarios"),
  ]);
  return {
    clientes, fornecedores, despesas, categoriasFinanceiras: cats, maquinas, planos,
    servicos, campanhas, parceiros, unidades, usuarios,
  };
}
