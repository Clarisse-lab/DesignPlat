import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade · Design Mantora" };

// Página pública (exigida pelo Google para a conexão com o Drive).
export default function PrivacidadePage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-8 text-[15px] leading-relaxed">
      <h1 className="text-[24px] font-bold">Política de privacidade</h1>
      <p className="text-[13px] text-ink-faint">Design Mantora · Mantora Lab · atualizada em 11/11/2026</p>
      <p>
        O Design Mantora é a ferramenta interna da agência Mantora Lab para criar posts dos seus clientes. Ela é usada só pela equipe da
        agência, com login pela conta Google liberada pela própria agência.
      </p>
      <h2 className="text-[17px] font-bold">Dados que usamos</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Nome e e-mail da pessoa da equipe que entra (para o login e para registrar quem criou cada peça).</li>
        <li>Os posts criados (textos, imagens e vídeos), guardados no banco e no armazenamento da agência.</li>
        <li>Nos links de aprovação, o nome que o cliente digita e os comentários dele sobre o post.</li>
      </ul>
      <h2 className="text-[17px] font-bold">Google Drive</h2>
      <p>
        Quando a agência conecta o Google Drive, a ferramenta usa o acesso só para criar pastas e enviar os arquivos dos posts aprovados
        para a pasta do respectivo cliente. Ela não lê, não altera e não apaga outros arquivos. O acesso pode ser retirado a qualquer
        momento em myaccount.google.com/permissions.
      </p>
      <h2 className="text-[17px] font-bold">Compartilhamento</h2>
      <p>Os dados não são vendidos nem compartilhados com terceiros, além dos serviços que mantêm a ferramenta funcionando (hospedagem e banco de dados).</p>
      <h2 className="text-[17px] font-bold">Contato</h2>
      <p>Dúvidas ou pedidos de exclusão de dados: equipe.mantoralab@gmail.com.</p>
    </article>
  );
}
