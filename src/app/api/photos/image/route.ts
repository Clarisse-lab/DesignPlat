import { NextResponse } from "next/server";
import { isPexelsImageUrl } from "@/lib/photos/pexels";

export const runtime = "nodejs";

const MAX_BYTES = 15_000_000;

/**
 * GET /api/photos/image?url=https://images.pexels.com/... — baixa a foto escolhida
 * pelo servidor, para o navegador poder redimensioná-la e embuti-la no slide.
 */
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!isPexelsImageUrl(url)) return NextResponse.json({ error: "Imagem não permitida." }, { status: 400 });

  try {
    const response = await fetch(url, { cache: "no-store", redirect: "error" });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) throw new Error(`resposta ${response.status} ${type}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) throw new Error("imagem grande demais");
    return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    console.error("[photos/image] erro:", error);
    return NextResponse.json({ error: "Não foi possível baixar a foto." }, { status: 502 });
  }
}
