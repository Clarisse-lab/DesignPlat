// Contas de anúncio do Meta de cada cliente, para o relatório puxar o tráfego sozinho.
// GET ?cliente=slug: as contas que o token enxerga e as escolhidas para o cliente.
// PUT { cliente, contas }: grava as contas do cliente.

import { NextResponse } from "next/server";
import { z } from "zod";
import { isResponse, requireMember } from "@/lib/server/auth";
import { contasDisponiveis, contasDoCliente, salvarContas } from "@/lib/server/meta-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9-]{2,60}$/;

export async function GET(request: Request) {
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  const cliente = new URL(request.url).searchParams.get("cliente") ?? "";
  if (!SLUG.test(cliente)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  try {
    const [contas, escolhidas] = await Promise.all([contasDisponiveis(), contasDoCliente(cliente)]);
    return NextResponse.json({ ligado: true, contas, escolhidas });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    const ligado = !/não encontrado/.test(msg);
    return NextResponse.json({ ligado, contas: [], escolhidas: await contasDoCliente(cliente), error: ligado ? msg || "Falha ao ler o Meta." : undefined });
  }
}

const putSchema = z.object({
  cliente: z.string().regex(SLUG),
  contas: z.array(z.string().regex(/^act_\d{5,25}$/)).max(10),
});

export async function PUT(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Contas inválidas." }, { status: 400 });
  try {
    await salvarContas(parsed.data.cliente, [...new Set<string>(parsed.data.contas as string[])]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[relatorios/meta]", error);
    return NextResponse.json({ error: "Não foi possível salvar as contas." }, { status: 500 });
  }
}
