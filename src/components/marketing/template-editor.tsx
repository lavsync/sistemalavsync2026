"use client";

// LavSync · Clube · Editor do banco de mensagens WhatsApp
//
// Dialog de criar/editar mensagem: tipo, nível alvo, texto com paleta de
// VARIÁVEIS clicáveis + EMOJIS (inserção no cursor), banner (upload +
// copiar pro clipboard) e pré-visualização ao vivo com dados de exemplo.
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X, Save, Loader2, ImagePlus, Trash2, Copy, Check, Smile, Braces, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NIVEIS, labelDoNivel, type NivelClube } from "@/lib/clube/niveis";
import { renderMensagem, LINK_PORTAL_CLIENTE } from "@/lib/clube/render-mensagem";
import type { TemplateMensagem } from "@/lib/clube/queries";
import { salvarTemplate, uploadBannerTemplate, type TemplateInput } from "@/lib/clube/templates-actions";

const TIPOS: Array<{ value: string; label: string; dica: string }> = [
  { value: "parabens_nivel", label: "Parabéns por nível", dica: "Enviada no dia 1º pra quem conquistou o nível (exige nível alvo)" },
  { value: "abaixo_bronze", label: "Incentivo abaixo de Bronze", dica: "Pra quem usou no mês mas não atingiu nível" },
  { value: "faltam_ciclos", label: "Faltam ciclos (sprint)", dica: "Reta final do mês, perto do próximo nível" },
  { value: "pontos_disponiveis", label: "Pontos disponíveis", dica: "Lembrete de pontos pra trocar na store" },
  { value: "renovacao_mes", label: "Renovação do mês", dica: "Benefício renovado no novo mês" },
  { value: "xoclub_portal", label: "LavCoins + portal", dica: "Saldo LavCoins + link do portal do cliente" },
  { value: "xoclub_saldo_diario", label: "Saldo do dia (LavCoins)", dica: "Atualização diária pra quem usou ontem" },
  { value: "livre", label: "Livre (uso geral)", dica: "Qualquer campanha ou comunicação avulsa" },
];

const VARIAVEIS: Array<{ chave: string; desc: string }> = [
  { chave: "{primeiro_nome}", desc: "Primeiro nome do cliente" },
  { chave: "{nome}", desc: "Nome completo" },
  { chave: "{nivel}", desc: "Nível do cliente (BRONZE...)" },
  { chave: "{ciclos}", desc: "Ciclos no mês de referência" },
  { chave: "{desconto}", desc: "% de desconto do nível" },
  { chave: "{pontos}", desc: "Pontos pra trocar na store" },
  { chave: "{lavcoins}", desc: "Saldo de LavCoins" },
  { chave: "{faltam}", desc: "Ciclos que faltam pro próximo nível" },
  { chave: "{proximo_nivel}", desc: "Nome do próximo nível" },
  { chave: "{desconto_proximo}", desc: "% do próximo nível" },
  { chave: "{mes_ref_nome}", desc: "Mês de referência (ex: Junho/26)" },
  { chave: "{mes_aplic_nome}", desc: "Mês de aplicação (ex: Julho/26)" },
  { chave: "{link_portal}", desc: "Link do portal do cliente" },
  { chave: "{ciclos_palavra}", desc: "\"ciclo\" ou \"ciclos\"" },
];

const EMOJIS = [
  "💙", "🧺", "💧", "🫧", "🧼", "👕", "🌀", "✨", "🎁", "🎉", "🏆", "👑",
  "💎", "🥇", "🥈", "🥉", "🔥", "⭐", "🌟", "💰", "🪙", "📈", "🎯", "🚀",
  "😀", "😄", "😉", "😍", "🤩", "🙌", "👏", "💪", "🤝", "👋", "🙏", "❤️",
  "💚", "💛", "🧡", "✅", "☑️", "➡️", "⏰", "📅", "📲", "🔔", "🛍️", "🏃",
];

