"use client";

// Peças de interface compartilhadas pelos editores (Carrossel Tweet, Post de Feed…).

import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { useRef } from "react";
import { SlideFrame } from "@/components/SlideFrame";
import { imageFileToDataUrl } from "@/lib/client/image";

type Icon = React.ComponentType<{ className?: string }>;

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] outline-none transition-colors placeholder:text-ink-faint focus:border-accent";

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-ink-faint">{title}</h2>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-canvas p-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors ${
            value === option.value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ToolbarButton({
  onClick,
  disabled,
  busy,
  icon: IconComponent,
  children,
  primary,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon: Icon;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${
        primary
          ? "bg-ink text-white hover:bg-ink/90"
          : "border border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink"
      }`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <IconComponent className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  icon: IconComponent,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: Icon;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-soft transition-colors disabled:opacity-30 ${
        danger ? "hover:border-danger hover:text-danger" : "hover:border-line-strong hover:text-ink"
      }`}
    >
      <IconComponent className="h-4 w-4" />
    </button>
  );
}

export type NoticeMessage = { kind: "error" | "info"; text: string };

export function Notice({ message, onClose }: { message: NoticeMessage | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={`mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-[13px] ${
        message.kind === "error" ? "bg-orange-50 text-danger" : "bg-accent-soft text-accent"
      }`}
    >
      {message.text}
      <button type="button" onClick={onClose} aria-label="Fechar aviso">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Faixa horizontal com os slides, para escolher qual editar. */
export function SlideStrip({
  items,
  activeIndex,
  onSelect,
  onAdd,
  canAdd,
}: {
  items: { id: string; label: string; preview: string }[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  canAdd: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Slides · {items.length}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-accent hover:bg-accent-soft disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, index) => (
          <li key={item.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onSelect(index)}
              className={`flex h-[76px] w-[150px] flex-col rounded-xl border p-2.5 text-left transition-colors ${
                index === activeIndex ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"
              }`}
            >
              <span className={`text-[11px] font-bold ${index === activeIndex ? "text-accent" : "text-ink-soft"}`}>
                {index + 1}. {item.label || "Sem rótulo"}
              </span>
              <span className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-ink-faint">
                {item.preview.replace(/\*\*/g, "") || "Vazio"}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Preview fiel do slide ativo, com navegação entre slides. */
export function PreviewPane({
  html,
  width,
  height,
  index,
  total,
  onNavigate,
}: {
  html: string;
  width: number;
  height: number;
  index: number;
  total: number;
  onNavigate: (index: number) => void;
}) {
  return (
    <div className="xl:sticky xl:top-6">
      <div className="mx-auto max-w-[400px]">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Preview</span>
          <span className="text-[12px] text-ink-faint">
            {width}×{height}
          </span>
        </div>
        <SlideFrame html={html} width={width} height={height} className="rounded-2xl border border-line shadow-sm" />
        <div className="mt-3 flex items-center justify-between">
          <IconButton label="Slide anterior" onClick={() => onNavigate(Math.max(0, index - 1))} disabled={index === 0} icon={ChevronLeft} />
          <span className="text-[12.5px] text-ink-soft">
            {index + 1} / {total}
          </span>
          <IconButton
            label="Próximo slide"
            onClick={() => onNavigate(Math.min(total - 1, index + 1))}
            disabled={index === total - 1}
            icon={ChevronRight}
          />
        </div>
      </div>
    </div>
  );
}

/** Escolha de imagem com miniatura, redimensionada no navegador antes de usar. */
export function ImagePicker({
  value,
  onChange,
  onError,
  label,
  maxSide = 1400,
  square = false,
}: {
  value: string | null | undefined;
  onChange: (dataUrl: string | null) => void;
  onError: (message: string) => void;
  label: string;
  maxSide?: number;
  square?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await imageFileToDataUrl(file, { maxSide, square }));
    } catch {
      onError("Não foi possível ler essa imagem.");
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-line p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-12 w-16 rounded-md object-cover" />
          <span className="flex-1 text-[12.5px] text-ink-soft">{label}</span>
          <IconButton label="Remover imagem" onClick={() => onChange(null)} icon={X} danger />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[12.5px] text-ink-soft hover:text-ink"
        >
          <ImagePlus className="h-4 w-4" /> {label}
        </button>
      )}
    </div>
  );
}

// Operações de lista usadas pelos editores de slides.
export function insertAt<T>(list: T[], index: number, item: T): T[] {
  const next = [...list];
  next.splice(index, 0, item);
  return next;
}

export function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
