import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso · Design Mantora" };

// Página pública (exigida pelo Google para a conexão com o Drive).
export default function TermosPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-8 text-[15px] leading-relaxed">
      <h1 className="text-[24px] font-bold">Termos de uso</h1>
      <p className="text-[13px] text-ink-faint">Design Mantora · Mantora Lab · atualizados em 11/11/2026</p>
      <p>
        O Design Mantora é uma ferramenta interna da Mantora Lab, de uso exclusivo da equipe da agência para criar, aprovar e entregar
        posts dos clientes da agência. O acesso é liberado pela própria agência e pode ser retirado a qualquer momento.
      </p>
      <p>
        Os clientes que recebem um link de aprovação podem ver o post, comentar e aprovar ou pedir ajustes. O link é pessoal e não deve
        ser repassado.
      </p>
      <p>O conteúdo dos posts pertence aos clientes da agência, conforme os contratos de cada um.</p>
      <p>Contato: equipe.mantoralab@gmail.com.</p>
    </article>
  );
}
