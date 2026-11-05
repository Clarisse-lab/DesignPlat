"use client";

// Editor do layout Livre: fundo e sombra, modelos prontos, lista de elementos e as propriedades
// do elemento selecionado. Os elementos também podem ser arrastados na prévia (FreeHandles).

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { ImageAiDialog } from "@/components/editor/ImageAiDialog";
import { ImageSourceButtons, type ImageAiBase } from "@/components/editor/ImageSourceButtons";
import { Field, inputClass, Segmented } from "@/components/editor/ui";
import {
  FREE_COLOR_LABELS,
  FREE_COLORS,
  FREE_ELEMENT_KINDS,
  FREE_ELEMENT_LABELS,
  FREE_GRID_LABELS,
  FREE_GRIDS,
  gridSlots,
  FREE_HIGHLIGHT_LABELS,
  FREE_HIGHLIGHTS,
  FREE_OVERLAY_LABELS,
  FREE_OVERLAYS,
  FREE_PRESETS,
  newElementId,
  newFreeElement,
  type FreeElement,
  type FreeSlide,
} from "@/lib/templates/free";

const TEXT_KINDS = new Set(["titulo", "texto", "etiqueta", "arraste"]);
const SIZED_KINDS = new Set(["imagem", "cartao", "grade"]);
const NO_TEXT_KINDS = new Set(["imagem", "cartao", "grade"]);

export const EMPTY_FREE: FreeSlide = { bg: "fundo", overlay: "nenhuma", elements: [] };

function Slider({ label, value, min, max, step = 1, suffix = "", onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-[12px] text-ink-soft">
        {label}
        <span className="tabular-nums text-ink-faint">
          {Math.round(value * 10) / 10}
          {suffix}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-accent" />
    </label>
  );
}

