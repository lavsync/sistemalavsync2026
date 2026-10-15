"use client";

// LavSync · Projetado × Real › Importar
//
// Drop zone (arrastar e soltar ou escolher no computador) para o arquivo da
// franqueadora: planilhas (.xlsx .xls .ods .csv), PDF ou imagem, até 15 MB.
// O arquivo vai para a server action importarArquivoProjecao, o CLOCK lê e
// devolve um RASCUNHO — nada é salvo aqui. A tela mostra o que foi entendido
// (linhas, meses, premissas, investimento, avisos) e leva ao editor para revisar.
import * as React from "react";
import {
  Upload, FileSpreadsheet, FileText, FileImage, Loader2, CheckCircle2, ArrowRight, RotateCcw, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { importarArquivoProjecao } from "@/lib/financeiro/projecao/actions";
import type { Projecao } from "@/lib/financeiro/projecao/tipos";
import { SeletorUnidade, ListaAvisos, MensagemErro, mensagemDeErro } from "./ui";
import { MESES_LONGOS, fmtBRL, fmtNumero, fmtPct, mesesPreenchidos, rotuloChave } from "./formatos";

const EXTENSOES = [".xlsx", ".xls", ".ods", ".csv", ".pdf", ".png", ".jpg", ".jpeg", ".webp"] as const;
const LIMITE_BYTES = 15 * 1024 * 1024;

type Estado =
  | { fase: "ocioso" }
  | { fase: "lendo"; arquivo: File; inicio: number }
  | { fase: "pronto"; arquivo: File; rascunho: Projecao }
  | { fase: "erro"; erro: string; arquivo?: File };

function extensao(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i).toLowerCase() : "";
}

function tipoArquivo(nome: string): "planilha" | "pdf" | "imagem" {
  const ext = extensao(nome);
  if (ext === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return "imagem";
  return "planilha";
}

function IconeArquivo({ nome, className }: { nome: string; className?: string }) {
  const t = tipoArquivo(nome);
  const Icone = t === "pdf" ? FileText : t === "imagem" ? FileImage : FileSpreadsheet;
  return <Icone className={className} />;
}

function fmtTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function AreaImportar({ unidades, unidadeId, onUnidade, onRevisar }: {
  unidades: Array<{ id: string; nome: string }>;
  unidadeId: string;
  onUnidade: (id: string) => void;
  onRevisar: (p: Projecao) => void;
}) {
  const [estado, setEstado] = React.useState<Estado>({ fase: "ocioso" });
  const [arrastando, setArrastando] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const lendo = estado.fase === "lendo";

  function validar(f: File): string | null {
    if (!(EXTENSOES as readonly string[]).includes(extensao(f.name))) {
      return `Formato não aceito (${extensao(f.name) || "sem extensão"}). Use planilha (.xlsx, .xls, .ods, .csv), PDF ou imagem (.png, .jpg, .webp).`;
    }
    if (f.size > LIMITE_BYTES) return `O arquivo tem ${fmtTamanho(f.size)}. O limite é 15 MB.`;
    // A leitura de imagem pelo CLOCK aceita até 5 MB por imagem
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(extensao(f.name)) && f.size > 5 * 1024 * 1024) {
      return `A imagem tem ${fmtTamanho(f.size)}. Para imagem o limite é 5 MB: reduza a resolução ou envie em PDF.`;
    }
    if (f.size === 0) return "O arquivo está vazio.";
    return null;
  }

  async function enviar(f: File) {
    const erro = validar(f);
    if (erro) { setEstado({ fase: "erro", erro, arquivo: f }); return; }
    setEstado({ fase: "lendo", arquivo: f, inicio: Date.now() });
    try {
      const form = new FormData();
      form.append("arquivo", f);
      form.append("unidade_id", unidadeId);
      const r = await importarArquivoProjecao(form);
      if (!r.ok) {
        setEstado({ fase: "erro", erro: mensagemDeErro(r, "O CLOCK não conseguiu ler o arquivo."), arquivo: f });
        return;
      }
      setEstado({ fase: "pronto", arquivo: f, rascunho: r.rascunho });
    } catch (e) {
      setEstado({ fase: "erro", erro: mensagemDeErro(e, "Falha ao enviar o arquivo. Tente de novo."), arquivo: f });
    }
  }

  function aoSoltar(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    if (lendo) return;
    const f = e.dataTransfer.files?.[0];
    if (f) void enviar(f);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorUnidade unidades={unidades} valor={unidadeId} onChange={onUnidade} rotulo="Projeção da unidade" />
        <span className="text-[11px] text-muted-foreground">O arquivo é guardado com segurança; a projeção só é salva depois da sua revisão.</span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!lendo) setArrastando(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastando(false); }}
        onDrop={aoSoltar}
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-colors",
          arrastando ? "border-brand-cyan bg-brand-cyan/[0.06]" : "border-border-strong bg-card",
          lendo && "opacity-90",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={EXTENSOES.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void enviar(f);
          }}
        />

        {estado.fase === "lendo" ? (
          <Lendo arquivo={estado.arquivo} inicio={estado.inicio} />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-cyan/12 text-brand-cyan flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="font-display font-semibold text-[15px]">
                {arrastando ? "Solte o arquivo para o CLOCK ler" : "Arraste aqui o DRE projetado da franqueadora"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Planilha (.xlsx, .xls, .ods, .csv), PDF ou imagem (.png, .jpg, .webp) · até 15 MB
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              Escolher arquivo no computador
            </Button>
          </div>
        )}
      </div>

      {estado.fase === "erro" && (
        <div className="space-y-2">
          <MensagemErro texto={estado.erro} onFechar={() => setEstado({ fase: "ocioso" })} />
          {estado.arquivo && validar(estado.arquivo) === null && (
            <Button type="button" variant="outline" size="sm" onClick={() => estado.arquivo && void enviar(estado.arquivo)}>
              <RotateCcw /> Tentar de novo
            </Button>
          )}
        </div>
      )}

      {estado.fase === "pronto" && (
        <Resumo
          arquivo={estado.arquivo}
          rascunho={estado.rascunho}
          onRevisar={() => onRevisar(estado.rascunho)}
          onOutro={() => setEstado({ fase: "ocioso" })}
        />
      )}

      {estado.fase === "ocioso" && (
        <div className="grid gap-3 sm:grid-cols-3 text-[12px]">
          <Dica titulo="Planilha" texto="O CLOCK identifica as linhas do DRE e as premissas; os números saem direto das células calculadas." />
          <Dica titulo="PDF ou imagem" texto="O CLOCK transcreve os valores. Todas as linhas chegam marcadas para conferir no editor." />
          <Dica titulo="Mês 1" texto="O mês 1 da franqueadora é o mês de inauguração. Você ajusta no editor se precisar." />
        </div>
      )}
    </div>
  );
}

