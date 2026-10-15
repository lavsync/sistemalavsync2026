// LavSync · CLOCK v2 · Voz — catálogo de vozes ElevenLabs (pt-BR)
//
// Candidatas levantadas no reconhecimento (Voice Library ElevenLabs). São vozes
// da comunidade: podem exigir "Add to My Voices" na conta antes do uso por API.
// Módulo puro — usado pelas rotas /api/clock/tts e /api/clock/vozes e pela UI.

export type VozCandidata = { nome: string; voice_id: string; descricao: string };

export const VOZ_PADRAO_ID = "xWdpADtEio43ew1zGxUQ"; // Matheus Santos

export const VOZES_CANDIDATAS: VozCandidata[] = [
  { nome: "Matheus Santos", voice_id: "xWdpADtEio43ew1zGxUQ", descricao: "Brasileiro, jovem, cordial e calmo. Aguenta conversa longa sem cansar." },
  { nome: "Lax", voice_id: "tS45q0QcrDHqHoaWdCDR", descricao: "Brasileiro, jovem, descontraído e com humor. Pode soar irônico em número ruim." },
  { nome: "JonOliveiraPro", voice_id: "qarDw4DEvUqP3FBlpO0T", descricao: "Jovem profissional, energia de apresentador. Bom para alertas proativos." },
  { nome: "Beto", voice_id: "xNGAXaCH8MaasNuo7Hr7", descricao: "Jovem, nativo pt-BR, timbre neutro." },
  { nome: "Borges", voice_id: "9pDzHy2OpOgeXM8SeL0t", descricao: "Jovem, lento, calmo e confiante. Sóbrio para relatórios." },
];

const IDS = new Set(VOZES_CANDIDATAS.map((v) => v.voice_id));

export function vozEhCandidata(voiceId: string): boolean {
  return IDS.has(voiceId);
}

/** Formato de um voice_id da ElevenLabs (20 caracteres alfanuméricos). */
export function voiceIdValido(voiceId: unknown): voiceId is string {
  return typeof voiceId === "string" && /^[A-Za-z0-9]{16,32}$/.test(voiceId);
}
