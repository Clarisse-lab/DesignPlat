"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mostra um documento HTML de tamanho fixo (ex.: 1080×1440) reduzido para caber
 * na largura disponível. É o mesmo HTML que o servidor transforma em PNG,
 * então o preview é fiel à imagem final.
 */
export function SlideFrame({ html, width, height, className = "" }: { html: string; width: number; height: number; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setDisplayWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = displayWidth / width;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {displayWidth > 0 && (
        <iframe
          title="Preview do slide"
          srcDoc={html}
          // Sem allow-scripts: o HTML não executa nada. allow-same-origin permite carregar /fonts.
          sandbox="allow-same-origin"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 border-0"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        />
      )}
    </div>
  );
}
