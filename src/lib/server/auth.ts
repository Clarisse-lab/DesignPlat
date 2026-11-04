import "server-only";
import { NextResponse } from "next/server";
import { memberFromToken, supabaseConfigured, type TeamMember } from "./supabase";

// Cada pedido confere o login; o resultado fica 5 minutos em memória para não consultar o Supabase toda hora.
const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; result: TeamMember | "invalid" | "forbidden" }>();

/** Pessoa da equipe usada quando o login ainda não foi configurado (site aberto, como antes). */
const OPEN_MODE: TeamMember = { email: "", nome: "", admin: false };

/**
 * Exige login da equipe da Mantora. Devolve a pessoa ou a resposta de erro pronta.
 * `strict`: rotas que gastam dinheiro (IA) ficam fechadas mesmo sem o login configurado.
 */
export async function requireMember(request: Request, { strict = false } = {}): Promise<TeamMember | Response> {
  if (!supabaseConfigured()) {
    if (strict) return NextResponse.json({ error: "Configure o login (variáveis do Supabase no Railway) antes de usar a IA." }, { status: 503 });
    return OPEN_MODE;
  }
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Faça login com o Google da Mantora." }, { status: 401 });

  const hit = cache.get(token);
  let result = hit && Date.now() - hit.at < CACHE_MS ? hit.result : null;
  if (!result) {
    try {
      result = await memberFromToken(token);
    } catch (error) {
      console.error("[auth] falha ao conferir o login:", error);
      return NextResponse.json({ error: "Não foi possível conferir o login agora." }, { status: 503 });
    }
    cache.set(token, { at: Date.now(), result });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
  }
  if (result === "invalid") return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  if (result === "forbidden") return NextResponse.json({ error: "Seu e-mail não está liberado. Peça para a Clarisse incluir você na equipe." }, { status: 403 });
  return result;
}

export const isResponse = (value: unknown): value is Response => value instanceof Response;
