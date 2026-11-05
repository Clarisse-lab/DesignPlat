// Peças e templates salvos do estúdio (tabela design_pecas). Toda a equipe vê e edita.

import { NextResponse } from "next/server";
import { z } from "zod";
import { isResponse, requireMember } from "@/lib/server/auth";
import { extractImages, type Json } from "@/lib/server/pecas";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FERRAMENTAS = ["feed", "story", "apresentacao", "tweet"] as const;
const MAX_JSON_SEM_IMAGENS = 1_000_000;

const saveSchema = z.object({
  id: z.string().uuid().nullish(),
  ferramenta: z.enum(FERRAMENTAS),
  titulo: z.string().trim().min(1).max(120),
  cliente_slug: z.string().regex(/^[a-z0-9-]{2,60}$/).nullish(),
  template: z.boolean().default(false),
  dados: z.record(z.string(), z.unknown()),
});

/** GET: lista (sem os dados), filtrável por ferramenta, cliente e template. */
export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const params = new URL(request.url).searchParams;
  const filtros = ["select=id,ferramenta,titulo,cliente_slug,template,atualizado_em,atualizado_por", "order=atualizado_em.desc", "limit=200"];
  const ferramenta = params.get("ferramenta");
  if (ferramenta && (FERRAMENTAS as readonly string[]).includes(ferramenta)) filtros.push(`ferramenta=eq.${ferramenta}`);
  const cliente = params.get("cliente");
  if (cliente && /^[a-z0-9-]{2,60}$/.test(cliente)) filtros.push(`cliente_slug=eq.${cliente}`);
  const template = params.get("template");
  if (template === "1" || template === "0") filtros.push(`template=eq.${template === "1"}`);
  try {
    return NextResponse.json({ pecas: await rest(`design_pecas?${filtros.join("&")}`) });
  } catch (error) {
    console.error("[estudio/pecas] lista:", error);
    return NextResponse.json({ error: "Não foi possível listar as peças." }, { status: 502 });
  }
}

/** POST: salva (cria ou atualiza pelo id). As imagens vão para o Storage. */
export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos para salvar." }, { status: 400 });
  const { id, ferramenta, titulo, cliente_slug, template, dados } = parsed.data;
  try {
    const semImagens = await extractImages(dados as Json);
    if (JSON.stringify(semImagens).length > MAX_JSON_SEM_IMAGENS) {
      return NextResponse.json({ error: "Peça grande demais para salvar." }, { status: 413 });
    }
    const autor = member.nome || member.email || null;
    const linha = { ferramenta, titulo, cliente_slug: cliente_slug ?? null, template, dados: semImagens, atualizado_por: autor, atualizado_em: new Date().toISOString() };
    const rows = id
      ? await rest<{ id: string; atualizado_em: string }[]>(`design_pecas?id=eq.${id}&select=id,atualizado_em`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(linha),
        })
      : await rest<{ id: string; atualizado_em: string }[]>("design_pecas?select=id,atualizado_em", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ ...linha, criado_por: autor }),
        });
    if (!rows[0]) return NextResponse.json({ error: "Peça não encontrada (pode ter sido apagada)." }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[estudio/pecas] salvar:", error);
    return NextResponse.json({ error: `Não foi possível salvar: ${String(error).slice(0, 200)}` }, { status: 502 });
  }
}
