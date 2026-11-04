import { NextResponse } from "next/server";
import { isMetaImageUrl } from "@/lib/reference/identity";
import { isResponse, requireMember } from "@/lib/server/auth";

export const runtime = "nodejs";

const MAX_BYTES = 10_000_000;

/** GET /api/estudio/foto?url=… baixa uma imagem do Instagram (só domínios da Meta) para o navegador usar. */
export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!isMetaImageUrl(url)) return NextResponse.json({ error: "Imagem não permitida." }, { status: 400 });
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) throw new Error(`resposta ${response.status} ${type}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) throw new Error("imagem grande demais");
    return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    console.error("[estudio/foto]", error);
    return NextResponse.json({ error: "Não foi possível baixar a foto." }, { status: 502 });
  }
}
