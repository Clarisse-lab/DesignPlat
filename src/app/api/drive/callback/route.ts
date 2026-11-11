// Volta do Google depois de autorizar o Drive.

import { NextResponse } from "next/server";
import { publicOrigin } from "@/lib/server/aprovacoes";
import { finishAuth } from "@/lib/server/drive";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const back = (q: string) => NextResponse.redirect(`${origin}/drive?${q}`, 302);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || !state) return back("erro=" + encodeURIComponent("A conexão foi cancelada."));
  try {
    const email = await finishAuth(code, state, `${origin}/api/drive/callback`);
    return back("ok=" + encodeURIComponent(email ?? "1"));
  } catch (error) {
    console.error("[drive/callback]", error);
    return back("erro=" + encodeURIComponent(error instanceof Error ? error.message : "Falha ao conectar."));
  }
}
