"use client";

import { useEffect, useRef, useState } from "react";

interface Frame {
  id: number;
  html: string;
  ready: boolean;
}

let nextFrameId = 1;

/**
 * Mostra um documento HTML de tamanho fixo (ex.: 1080×1440) reduzido para caber
 * na largura disponível. É o mesmo HTML que o servidor transforma em PNG,
 * então o preview é fiel à imagem final.
 *
 * Sem piscar: cada versão nova carrega num iframe escondido e só troca de lugar com a
 * anterior quando terminou de carregar. Mudanças rápidas (arrastar, digitar) guardam só
 * a versão mais recente na fila.
 */
export function SlideFrame({ html, width, height, className = "" }: { html: string; width: number; height: number; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [frames, setFrames] = useState<Frame[]>(() => [{ id: 0, html, ready: false }]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setDisplayWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // O HTML novo entra na fila; o iframe visível continua até o novo carregar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrames((current) => {
      if (current[current.length - 1]?.html === html) return current;
      const shown = current.find((f) => f.ready);
      const base = shown ? [shown] : current.slice(0, 1);
      if (base[0]?.html === html) return base;
      return [...base, { id: nextFrameId++, html, ready: false }];
    });
  }, [html]);

  const onLoad = (id: number) =>
    setFrames((current) => {
      const index = current.findIndex((f) => f.id === id);
      if (index < 0) return current;
      // Este ficou pronto: some com os anteriores e mantém só os que vieram depois (ainda carregando).
      return [{ ...current[index], ready: true }, ...current.slice(index + 1)];
    });

  const scale = displayWidth / width;

  return (
    <div ref={containerRef} className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      {displayWidth > 0 &&
        frames.map((frame) => (
          <iframe
            key={frame.id}
            title="Preview do slide"
            srcDoc={frame.html}
            // Sem allow-scripts: o HTML não executa nada. allow-same-origin permite carregar /fonts.
            sandbox="allow-same-origin"
            tabIndex={-1}
            aria-hidden
            onLoad={() => onLoad(frame.id)}
            className="pointer-events-none absolute left-0 top-0 border-0"
            style={{
              width,
              height,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              visibility: frame.ready ? "visible" : "hidden",
            }}
          />
        ))}
    </div>
  );
}
