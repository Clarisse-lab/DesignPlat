// Estilos de referência (design_estilos): os do cliente pedido e os da agência (sem cliente).
// O padrão do cliente vem primeiro.

import { NextResponse } from "next/server";
import { isResponse, requireMember } from "@/lib/server/auth";
import { loadEstilos } from "@/lib/server/estilos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?cliente=slug */
export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const cliente = new URL(request.url).searchParams.get("cliente");
  const slug = cliente && /^[a-z0-9-]{2,60}$/.test(cliente) ? cliente : null;
  try {
    return NextResponse.json({ estilos: await loadEstilos(slug) });
  } catch (error) {
    console.error("[estudio/estilos]", error);
    return NextResponse.json({ error: "Não foi possível carregar os estilos." }, { status: 502 });
  }
}
