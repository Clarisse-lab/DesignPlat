import Link from "next/link";
import { ArrowRight, GalleryHorizontal, Presentation, RectangleVertical, Square } from "lucide-react";

const TOOLS = [
  {
    href: "/tweet",
    title: "Carrossel Tweet",
    description: "Slides no estilo post do X/Twitter, escritos com IA e exportados em PNG.",
    icon: GalleryHorizontal,
    ready: true,
  },
  {
    href: "/feed",
    title: "Post de Feed",
    description: "Posts e carrosséis para o Instagram com a identidade da sua marca, a partir do texto do conteúdo.",
    icon: Square,
    ready: true,
  },
  {
    title: "Story",
    description: "Sequências de stories 9:16 geradas a partir do mesmo conteúdo.",
    icon: RectangleVertical,
    ready: false,
  },
  {
    title: "Apresentação",
    description: "Decks de slides exportáveis em PPTX e PDF.",
    icon: Presentation,
    ready: false,
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">O que vamos criar hoje?</h1>
      <p className="mt-3 max-w-xl text-[15px] text-ink-soft">
        Escreva ou gere o conteúdo uma vez e transforme em peças prontas para publicar.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const content = (
            <>
              <div className="flex items-start justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                {tool.ready ? (
                  <ArrowRight className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                ) : (
                  <span className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-faint">Em breve</span>
                )}
              </div>
              <h2 className="mt-5 text-[16px] font-bold">{tool.title}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{tool.description}</p>
            </>
          );
          return tool.ready && tool.href ? (
            <Link
              key={tool.title}
              href={tool.href}
              className="group rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong"
            >
              {content}
            </Link>
          ) : (
            <div key={tool.title} className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 opacity-80">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
