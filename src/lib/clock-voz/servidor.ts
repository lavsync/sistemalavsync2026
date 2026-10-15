// LavSync · CLOCK v2 · Voz — utilitários das rotas de voz (servidor)
//
// Gate comum das rotas de voz (tts, stt-token, vozes): sessão válida,
// usuário ATIVO e a chave clock.usar (master/admin passam) — igual ao chat.
// Também limita a taxa por usuário, porque cada chamada gasta crédito da
// ElevenLabs. Resolução da voz ativa:
//   env ELEVENLABS_VOICE_ID > clock_config.voice_id (do tenant) > padrão do contrato.
// A leitura de clock_config usa a sessão do usuário (RLS por tenant).
import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { listarPermissoesEfetivas } from "@/lib/permissoes/queries";
import { VOZ_PADRAO_ID, voiceIdValido } from "./vozes";

export type SessaoVoz = { sb: SupabaseClient; user: User; papel: string; tenantId: string };

const PAPEIS_TOTAIS = new Set(["master", "admin"]);

/**
 * Sessão Supabase do request com o usuário ativo e liberado para o CLOCK.
 * `null` → 401 (sem sessão); `"proibido"` → 403 (inativo ou sem clock.usar).
 */
export async function exigirSessao(): Promise<SessaoVoz | null | "proibido"> {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data?.user) return null;
  const { data: row } = await sb
    .from("usuarios")
    .select("papel, tenant_id, ativo")
    .eq("id", data.user.id)
    .maybeSingle();
  const u = row as { papel: string | null; tenant_id: string | null; ativo: boolean | null } | null;
  if (!u || !u.papel || !u.tenant_id || u.ativo === false) return "proibido";
  if (!PAPEIS_TOTAIS.has(u.papel)) {
    const perms = await listarPermissoesEfetivas(data.user.id);
    if (!perms.has("clock.usar")) return "proibido";
  }
  return { sb, user: data.user, papel: u.papel, tenantId: u.tenant_id };
}

// ─── Limite de taxa por usuário (por instância) ──────────────────────
// Janela deslizante em memória: segura rajadas e loops de um mesmo cliente
// dentro da instância. Não é cota global entre instâncias.
const janelas = new Map<string, number[]>();

/** true = pode seguir; false = estourou `max` chamadas em `janelaMs`. */
export function dentroDoLimite(chave: string, max: number, janelaMs: number): boolean {
  const agora = Date.now();
  const recentes = (janelas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= max) {
    janelas.set(chave, recentes);
    return false;
  }
  recentes.push(agora);
  janelas.set(chave, recentes);
  if (janelas.size > 5000) {
    for (const [k, ts] of janelas) if (ts.every((t) => agora - t >= janelaMs)) janelas.delete(k);
  }
  return true;
}

export type FonteVoz = "env" | "config" | "padrao";

export async function resolverVoz(sb: SupabaseClient, tenantId?: string): Promise<{ voice_id: string; fonte: FonteVoz }> {
  const env = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (env && voiceIdValido(env)) return { voice_id: env, fonte: "env" };
  // Com tenantId explícito (o master enxerga todos os tenants pela RLS)
  let q = sb.from("clock_config").select("voice_id");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q.limit(1).maybeSingle();
  const salvo = (data as { voice_id?: string | null } | null)?.voice_id;
  if (!error && salvo && voiceIdValido(salvo)) return { voice_id: salvo, fonte: "config" };
  return { voice_id: VOZ_PADRAO_ID, fonte: "padrao" };
}

/** Chave ElevenLabs para STT: dedicada (com speech_to_text) ou a geral. */
export function chaveStt(): string | null {
  return process.env.ELEVENLABS_STT_API_KEY?.trim() || process.env.ELEVENLABS_API_KEY?.trim() || null;
}
