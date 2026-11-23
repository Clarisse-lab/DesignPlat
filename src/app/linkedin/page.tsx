import type { Metadata } from "next";

export const metadata: Metadata = { title: "LinkedIn · Mantora Lab", robots: { index: false } };

// Página pública: a volta da conexão com o LinkedIn (função linkedin-auth do Supabase redireciona para cá,
// porque o Supabase não deixa uma função mostrar página HTML). Só mostra mensagens fixas, escolhidas pelo código `r`.
const MENSAGENS: Record<string, { titulo: string; texto: (p: { n: string; nome: string }) => string; ok: boolean }> = {
  paginas: {
    titulo: "LinkedIn conectado",
    texto: ({ n, nome }) =>
      `Pronto${nome ? `, ${nome}` : ""}! ${n} página(s) que você administra foram conectadas. A equipe da Mantora liga cada uma ao cliente certo. Pode fechar esta aba.`,
    ok: true,
  },
  perfil: {
    titulo: "LinkedIn conectado",
    texto: ({ nome }) => `Pronto${nome ? `, ${nome}` : ""}! Os números dos seus posts vão aparecer no relatório da Mantora. Pode fechar esta aba.`,
    ok: true,
  },
  "sem-paginas": {
    titulo: "Nenhuma página encontrada",
    texto: ({ nome }) =>
      `A conta${nome ? ` "${nome}"` : ""} entrou, mas o LinkedIn não mostrou nenhuma página em que ela seja administradora. Confira se está logado no perfil certo e peça um link novo.`,
    ok: false,
  },
  cancelado: { titulo: "Conexão cancelada", texto: () => "Nada foi conectado. Se quiser tentar de novo, é só abrir o mesmo link.", ok: false },
  recusado: { titulo: "Não deu para conectar", texto: () => "O LinkedIn recusou a conexão. Fale com a equipe da Mantora para receber um link novo.", ok: false },
  vencido: { titulo: "Link vencido ou já usado", texto: () => "Cada link serve uma vez e vale 7 dias. Peça um link novo para a equipe da Mantora.", ok: false },
  invalido: { titulo: "Link inválido", texto: () => "Peça um link novo para a equipe da Mantora.", ok: false },
  erro: { titulo: "Não deu para conectar", texto: () => "Algo falhou do nosso lado. Avise a equipe da Mantora; o link novo resolve.", ok: false },
};

export default async function LinkedinRetorno({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const m = MENSAGENS[um(sp.r)] ?? MENSAGENS.erro;
  const n = /^\d{1,3}$/.test(um(sp.n)) ? um(sp.n) : "As";
  const nome = um(sp.nome).replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 60);
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-10">
      <div className="max-w-md rounded-2xl border border-line bg-surface p-8">
        <p className="mb-2 text-[12px] uppercase tracking-[0.08em] text-ink-faint">Mantora Lab</p>
        <h1 className={`mb-3 text-[22px] font-semibold ${m.ok ? "text-ink" : "text-red-700"}`}>{m.titulo}</h1>
        <p className="text-[15px] leading-relaxed text-ink-soft">{m.texto({ n, nome })}</p>
      </div>
    </main>
  );
}
