"use client";

// "Ver todas": o carrossel inteiro numa grade, como na grade do Instagram de quem revisa.
// Cada tela é o mesmo HTML do preview (fiel ao PNG). Clicar numa tela abre ela no editor.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SlideFrame } from "@/components/SlideFrame";

const COLUMN_OPTIONS = [3, 4, 5] as const;

export function AllSlidesView({
  htmls,
  width,
  height,
  activeIndex,
  onPick,
  onClose,
}: {
  htmls: string[];
  width: number;
  height: number;
  activeIndex: number;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const [columns, setColumns] = useState<(typeof COLUMN_OPTIONS)[number]>(htmls.length <= 6 ? 3 : 5);

  // Esc fecha.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8" onClick={onClose} role="dialog" aria-label="Todas as telas">
      <div className="w-full max-w-[1400px] rounded-2xl bg-surface p-4 shadow-xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Todas as telas · {htmls.length}</h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-canvas p-1" aria-label="Telas por linha">
              {COLUMN_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setColumns(n)}
                  className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium ${columns === n ? "bg-surface text-ink shadow-sm" : "text-ink-soft"}`}
                >
                  {n} por linha
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-soft hover:bg-canvas hover:text-ink" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {htmls.map((html, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              className={`group relative overflow-hidden rounded-xl border-2 text-left ${i === activeIndex ? "border-accent" : "border-transparent hover:border-line"}`}
              title={`Abrir a tela ${i + 1} no editor`}
            >
              <SlideFrame html={html} width={width} height={height} />
              {/* O iframe não deixa o clique chegar ao botão: esta camada recebe o clique. */}
              <span className="absolute inset-0" />
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{i + 1}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-ink-faint">Clique numa tela para abrir no editor. Esc fecha.</p>
      </div>
    </div>
  );
}
