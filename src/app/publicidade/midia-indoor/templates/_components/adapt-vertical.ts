import type { EditorElement } from "@mi/types/editor";

const HORIZONTAL = { w: 1920, h: 1080 };
const VERTICAL = { w: 1080, h: 1920 };

/**
 * Adapta um layout 16:9 para 9:16 mantendo hierarquia visual.
 *
 * Heurística:
 * - Conteúdo principal (textos, preço): topo da tela (1/3 superior)
 * - QR Code: centro-baixo (mais visível com câmera)
 * - Elementos grandes (cover): full-bleed quando possível
 * - Backgrounds full continuam full
 */
export function adaptElementsToVertical(elements: EditorElement[]): EditorElement[] {
  // Separa elementos por papel visual (mantém EditorElement[] em todas listas pra simplicidade)
  const qrElements: EditorElement[] = elements.filter((e) => e.type === "qrcode");
  const heroElements: EditorElement[] = elements.filter(
    (e) =>
      (e.type === "image" || e.type === "video" || e.type === "shape") &&
      e.width >= HORIZONTAL.w * 0.6 &&
      e.height >= HORIZONTAL.h * 0.6,
  );
  const textElements: EditorElement[] = elements.filter(
    (e) => ["heading", "subtitle", "text", "cta", "phone", "url", "price", "button"].includes(e.type),
  );
  const others: EditorElement[] = elements.filter(
    (e) => !qrElements.includes(e) && !heroElements.includes(e) && !textElements.includes(e),
  );

  const adapted: EditorElement[] = [];

  // 1. Hero / background grandes: ocupar fundo full-bleed
  for (const hero of heroElements) {
    adapted.push({ ...hero, x: 0, y: 0, width: VERTICAL.w, height: VERTICAL.h });
  }

  // 2. Textos: stack vertical no topo (até 50% da altura)
  const PAD = 80;
  let cursorY = 100;
  const textMaxWidth = VERTICAL.w - PAD * 2;

  // Ordena texto por papel (heading > subtitle > price > text > etc)
  const textOrder: Record<string, number> = {
    heading: 1, price: 2, subtitle: 3, cta: 4, text: 5, phone: 6, url: 7, button: 8,
  };
  textElements.sort((a, b) => (textOrder[a.type] ?? 99) - (textOrder[b.type] ?? 99));

  for (const t of textElements) {
    // Escala fonte se for heading (proporcionalmente menor pra caber em 9:16)
    let patch: Partial<EditorElement> = {
      x: PAD,
      y: cursorY,
      width: textMaxWidth,
    };

    if (t.type === "heading" || t.type === "subtitle" || t.type === "text" || t.type === "cta") {
      const fontScale = textMaxWidth / 1300; // 1300 era largura típica em horizontal
      const newFontSize = Math.round(("fontSize" in t ? t.fontSize : 32) * Math.min(0.85, fontScale + 0.1));
      const lineHeightFactor = "lineHeight" in t ? t.lineHeight : 1.2;
      const newHeight = Math.max(t.height, newFontSize * lineHeightFactor * 1.5);
      patch = { ...patch, fontSize: newFontSize, height: newHeight } as Partial<EditorElement>;
      cursorY += newHeight + 24;
    } else if (t.type === "price") {
      patch = { ...patch, height: 320 } as Partial<EditorElement>;
      cursorY += 320 + 24;
    } else {
      cursorY += t.height + 16;
    }

    adapted.push({ ...t, ...patch } as EditorElement);
  }

  // 3. QR Code: centro-baixo (área de fácil visualização)
  for (const qr of qrElements) {
    const qrSize = Math.min(640, VERTICAL.w - PAD * 2);
    adapted.push({
      ...qr,
      x: Math.round((VERTICAL.w - qrSize) / 2),
      y: VERTICAL.h - qrSize - 200,
      width: qrSize,
      height: qrSize + 60,
    });
  }

  // 4. Outros: posição relativa (proporção)
  for (const other of others) {
    const relX = other.x / HORIZONTAL.w;
    const relY = other.y / HORIZONTAL.h;
    adapted.push({
      ...other,
      x: Math.round(relX * VERTICAL.w),
      y: Math.round(relY * VERTICAL.h),
    });
  }

  return adapted;
}
