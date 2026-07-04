import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normaliza pra busca: minúsculas e sem acentos ("João" ≡ "joao"). */
export function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Busca de cliente por nome/CPF/telefone.
 * GOTCHA que este helper corrige: `cpf.includes(termo.replace(/\D/g,""))`
 * com termo SEM dígitos vira `includes("")` = true pra TODAS as linhas —
 * a lista parecia "não filtrar". Só compara dígitos se o termo TEM dígitos.
 */
export function buscaCliente(
  termo: string,
  campos: { nome?: string | null; cpf?: string | null; telefone?: string | null },
): boolean {
  const t = termo.trim();
  if (!t) return true;
  const tNorm = norm(t);
  const tDigitos = t.replace(/\D/g, "");
  if (campos.nome && norm(campos.nome).includes(tNorm)) return true;
  if (tDigitos.length >= 3) {
    if (campos.cpf && campos.cpf.replace(/\D/g, "").includes(tDigitos)) return true;
    if (campos.telefone && campos.telefone.replace(/\D/g, "").includes(tDigitos)) return true;
  }
  return false;
}