// Dados fictícios pra pré-visualização
const EXEMPLO: Record<string, string | number> = {
  primeiro_nome: "Fernanda", nome: "Fernanda Souza", cpf: "123.456.789-00",
  nivel: "OURO", ciclos: 20, ciclos_palavra: "ciclos", desconto: 15,
  pontos: 32, lavcoins: 245, faltam: 4, proximo_nivel: "DIAMANTE",
  desconto_proximo: 20, faltam_proximo: 4,
  mes_ref_nome: "Junho/26", mes_aplic_nome: "Julho/26",
  link_portal: LINK_PORTAL_CLIENTE,
};

export function TemplateEditorDialog({
  template, onClose,
}: {
  template: TemplateMensagem | "novo" | null;   // "novo" = criar
  onClose: (salvou: boolean) => void;
}) {
  const editando = template !== null && template !== "novo" ? template : null;
  const [tipo, setTipo] = React.useState(editando?.tipo ?? "livre");
  const [nivelAlvo, setNivelAlvo] = React.useState<string>(editando?.nivel_alvo ?? "bronze");
  const [titulo, setTitulo] = React.useState(editando?.titulo ?? "");
  const [mensagem, setMensagem] = React.useState(editando?.mensagem ?? "");
  const [ativo, setAtivo] = React.useState(editando?.ativo ?? true);
  const [bannerUrl, setBannerUrl] = React.useState<string | null>(editando?.banner_url ?? null);
  const [salvando, setSalvando] = React.useState(false);
  const [subindoBanner, setSubindoBanner] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [mostrarEmojis, setMostrarEmojis] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  if (template === null) return null;

  function inserirNoCursor(texto: string) {
    const el = textareaRef.current;
    if (!el) { setMensagem((m) => m + texto); return; }
    const ini = el.selectionStart ?? mensagem.length;
    const fim = el.selectionEnd ?? mensagem.length;
    const novo = mensagem.slice(0, ini) + texto + mensagem.slice(fim);
    setMensagem(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = ini + texto.length;
    });
  }

  async function subirBanner(file: File) {
    setSubindoBanner(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadBannerTemplate(fd);
      if (r.ok && r.url) setBannerUrl(r.url);
      else setErro(r.erro ?? "Falha no upload");
    } finally {
      setSubindoBanner(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const input: TemplateInput = {
      tipo, nivel_alvo: tipo === "parabens_nivel" ? nivelAlvo : null,
      titulo, mensagem, ativo,
      ordem: editando?.ordem ?? 99,
      banner_url: bannerUrl,
    };
    const r = await salvarTemplate(editando?.id ?? null, input);
    setSalvando(false);
    if (r.ok) onClose(true);
    else setErro(r.erro ?? "Falha ao salvar");
  }

  const preview = renderMensagem(mensagem || "Digite a mensagem...", EXEMPLO);

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(920px,94vw)] max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-display font-bold text-[15px]">
              {editando ? "Editar mensagem" : "Nova mensagem"}
            </Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></Dialog.Close>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Coluna esquerda: formulário */}
            <div className="space-y-3">
              <label className="block text-[12px]">
                <span className="text-muted-foreground">Título interno</span>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Boas-vindas ao Ouro"
                  className="form-input mt-1 w-full h-9 text-[13px]" />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[12px]">
                  <span className="text-muted-foreground">Tipo</span>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                    className="form-input mt-1 w-full h-9 text-[13px]">
                    {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                {tipo === "parabens_nivel" && (
                  <label className="block text-[12px]">
                    <span className="text-muted-foreground">Nível alvo</span>
                    <select value={nivelAlvo} onChange={(e) => setNivelAlvo(e.target.value)}
                      className="form-input mt-1 w-full h-9 text-[13px]">
                      {NIVEIS.filter((n) => n.key !== "nao_classificado").map((n) => (
                        <option key={n.key} value={n.key}>{labelDoNivel(n.key as NivelClube)}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground -mt-1">
                {TIPOS.find((t) => t.value === tipo)?.dica}
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-muted-foreground">Mensagem</span>
                  <button type="button" onClick={() => setMostrarEmojis((v) => !v)}
                    className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border",
                      mostrarEmojis ? "border-brand-cyan text-brand-cyan" : "border-border text-muted-foreground hover:text-foreground")}>
                    <Smile className="w-3 h-3" /> Emojis
                  </button>
                </div>
                {mostrarEmojis && (
                  <div className="mb-2 grid grid-cols-12 gap-0.5 rounded-lg border border-border bg-secondary/20 p-2">
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => inserirNoCursor(e)}
                        className="text-[16px] hover:scale-125 transition-transform leading-7">
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={7}
                  placeholder="Oi {primeiro_nome}! ..."
                  className="form-input w-full text-[13px] leading-relaxed resize-y"
                />
                <div className="mt-1.5">
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 mb-1">
                    <Braces className="w-3 h-3" /> Clique pra inserir variável:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {VARIAVEIS.map((v) => (
                      <button key={v.chave} type="button" title={v.desc}
                        onClick={() => inserirNoCursor(v.chave)}
                        className="px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan text-[10px] font-mono hover:bg-brand-cyan/20">
                        {v.chave}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Banner */}
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold inline-flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5 text-brand-cyan" /> Banner (opcional)
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={subindoBanner}
                      className="text-[11px] font-semibold text-brand-cyan hover:underline inline-flex items-center gap-1">
                      {subindoBanner ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                      {bannerUrl ? "Trocar" : "Enviar imagem"}
                    </button>
                    {bannerUrl && (
                      <button type="button" onClick={() => setBannerUrl(null)}
                        className="text-[11px] font-semibold text-danger hover:underline inline-flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    )}
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirBanner(f); e.target.value = ""; }} />
                {bannerUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bannerUrl} alt="Banner" className="mt-2 rounded-md max-h-32 border border-border" />
                )}
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  PNG/JPEG/WebP/GIF até 4MB. No fluxo manual, o botão &quot;Copiar banner&quot; copia a imagem
                  pra você colar (Ctrl+V) na conversa do WhatsApp Web antes de enviar o texto.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-[12px] cursor-pointer select-none">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="accent-brand-cyan" />
                Mensagem ativa (aparece nos fluxos de envio)
              </label>
            </div>

            {/* Coluna direita: preview estilo WhatsApp */}
            <div>
              <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1 mb-1">
                <Eye className="w-3 h-3" /> Pré-visualização (dados de exemplo)
              </span>
              <div className="rounded-xl bg-[#0b141a] p-4 min-h-[280px]"
                style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #12242e 0, transparent 50%)" }}>
                <div className="max-w-[92%] ml-auto">
                  <div className="rounded-lg rounded-tr-none bg-[#005c4b] text-[#e9edef] p-2.5 text-[13px] leading-relaxed shadow">
                    {bannerUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bannerUrl} alt="" className="rounded-md mb-2 w-full" />
                    )}
                    <span className="whitespace-pre-wrap">{preview}</span>
                    <div className="text-right text-[10px] text-[#8fa8a2] mt-1">12:00 ✓✓</div>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                As variáveis são substituídas pelos dados reais de cada cliente na hora do envio.
              </p>
            </div>
          </div>

          {erro && (
            <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              {erro}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || !titulo.trim() || !mensagem.trim()}
              className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
              {salvando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Salvar mensagem
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Copia a imagem do banner pro clipboard (pra colar no WhatsApp Web). */
export function BotaoCopiarBanner({ url }: { url: string }) {
  const [copiado, setCopiado] = React.useState(false);
  async function copiar() {
    try {
      const blob = await (await fetch(url)).blob();
      // clipboard de imagem exige PNG na maioria dos browsers
      const png = blob.type === "image/png" ? blob : await converterPraPng(blob);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.open(url, "_blank", "noopener"); // fallback: abre pra copiar manualmente
    }
  }
  return (
    <button type="button" onClick={copiar}
      title="Copiar o banner — depois cole (Ctrl+V) na conversa do WhatsApp Web"
      className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-smooth",
        copiado ? "bg-success/15 text-success" : "bg-brand-purple/15 text-brand-purple hover:bg-brand-purple/25")}>
      {copiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copiado ? "Copiado! Cole no WhatsApp" : "Copiar banner"}
    </button>
  );
}

async function converterPraPng(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob falhou"))), "image/png"),
  );
}