function Dica({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="font-semibold text-foreground">{titulo}</div>
      <p className="text-muted-foreground mt-1 leading-relaxed">{texto}</p>
    </div>
  );
}

function Lendo({ arquivo, inicio }: { arquivo: File; inicio: number }) {
  const [agora, setAgora] = React.useState(inicio);
  React.useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seg = Math.max(0, Math.floor((agora - inicio) / 1000));
  const tipo = tipoArquivo(arquivo.name);
  return (
    <div className="flex flex-col items-center gap-3" aria-live="polite">
      <div className="w-12 h-12 rounded-xl bg-brand-cyan/12 text-brand-cyan flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
      <div>
        <p className="font-display font-semibold text-[15px]">CLOCK lendo o arquivo…</p>
        <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
          <IconeArquivo nome={arquivo.name} className="w-3.5 h-3.5" />
          {arquivo.name} · {fmtTamanho(arquivo.size)} · {seg}s
        </p>
      </div>
      <div className="w-full max-w-xs h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-full rounded-full bg-brand-cyan/60 animate-pulse" />
      </div>
      <p className="text-[11px] text-muted-foreground max-w-sm">
        {tipo === "planilha"
          ? "Mapeando as abas, as linhas do DRE, as premissas e o investimento."
          : "Transcrevendo os valores do documento. Isso pode levar até um minuto."}
      </p>
    </div>
  );
}

