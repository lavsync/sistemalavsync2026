// LavSync · Clube · Render de mensagem + link WhatsApp Web (client-safe)
//
// Módulo PURO (sem "use server"/"use client") — usado no navegador pra
// montar a mensagem de qualificação e o link wa.me. O WhatsApp Web logado
// no navegador é o da UNIDADE (1 celular por unidade, decisão operacional).

export const LINK_PORTAL_CLIENTE = "https://sistema.lavsync.com.br/meu-clube";

export function renderMensagem(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "gi"), String(v));
  }
  return out;
}

/** Link wa.me: abre a conversa no WhatsApp Web logado com o texto pronto. */
export function linkWhatsApp(telefone: string, texto: string): string {
  let d = telefone.replace(/\D/g, "");
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}
