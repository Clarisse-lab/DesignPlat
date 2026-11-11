// Link fixo do relatório semanal do cliente (sem login: o token do link é a chave).
// GET ?semana=YYYY-MM-DD: a semana pedida (ou a mais recente) entre as publicadas. Rascunho nunca aparece aqui.

import { NextResponse } from "next/server";
import type { RelatorioView } from "@/lib/relatorio/tipos";
import { clienteDoToken, doCliente, nomeDoCliente, urlsDasImagens } from "@/lib/server/relatorios";
import { rpc } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  try {
    const cliente = await clienteDoToken(token);
    if (!cliente) return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
    const publicados = await doCliente(cliente, true);
    if (!publicados.length) return NextResponse.json({ error: "O primeiro relatório ainda não foi publicado." }, { status: 404 });
    const pedida = new URL(request.url).searchParams.get("semana");
    const semana = publicados.find((r) => r.semana_inicio === pedida) ?? publicados[0];
    const [capas, nome] = await Promise.all([urlsDasImagens(semana.dados), nomeDoCliente(cliente)]);
    const foto = semana.dados.foto_perfil ? (capas[semana.dados.foto_perfil] ?? null) : null;
    // A equipe abrindo pela prévia não conta como visualização do cliente.
    if (!request.headers.get("x-equipe")) await rpc("relatorio_visto", { p_id: semana.id }).catch(() => null);
    const view: RelatorioView = {
      cliente: { nome, foto },
      semana: {
        semana_inicio: semana.semana_inicio,
        semana_fim: semana.semana_fim,
        dados: semana.dados,
        textos: semana.textos,
        trafego: semana.trafego ?? {},
        entregas: semana.entregas ?? [],
        secoes: semana.secoes ?? {},
      },
      capas,
      semanas: publicados.map((r) => ({ inicio: r.semana_inicio, fim: r.semana_fim })),
    };
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[r/token]", error);
    return NextResponse.json({ error: "Não foi possível abrir o relatório agora." }, { status: 502 });
  }
}

