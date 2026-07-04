"use client";

import * as React from "react";
import { consultarMeuClube, type ConsultaClube } from "@/lib/clube/portal-cliente";

const NIVEL_LABEL: Record<string, string> = {
  bronze: "🥉 Bronze", prata: "🥈 Prata", ouro: "🥇 Ouro", diamante: "💎 Diamante",
  nao_classificado: "Em progresso",
};

function formatarCPF(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function MeuClubeView() {
  const [cpf, setCpf] = React.useState("");
  const [carregando, setCarregando] = React.useState(false);
  const [resultado, setResultado] = React.useState<ConsultaClube | null>(null);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setResultado(null);
    try {
      setResultado(await consultarMeuClube(cpf));
    } catch {
      setResultado({ ok: false, erro: "Erro na consulta. Tente novamente." });
    } finally {
      setCarregando(false);
    }
  }

  const r = resultado;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center px-5 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-1">
          <div className="text-4xl">🧺</div>
          <h1 className="text-2xl font-extrabold tracking-tight">Clube Xô Varal</h1>
          <p className="text-sm text-slate-400">
            Consulte seu nível, desconto do mês, ciclos e LavCoins
          </p>
        </header>

        <form onSubmit={consultar} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <label className="block text-sm text-slate-300">
            Seu CPF (o mesmo digitado nas máquinas)
            <input
              value={cpf}
              onChange={(e) => setCpf(formatarCPF(e.target.value))}
              inputMode="numeric"
              placeholder="000.000.000-00"
              className="mt-1.5 w-full h-12 rounded-xl bg-slate-800 border border-slate-700 px-4 text-lg tracking-wider outline-none focus:border-cyan-400"
            />
          </label>
          <button
            type="submit"
            disabled={carregando || cpf.replace(/\D/g, "").length !== 11}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold disabled:opacity-40"
          >
            {carregando ? "Consultando..." : "Consultar meu clube"}
          </button>
        </form>

        {r && !r.ok && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {r.erro}
          </div>
        )}

        {r?.ok && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
              <p className="text-lg font-bold">Olá, {r.primeiroNome}! 👋</p>
              {r.nivelVigente ? (
                <p className="mt-2 text-sm text-slate-300">
                  Seu nível este mês: <strong>{NIVEL_LABEL[r.nivelVigente] ?? r.nivelVigente}</strong>
                  {" — "}
                  <strong className="text-emerald-400">{r.descontoVigente}% OFF</strong> em todas as
                  lavagens e secagens o mês inteiro.
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-300">
                  Você ainda não tem desconto ativo este mês — mas os ciclos que você fizer agora valem
                  para o desconto do mês que vem!
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-center">
                <p className="text-3xl font-extrabold text-cyan-400">{r.ciclosMesAtual}</p>
                <p className="text-xs text-slate-400 mt-1">ciclos este mês</p>
              </div>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-center">
                <p className="text-3xl font-extrabold text-amber-400">{r.lavcoins}</p>
                <p className="text-xs text-slate-400 mt-1">LavCoins (R$1 = 1)</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 text-sm text-slate-300 space-y-2">
              {r.proximoNivel ? (
                <p>
                  🎯 Faltam <strong className="text-white">{r.faltamCiclos} ciclos</strong> para o nível{" "}
                  <strong>{NIVEL_LABEL[r.proximoNivel] ?? r.proximoNivel}</strong> — que garante{" "}
                  <strong className="text-emerald-400">{r.descontoProximo}% OFF</strong> no mês que vem.
                </p>
              ) : (
                <p>👑 Você está no topo do programa este mês. Parabéns!</p>
              )}
              <p className="text-xs text-slate-500">
                Pontos do clube para trocar por brindes: <strong>{r.pontosClube}</strong>. A apuração
                fecha no fim do mês e o desconto vale no mês seguinte inteiro.
              </p>
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-slate-500 space-x-3">
          <a href="/regulamento-clube" className="underline">Regulamento</a>
          <a href="/politica-de-privacidade" className="underline">Privacidade</a>
        </footer>
      </div>
    </main>
  );
}
