// LavSync · CLOCK v2 · Registro · Catálogo completo (ordem FIXA)
//
// A ordem importa: o squad do cérebro gera os enums das ferramentas a
// partir destas listas e eles entram no prefixo cacheado do modelo.
// Acrescente sempre no FIM de cada módulo para não invalidar o cache.
import "server-only";
import type { DefAcao, DefConsulta } from "./tipos";
import { CONSULTAS_VENDAS } from "./vendas";
import { CONSULTAS_COMPARATIVO } from "./comparativo";
import { CONSULTAS_PERFORMANCE } from "./performance";
import { CONSULTAS_CLIENTES } from "./clientes";
import { CONSULTAS_FINANCEIRO, ACOES_FINANCEIRO } from "./financeiro";
import { CONSULTAS_CLUBE, ACOES_CLUBE } from "./clube";
import { CONSULTAS_MARKETING, ACOES_MARKETING } from "./marketing";
import { CONSULTAS_MANUTENCAO, ACOES_MANUTENCAO } from "./manutencao";
import { CONSULTAS_TAREFAS, ACOES_TAREFAS } from "./tarefas";
import { CONSULTAS_SUPORTE, ACOES_SUPORTE } from "./suporte";
import { CONSULTAS_INTEGRACOES, ACOES_INTEGRACOES } from "./integracoes";
import { CONSULTAS_MIDIA, ACOES_MIDIA } from "./midia-indoor";

export const REGISTRO_CONSULTAS: DefConsulta[] = [
  ...CONSULTAS_VENDAS,
  ...CONSULTAS_COMPARATIVO,
  ...CONSULTAS_PERFORMANCE,
  ...CONSULTAS_CLIENTES,
  ...CONSULTAS_FINANCEIRO,
  ...CONSULTAS_CLUBE,
  ...CONSULTAS_MARKETING,
  ...CONSULTAS_MANUTENCAO,
  ...CONSULTAS_TAREFAS,
  ...CONSULTAS_SUPORTE,
  ...CONSULTAS_INTEGRACOES,
  ...CONSULTAS_MIDIA,
];

export const REGISTRO_ACOES: DefAcao[] = [
  ...ACOES_FINANCEIRO,
  ...ACOES_CLUBE,
  ...ACOES_MARKETING,
  ...ACOES_MANUTENCAO,
  ...ACOES_TAREFAS,
  ...ACOES_SUPORTE,
  ...ACOES_INTEGRACOES,
  ...ACOES_MIDIA,
];

export { ROTAS } from "./rotas";