function Resumo({ arquivo, rascunho, onRevisar, onOutro }: {
  arquivo: File;
  rascunho: Projecao;
  onRevisar: () => void;
  onOutro: () => void;
}) {
  const p = rascunho.premissas;
  const inv = rascunho.investimento;
  const meses = mesesPreenchidos(rascunho.linhas);
  const conferir = rascunho.linhas.filter((l) => l.conferir).length;
  const rampaAno1 = p ? p.rampa.slice(0, 12) : [];
  const fat = rascunho.linhas.find((l) => l.chave === "faturamento");
  const fatAno1 = fat ? fat.valores.slice(0, 12).reduce((s, v) => s + (v || 0), 0) : null;

  return (
    <section className="card-premium rounded-xl p-5 space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-[15px]">O CLOCK leu o arquivo</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {arquivo.name} · rascunho “{rascunho.nome}” · ainda não salvo
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={onOutro}>Outro arquivo</Button>
          <Button type="button" onClick={onRevisar}>
            Revisar no editor <ArrowRight />
          </Button>
        </div>
      </header>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Item rotulo="Linhas do DRE" valor={String(rascunho.linhas.length)}
          detalhe={conferir > 0 ? `${conferir} para conferir` : "nenhuma para conferir"} alerta={conferir > 0} />
        <Item rotulo="Meses projetados" valor={String(meses)} detalhe={meses >= 60 ? "5 anos completos" : `de 60 meses`} alerta={meses > 0 && meses < 60} />
        <Item rotulo="Mês 1 da projeção" valor={`${MESES_LONGOS[rascunho.mes1_mes - 1] ?? "?"}/${rascunho.mes1_ano}`} detalhe="ajustável no editor" />
        <Item rotulo="Faturamento no ano 1" valor={fatAno1 != null ? fmtBRL(fatAno1) : "não encontrado"} alerta={fatAno1 == null} />
      </dl>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h4 className="text-[13px] font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-cyan" /> Premissas entendidas
          </h4>
          {p ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <Par k="Potencial de faturamento" v={`${fmtBRL(p.potencial_faturamento)}/mês`} />
              <Par k="Rampa no ano 1" v={rampaAno1.length ? `${fmtPct(Math.min(...rampaAno1), 0)} a ${fmtPct(Math.max(...rampaAno1), 0)}` : "—"} />
              <Par k="CSP" v={`${fmtNumero(p.csp_pct)}%`} />
              <Par k="Royalties" v={`${fmtNumero(p.royalties_pct)}% · mínimo ${fmtBRL(p.royalties_minimo)} a partir do mês ${p.royalties_minimo_a_partir_mes}`} />
              <Par k="Fundo de propaganda" v={fmtBRL(p.fundo_propaganda_fixo)} />
              <Par k="Aluguel e IPTU" v={fmtBRL(p.aluguel)} />
              <Par k="Taxa de cartão" v={`${fmtNumero(p.taxa_cartao_pct)}%`} />
              <Par k="Simples Nacional" v={p.metodo_simples === "franqueadora" ? "método da franqueadora" : "regra legal"} />
            </dl>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">
              O arquivo não trouxe premissas separadas. As linhas foram lidas direto do DRE; você pode preencher as premissas no editor.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border p-4">
          <h4 className="text-[13px] font-semibold">Investimento</h4>
          {inv ? (
            <>
              <p className="mt-2 font-mono font-semibold text-lg">{fmtBRL(inv.total, 2)}</p>
              <p className="text-[11px] text-muted-foreground">
                {inv.categorias.length} categorias · capital de giro {fmtBRL(inv.capital_giro, 2)}
              </p>
              <ul className="mt-2 space-y-1 text-[12px]">
                {inv.categorias.slice(0, 6).map((c) => (
                  <li key={c.nome} className="flex justify-between gap-3">
                    <span className="truncate text-muted-foreground">{c.nome}</span>
                    <span className="font-mono shrink-0">{fmtBRL(c.valor)}</span>
                  </li>
                ))}
                {inv.categorias.length > 6 && (
                  <li className="text-[11px] text-muted-foreground">+ {inv.categorias.length - 6} categorias no editor</li>
                )}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">Investimento não encontrado no arquivo. Informe no editor para o cálculo de payback.</p>
          )}
        </div>
      </div>

      {rascunho.linhas.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Linhas: </span>
          {rascunho.linhas
            .slice()
            .sort((a, b) => a.ordem - b.ordem)
            .map((l) => l.descricao || rotuloChave(l.chave))
            .join(" · ")}
        </div>
      )}

      <ListaAvisos avisos={rascunho.avisos} />
    </section>
  );
}

function Item({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{rotulo}</dt>
      <dd className="mt-1 font-mono font-semibold text-[17px]">{valor}</dd>
      {detalhe && <dd className={cn("text-[11px] mt-0.5", alerta ? "text-warning" : "text-muted-foreground")}>{detalhe}</dd>}
    </div>
  );
}

function Par({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-right sm:text-left">{v}</dd>
    </>
  );
}
