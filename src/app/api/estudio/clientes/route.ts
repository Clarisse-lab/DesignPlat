import { NextResponse } from "next/server";
import { isResponse, requireMember } from "@/lib/server/auth";
import { rest, supabaseConfigured } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface KitRow {
  cliente_slug: string;
  status: "sugerido" | "confirmado";
  marca: { name: string; handle: string; logo: string | null };
  estilo: Record<string, unknown>;
  layouts: string[];
}

/** Clientes da agência com o kit de marca de cada um (lido e confirmado no Escritório). */
export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  if (!supabaseConfigured()) return NextResponse.json({ clientes: [] });
  try {
    const [clientes, kits] = await Promise.all([
      rest<{ slug: string; nome: string }[]>("clientes?select=slug,nome&order=nome"),
      rest<KitRow[]>("kits_marca?select=cliente_slug,status,marca,estilo,layouts"),
    ]);
    const porSlug = new Map(kits.map((k) => [k.cliente_slug, k]));
    return NextResponse.json({
      clientes: clientes.map((c) => {
        const kit = porSlug.get(c.slug);
        return { slug: c.slug, nome: c.nome, kit: kit ? { status: kit.status, marca: kit.marca, estilo: kit.estilo, layouts: kit.layouts } : null };
      }),
    });
  } catch (error) {
    console.error("[estudio/clientes]", error);
    return NextResponse.json({ error: "Não foi possível carregar os clientes." }, { status: 502 });
  }
}