export function FreeEditor({
  free,
  title,
  body,
  hasImage,
  selectedId,
  onSelect,
  onChange,
  onError,
  imageControls,
  imageAi,
  image,
  onImage,
  onSpread,
}: {
  free: FreeSlide;
  /** Título e texto do slide, usados ao aplicar um modelo. */
  title: string;
  body: string;
  hasImage: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (free: FreeSlide) => void;
  onError: (message: string) => void;
  /** Botões de foto de fundo (upload, banco, IA, fotos do cliente), vindos do SlideFields. */
  imageControls: React.ReactNode;
  /** Contexto da IA de imagem (null: login desligado). */
  imageAi: ImageAiBase | null;
  /** Foto de fundo do slide e como trocá-la (panorama gerado com IA). */
  image: string | null;
  onImage: (image: string) => void;
  /** Carrossel infinito: espalha a foto de fundo por `total` slides a partir deste. */
  onSpread: (total: number) => void;
}) {
  const [spreadTotal, setSpreadTotal] = useState(3);
  const [widePanorama, setWidePanorama] = useState(false);
  const selected = free.elements.find((el) => el.id === selectedId) ?? null;
  const textRef = useRef<HTMLTextAreaElement>(null);

  const setElements = (elements: FreeElement[]) => onChange({ ...free, elements });
  const update = (id: string, patch: Partial<FreeElement>) => setElements(free.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  const move = (id: string, delta: -1 | 1) => {
    const i = free.elements.findIndex((el) => el.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= free.elements.length) return;
    const next = [...free.elements];
    [next[i], next[j]] = [next[j], next[i]];
    setElements(next);
  };
  const add = (kind: FreeElement["kind"]) => {
    const el = newFreeElement(kind);
    setElements([...free.elements, el]);
    onSelect(el.id);
  };

  return (
    <div className="space-y-4">
      <Field label="Modelo pronto (ponto de partida)">
        <div className="flex flex-wrap gap-1.5">
          {FREE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (free.elements.length && !window.confirm(`Trocar os elementos deste slide pelo modelo "${preset.label}"?`)) return;
                const next = preset.build({ title, body, hasImage });
                onChange(next);
                onSelect(next.elements.find((el) => el.kind === "titulo")?.id ?? null);
              }}
              className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:border-accent hover:text-accent"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="space-y-3 rounded-xl border border-line p-3">
        <Field label="Fundo">
          <Segmented
            value={free.bg}
            options={[
              { value: "fundo", label: "Cor de fundo" },
              { value: "destaque", label: "Cor de destaque" },
              { value: "foto", label: "Foto" },
            ]}
            onChange={(bg) => onChange({ ...free, bg })}
          />
        </Field>
        {free.bg === "foto" && (
          <>
            {imageControls}
            <Field label="Sombra sobre a foto">
              <select value={free.overlay} onChange={(e) => onChange({ ...free, overlay: e.target.value as FreeSlide["overlay"] })} className={inputClass}>
                {FREE_OVERLAYS.map((o) => (
                  <option key={o} value={o}>
                    {FREE_OVERLAY_LABELS[o]}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        {free.bg === "foto" && (
          <div className="space-y-2 rounded-lg bg-canvas p-2.5">
            <span className="block text-[12.5px] font-medium text-ink-soft">Carrossel infinito</span>
            {free.pan ? (
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-soft">
                Pedaço {free.pan.part + 1} de {free.pan.total} da foto contínua.
                <button type="button" onClick={() => onChange({ ...free, pan: null })} className="rounded-md border border-line px-2 py-1 hover:text-ink">
                  Mostrar a foto inteira neste slide
                </button>
              </div>
            ) : (
              <>
                <p className="text-[11.5px] text-ink-faint">Uma foto larga que continua de um slide para o outro. Use uma foto panorâmica ou gere uma.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={spreadTotal} onChange={(e) => setSpreadTotal(Number(e.target.value))} className={`${inputClass} w-auto`}>
                    {[2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} slides
                      </option>
                    ))}
                  </select>
                  {imageAi && (
                    <button type="button" onClick={() => setWidePanorama(true)} className="rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1.5 text-[12px] font-medium text-accent">
                      Gerar foto larga com IA
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!image}
                    onClick={() => onSpread(spreadTotal)}
                    className="rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
                  >
                    Espalhar a foto por {spreadTotal} slides
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <input type="checkbox" checked={Boolean(free.progress)} onChange={(e) => onChange({ ...free, progress: e.target.checked })} className="h-4 w-4 accent-accent" />
          Barrinhas de progresso no topo
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-ink-soft">Elementos (de trás para a frente)</span>
        </div>
        <ul className="space-y-1">
          {free.elements.map((el, i) => (
            <li key={el.id}>
              <div
                className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${el.id === selectedId ? "border-accent bg-accent-soft" : "border-line"}`}
              >
                <button type="button" onClick={() => onSelect(el.id)} className="min-w-0 flex-1 truncate text-left text-[12.5px]">
                  <b className="font-semibold">{FREE_ELEMENT_LABELS[el.kind]}</b>
                  {el.text ? <span className="text-ink-faint"> · {el.text.replace(/\*\*/g, "")}</span> : null}
                </button>
                <button type="button" title="Para trás" aria-label="Para trás" onClick={() => move(el.id, -1)} disabled={i === 0} className="rounded p-1 text-ink-faint hover:text-ink disabled:opacity-30">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" title="Para a frente" aria-label="Para a frente" onClick={() => move(el.id, 1)} disabled={i === free.elements.length - 1} className="rounded p-1 text-ink-faint hover:text-ink disabled:opacity-30">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Duplicar"
                  aria-label="Duplicar"
                  onClick={() => {
                    const copy = { ...el, id: newElementId(), y: Math.min(95, el.y + 4) };
                    setElements([...free.elements.slice(0, i + 1), copy, ...free.elements.slice(i + 1)]);
                    onSelect(copy.id);
                  }}
                  className="rounded p-1 text-ink-faint hover:text-ink"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Excluir"
                  aria-label="Excluir"
                  onClick={() => {
                    setElements(free.elements.filter((x) => x.id !== el.id));
                    if (selectedId === el.id) onSelect(null);
                  }}
                  className="rounded p-1 text-ink-faint hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1.5">
          {FREE_ELEMENT_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => add(kind)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[12px] text-ink-soft hover:border-accent hover:text-accent"
            >
              <Plus className="h-3 w-3" /> {FREE_ELEMENT_LABELS[kind]}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-3">
          <span className="block text-[12px] font-bold uppercase tracking-wider text-accent">{FREE_ELEMENT_LABELS[selected.kind]} selecionado</span>

          {TEXT_KINDS.has(selected.kind) && (
            <Field label="Texto">
              <textarea
                ref={textRef}
                value={selected.text ?? ""}
                onChange={(e) => update(selected.id, { text: e.target.value })}
                rows={selected.kind === "texto" ? 4 : 2}
                className={`${inputClass} resize-y`}
              />
            </Field>
          )}
          {(selected.kind === "titulo" || selected.kind === "texto") && (
            <p className="-mt-2 text-[11.5px] text-ink-faint">Use **palavra** para destacar.</p>
          )}

          {selected.kind === "imagem" && (
            <ImageSourceButtons value={selected.image} onChange={(img) => update(selected.id, { image: img })} onError={onError} imageAi={imageAi} label="Imagem" />
          )}

          {selected.kind === "grade" && (
            <div className="space-y-2">
              <Field label="Arranjo">
                <select value={selected.grid ?? "2v"} onChange={(e) => update(selected.id, { grid: e.target.value as FreeElement["grid"] })} className={inputClass}>
                  {FREE_GRIDS.map((g) => (
                    <option key={g} value={g}>
                      {FREE_GRID_LABELS[g]}
                    </option>
                  ))}
                </select>
              </Field>
              {Array.from({ length: gridSlots(selected.grid) }, (_, i) => (
                <ImageSourceButtons
                  key={i}
                  label={`Foto ${i + 1}`}
                  value={selected.images?.[i] ?? null}
                  onChange={(img) => {
                    const images = [...(selected.images ?? [])];
                    while (images.length <= i) images.push(null);
                    images[i] = img;
                    update(selected.id, { images });
                  }}
                  onError={onError}
                  imageAi={imageAi}
                />
              ))}
              <Slider label="Espaço entre as fotos" value={selected.gap ?? 12} min={0} max={60} suffix="px" onChange={(gap) => update(selected.id, { gap })} />
            </div>
          )}

          {!NO_TEXT_KINDS.has(selected.kind) && (
            <Slider label="Tamanho da fonte" value={selected.size ?? 40} min={12} max={240} suffix="px" onChange={(size) => update(selected.id, { size })} />
          )}

          {!NO_TEXT_KINDS.has(selected.kind) && (
            <Segmented
              value={selected.align ?? "left"}
              options={[
                { value: "left", label: "Esquerda" },
                { value: "center", label: "Centro" },
                { value: "right", label: "Direita" },
              ]}
              onChange={(align) => update(selected.id, { align })}
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            {!NO_TEXT_KINDS.has(selected.kind) && (
              <Field label="Cor do texto">
                <select value={selected.color ?? "texto"} onChange={(e) => update(selected.id, { color: e.target.value as FreeElement["color"] })} className={inputClass}>
                  {FREE_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {FREE_COLOR_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {(selected.kind === "etiqueta" || selected.kind === "cartao") && (
              <Field label="Fundo">
                <select value={selected.fill ?? (selected.kind === "cartao" ? "branco" : "destaque")} onChange={(e) => update(selected.id, { fill: e.target.value as FreeElement["fill"] })} className={inputClass}>
                  {FREE_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {FREE_COLOR_LABELS[c]}
                    </option>
                  ))}
                  <option value="vidro">Vidro (transparente)</option>
                </select>
              </Field>
            )}
            {(selected.kind === "titulo" || selected.kind === "texto") && (
              <Field label="Palavras em **destaque**">
                <select value={selected.highlight ?? "cor"} onChange={(e) => update(selected.id, { highlight: e.target.value as FreeElement["highlight"] })} className={inputClass}>
                  {FREE_HIGHLIGHTS.map((h) => (
                    <option key={h} value={h}>
                      {FREE_HIGHLIGHT_LABELS[h]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {(selected.kind === "titulo" || selected.kind === "texto") && (
              <Field label="Fonte">
                <select
                  value={selected.font ?? (selected.kind === "titulo" ? "titulo" : "corpo")}
                  onChange={(e) => update(selected.id, { font: e.target.value as FreeElement["font"] })}
                  className={inputClass}
                >
                  <option value="titulo">Fonte dos títulos</option>
                  <option value="corpo">Fonte do texto</option>
                </select>
              </Field>
            )}
          </div>

          {TEXT_KINDS.has(selected.kind) && (
            <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
              <input type="checkbox" checked={Boolean(selected.upper)} onChange={(e) => update(selected.id, { upper: e.target.checked })} className="h-4 w-4 accent-accent" />
              Caixa alta
            </label>
          )}

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Slider label="Posição horizontal" value={selected.x} min={-10} max={100} step={0.5} suffix="%" onChange={(x) => update(selected.id, { x })} />
            <Slider label="Posição vertical" value={selected.y} min={-10} max={100} step={0.5} suffix="%" onChange={(y) => update(selected.id, { y })} />
            <Slider label="Largura" value={selected.w} min={5} max={120} step={0.5} suffix="%" onChange={(w) => update(selected.id, { w })} />
            {SIZED_KINDS.has(selected.kind) && (
              <Slider label="Altura" value={selected.h ?? 20} min={2} max={120} step={0.5} suffix="%" onChange={(h) => update(selected.id, { h })} />
            )}
            {SIZED_KINDS.has(selected.kind) && (
              <Slider label="Arredondado" value={selected.radius ?? 24} min={0} max={120} suffix="px" onChange={(radius) => update(selected.id, { radius })} />
            )}
          </div>
          <p className="text-[11.5px] text-ink-faint">Dica: arraste o elemento direto na prévia; a alça da direita muda a largura.</p>
        </div>
      )}

      {widePanorama && imageAi && (
        <ImageAiDialog
          context={{ ...imageAi, currentImage: null }}
          aspect={spreadTotal === 2 ? "16:9" : "21:9"}
          title={`Gerar foto larga para ${spreadTotal} slides`}
          onClose={() => setWidePanorama(false)}
          onUse={(img) => {
            onImage(img);
            setWidePanorama(false);
          }}
        />
      )}
    </div>
  );
}

/** Alças por cima da prévia para selecionar, arrastar e mudar a largura dos elementos. */
export function FreeHandles({
  free,
  canvasHeight,
  selectedId,
  onSelect,
  onChange,
}: {
  free: FreeSlide;
  canvasHeight: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (free: FreeSlide) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const startDrag = (event: React.PointerEvent, el: FreeElement, mode: "move" | "resize") => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(el.id);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const start = { x: event.clientX, y: event.clientY, ex: el.x, ey: el.y, ew: el.w };
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const round = (n: number) => Math.round(n * 2) / 2;
    // Um redesenho da prévia por quadro, no máximo (cada mudança remonta o HTML do slide).
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      if (!last) return;
      const dx = ((last.clientX - start.x) / rect.width) * 100;
      const dy = ((last.clientY - start.y) / rect.height) * 100;
      const patch = mode === "move" ? { x: round(start.ex + dx), y: round(start.ey + dy) } : { w: Math.max(5, round(start.ew + dx)) };
      onChange({ ...free, elements: free.elements.map((x) => (x.id === el.id ? { ...x, ...patch } : x)) });
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onUp = () => {
      if (frame) cancelAnimationFrame(frame);
      apply();
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  return (
    <div ref={ref} className="absolute inset-0" onPointerDown={() => onSelect(null)}>
      {free.elements.map((el) => {
        const textHeight = ((el.size ?? 40) * 1.25 * Math.max(1, (el.text ?? "").split("\n").length)) / canvasHeight * 100;
        const height = el.h ?? Math.max(3, el.kind === "perfil" ? ((el.size ?? 26) * 2.2) / canvasHeight * 100 : textHeight);
        const active = el.id === selectedId;
        return (
          <div
            key={el.id}
            onPointerDown={(e) => startDrag(e, el, "move")}
            title={FREE_ELEMENT_LABELS[el.kind]}
            className={`absolute cursor-move rounded-sm ${active ? "outline outline-2 outline-accent" : "outline-dashed outline-1 outline-white/0 hover:outline-white/70"}`}
            style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${height}%`, touchAction: "none" }}
          >
            {active && (
              <span
                onPointerDown={(e) => startDrag(e, el, "resize")}
                className="absolute -right-1.5 top-1/2 h-5 w-3 -translate-y-1/2 cursor-ew-resize rounded-sm bg-accent"
                style={{ touchAction: "none" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
