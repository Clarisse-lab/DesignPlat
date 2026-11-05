import Link from "next/link";
import { ArrowUpRight, GalleryHorizontal, Presentation, RectangleVertical, Square } from "lucide-react";

const TOOLS = [
  { href: "/tweet", title: "Carrossel Tweet", description: "Slides no estilo post do X/Twitter, escritos com IA e exportados em PNG.", icon: GalleryHorizontal, art: "tweet", line: <>Texto que<br />vira conversa.</> },
  { href: "/feed", title: "Post de Feed", description: "Posts e carrosséis para o Instagram com a identidade da sua marca, a partir do texto do conteúdo.", icon: Square, art: "feed", line: <>M<em>ideias<br />em ação.</em></> },
  { href: "/story", title: "Story", description: "Sequências de stories 9:16 com a mesma identidade do feed, com espaço para enquete, perguntas e link.", icon: RectangleVertical, art: "story", line: <>seu<br />próximo<br />sinal.</> },
  { href: "/apresentacao", title: "Apresentação", description: "Slides 16:9 com a identidade da marca, para baixar em PDF, PowerPoint (PPTX) ou imagens.", icon: Presentation, art: "presentation", line: <>01<small>Uma ideia<br />bem apresentada.</small></> },
];

export default function Home() {
  return (
    <div className="mosaic-home">
      <section className="mosaic-welcome">
        <p className="mosaic-eyebrow">UM ESPAÇO PARA FAZER ACONTECER</p>
        <div className="mosaic-welcome-row">
          <h1>Vamos criar<br /><span>o próximo sinal.</span></h1>
          <p>Ideias não precisam esperar.<br />Seu estúdio está pronto.</p>
          <span className="mosaic-disc" aria-hidden="true">m<span>✳</span></span>
        </div>
      </section>
      <section className="mosaic-tools" aria-label="Escolha uma ferramenta">
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.href} href={tool.href} className={`mosaic-tool mosaic-tool-${tool.art}`}>
              <div className="mosaic-tool-top"><span>0{index + 1} / CRIAR</span><Icon className="h-5 w-5" aria-hidden="true" /></div>
              <div className={`mosaic-art mosaic-art-${tool.art}`} aria-hidden="true"><span>{tool.line}</span></div>
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
              <span className="mosaic-tool-open">Criar agora <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
            </Link>
          );
        })}
      </section>
      <footer className="mosaic-footer"><span>MANTORA LAB®</span><span>DA IDEIA À PUBLICAÇÃO.</span></footer>
    </div>
  );
}
