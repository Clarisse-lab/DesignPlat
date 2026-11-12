// Link fixo do relatório semanal do cliente (sem login: o token do link é a chave).
// GET ?periodo=semana:YYYY-MM-DD | mes:YYYY-MM-DD (ou ?semana=YYYY-MM-DD): o período pedido entre os publicados.
// Sem período, o mais recente (semana ou mês, o que terminou por último). Rascunho nunca aparece aqui.

import { NextResponse } from "next/server";
import { trafegoParaView } from "@/lib/relatorio/meta";
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
    const busca = new URL(request.url).searchParams;
    const [tipoPedido, inicioPedido] = (busca.get("periodo") ?? `semana:${busca.get("semana") ?? ""}`).split(":");
    const recentes = [...publicados].sort((a, b) => b.semana_fim.localeCompare(a.semana_fim) || (a.tipo === "mes" ? -1 : 1));
    const semana = publicados.find((r) => (r.tipo ?? "semana") === tipoPedido && r.semana_inicio === inicioPedido) ?? recentes[0];
    const [capas, nome] = await Promise.all([urlsDasImagens(semana.dados), nomeDoCliente(cliente)]);
    const foto = semana.dados.foto_perfil ? (capas[semana.dados.foto_perfil] ?? null) : null;
    // A equipe abrindo pela prévia não conta como visualização do cliente.
    if (!request.headers.get("x-equipe")) await rpc("relatorio_visto", { p_id: semana.id }).catch(() => null);
    const view: RelatorioView = {
      cliente: { nome, foto },
      semana: {
        tipo: semana.tipo ?? "semana",
        semana_inicio: semana.semana_inicio,
        semana_fim: semana.semana_fim,
        // As tarefas do ClickUp são internas: o cliente recebe só a contagem do que foi produzido.
        dados: { ...semana.dados, meta_ads: semana.dados.meta_ads ? { ...semana.dados.meta_ads, contas: [] } : null, trabalho: semana.dados.trabalho ? { ...semana.dados.trabalho, feitas: [], andamento: [], proximas: [] } : null },
        textos: semana.textos,
        ...trafegoParaView(semana.dados, semana.trafego),
        entregas: semana.entregas ?? [],
        secoes: semana.secoes ?? {},
      },
      capas,
      semanas: recentes.map((r) => ({ tipo: r.tipo ?? "semana", inicio: r.semana_inicio, fim: r.semana_fim })),
    };
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[r/token]", error);
    return NextResponse.json({ error: "Não foi possível abrir o relatório agora." }, { status: 502 });
  }
}

