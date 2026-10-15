"use client";

// LavSync · Financeiro › Projetado × Real (raiz da aba)
//
// Toda franqueadora vende a franquia com um DRE projetado de 5 anos. Esta aba
// traz esse projetado para dentro do sistema e o coloca lado a lado com o REAL:
//   1. Importar — arrastar e soltar o arquivo da franqueadora; o CLOCK lê e
//      devolve um RASCUNHO (nada é salvo até o usuário revisar).
//   2. Editar   — grade linhas × meses, premissas, investimento, salvar/ativar.
//   3. Comparar — KPIs, gráfico mensal, tabela, custos por linha e insights.
//
// A sub-aba fica na URL (?area=) para o CLOCK abrir a tela já na área certa.
// O rascunho/projeção em edição mora aqui, na raiz, para sobreviver à troca de
// área (importar → revisar no editor → comparar).
import * as React from "react";
import { Upload, PencilLine, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAbaUrl } from "@/components/shell/use-aba-url";
import type { Projecao } from "@/lib/financeiro/projecao/tipos";
import { AreaImportar } from "./area-importar";
import { AreaEditar } from "./area-editar";
import { AreaComparar } from "./area-comparar";

const AREAS = ["comparar", "importar", "editar"] as const;
type Area = (typeof AREAS)[number];

const ROTULO_AREA: Record<Area, { titulo: string; icone: React.ComponentType<{ className?: string }> }> = {
  comparar: { titulo: "Comparar", icone: GitCompareArrows },
  importar: { titulo: "Importar", icone: Upload },
  editar: { titulo: "Editar", icone: PencilLine },
};

/** Projeção aberta no editor + a versão de referência para "Descartar". */
export type EdicaoProjecao = {
  projecao: Projecao;
  /** Versão carregada/importada (Descartar volta para ela). */
  base: Projecao;
  sujo: boolean;
};

export function ProjetadoVsReal({ unidades, unidadeId }: {
  unidades: Array<{ id: string; nome: string }>;
  unidadeId: string;
}) {
  const [area, setArea] = useAbaUrl(AREAS, "comparar", "area");
  const [unidadeSel, setUnidadeSel] = React.useState(unidadeId);
  const [edicao, setEdicao] = React.useState<EdicaoProjecao | null>(null);
  // Contador que força o Comparar a recarregar depois de salvar/excluir.
  const [versaoDados, setVersaoDados] = React.useState(0);

  // A unidade da página mudou (seletor global): acompanha, sem efeito.
  const [unidadeVista, setUnidadeVista] = React.useState(unidadeId);
  if (unidadeId !== unidadeVista) {
    setUnidadeVista(unidadeId);
    if (!edicao?.sujo) {
      setUnidadeSel(unidadeId);
      setEdicao(null);
    }
  }

  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? "Unidade";

  function abrirRascunho(p: Projecao) {
    const copia = clonar(p);
    setEdicao({ projecao: copia, base: clonar(p), sujo: true });
    setUnidadeSel(p.unidade_id);
    setArea("editar");
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-lg tracking-tight">Projetado da franqueadora × Real</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            O DRE de 5 anos que a franqueadora apresentou, mês a mês, contra o que a unidade realmente fatura e gasta.
          </p>
        </div>
        <nav
          role="tablist"
          aria-label="Áreas do projetado"
          className="inline-flex self-start sm:self-auto rounded-lg border border-border bg-card p-0.5"
        >
          {AREAS.map((a) => {
            const { titulo, icone: Icone } = ROTULO_AREA[a];
            const ativo = area === a;
            return (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setArea(a)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium transition-colors",
                  ativo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icone className="w-3.5 h-3.5" />
                {titulo}
                {a === "editar" && edicao?.sujo && (
                  <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-warning" aria-label="alterações não salvas" />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {area === "importar" && (
        <AreaImportar
          unidades={unidades}
          unidadeId={unidadeSel}
          onUnidade={setUnidadeSel}
          onRevisar={abrirRascunho}
        />
      )}

      {area === "editar" && (
        <AreaEditar
          unidades={unidades}
          unidadeId={unidadeSel}
          onUnidade={(id) => { setUnidadeSel(id); setEdicao(null); }}
          edicao={edicao}
          onEdicao={setEdicao}
          onSalvo={() => setVersaoDados((v) => v + 1)}
          onImportar={() => setArea("importar")}
          nomeUnidade={nomeUnidade}
        />
      )}

      {area === "comparar" && (
        <AreaComparar
          unidades={unidades}
          unidadeId={unidadeId}
          versaoDados={versaoDados}
          onImportar={() => setArea("importar")}
          onEditar={(id) => { setUnidadeSel(id); setEdicao(null); setArea("editar"); }}
          nomeUnidade={nomeUnidade}
        />
      )}
    </div>
  );
}

export function clonar<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
