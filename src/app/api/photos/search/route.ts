import { NextResponse } from "next/server";
import { PhotosUnavailableError, searchPixabay } from "@/lib/photos/pixabay";

export const runtime = "nodejs";

/** GET /api/photos/search?q=café&page=1 — busca fotos gratuitas no Pixabay. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const page = Math.min(50, Math.max(1, Number(params.get("page")) || 1));
  if (query.length < 2) return NextResponse.json({ error: "Digite o que procura." }, { status: 400 });

  try {
    return NextResponse.json(await searchPixabay(query, page));
  } catch (error) {
    if (error instanceof PhotosUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[photos/search] erro:", error);
    return NextResponse.json({ error: "Não foi possível buscar fotos agora." }, { status: 502 });
  }
}
