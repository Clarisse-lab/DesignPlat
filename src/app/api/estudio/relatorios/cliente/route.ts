// Configuração do relatório de cada cliente: as cores (tema) e os perfis do nicho.
// GET ?cliente=slug → { tema, cores, nicho_perfis }   (tema = o que vale hoje; cores = o que a equipe escolheu)
// PUT { cliente, cores?: {escuro, destaque} | null, nicho_perfis?: string[] }

import { NextResponse } from "next/server";
import { z } from "zod";
import { isResponse, requireMember } from "@/lib/server/auth";
import { nichoPerfis, salvarCores, salvarNichoPerfis, temaDoCliente } from "@/lib/server/relatorios";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9-]{2,60}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export async function GET(request: Request) {
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  const cliente = new URL(request.url).searchParams.get("cliente") ?? "";
  if (!SLUG.test(cliente)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  const [tema, perfis, cli] = await Promise.all([
    temaDoCliente(cliente),
    nichoPerfis(cliente),
    rest<{ relatorio_cores: { escuro: string; destaque: string } | null }[]>(`clientes?slug=eq.${cliente}&select=relatorio_cores&limit=1`).catch(() => []),
  ]);
  return NextResponse.json({ tema, cores: cli[0]?.relatorio_cores ?? null, nicho_perfis: perfis });
}

const putSchema = z.object({
  cliente: z.string().regex(SLUG),
  cores: z.object({ escuro: z.string().regex(HEX), destaque: z.string().regex(HEX) }).nullable().optional(),
  nicho_perfis: z
    .array(z.string().transform((s) => s.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "")))
    .max(40)
    .optional(),
});

export async function PUT(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { cliente, cores, nicho_perfis } = parsed.data;
  try {
    if (cores !== undefined) await salvarCores(cliente, cores);
    if (nicho_perfis !== undefined) {
      const perfis = [...new Set((nicho_perfis as string[]).filter((p) => /^[a-zA-Z0-9._]{1,30}$/.test(p)).map((p) => p.toLowerCase()))];
      await salvarNichoPerfis(cliente, perfis);
    }
    return NextResponse.json({ tema: await temaDoCliente(cliente) });
  } catch (error) {
    console.error("[relatorios/cliente]", error);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
