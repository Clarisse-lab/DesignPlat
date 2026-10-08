"use client";

import { RotateCcw } from "lucide-react";
import { Field, inputClass, Panel, Segmented } from "@/components/editor/ui";
import { CANVAS_SIZES, FEED_CANVAS_SIZES } from "@/lib/formats";
import { FEED_DECOR_LABELS, FEED_DECORS, FEED_PALETTES, type FeedPalette, type FeedStyle } from "@/lib/templates/feed";
import { TITLE_FONT_IDS, TITLE_FONTS } from "@/lib/templates/fonts";

const COLOR_FIELDS: { key: keyof FeedPalette; label: string }[] = [
  { key: "background", label: "Fundo" },
  { key: "text", label: "Texto" },
  { key: "accent", label: "Destaque" },
];

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
    active ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
  }`;

export function StylePanel({
  style,
  onChange,
  onReset,
}: {
  style: FeedStyle;
  onChange: (patch: Partial<FeedStyle>) => void;
  onReset: () => void;
}) {
  return (
    <Panel title="Estilo">
      <div className="space-y-4">
        <Field label="Paleta">
          <div className="flex flex-wrap gap-2">
            {FEED_PALETTES.map(({ name, palette }) => (
              <button
                key={name}
                type="button"
                onClick={() => onChange({ palette })}
                title={name}
                aria-label={`Paleta ${name}`}
                className="flex h-9 overflow-hidden rounded-lg border border-line hover:border-line-strong"
              >
                <span className="w-5" style={{ background: palette.background }} />
                <span className="w-5" style={{ background: palette.text }} />
                <span className="w-5" style={{ background: palette.accent }} />
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_FIELDS.map(({ key, label }) => (
            <label key={key} className="block text-[12px] text-ink-soft">
              <span className="mb-1 block">{label}</span>
              <input
                type="color"
                value={style.palette[key]}
                onChange={(e) => onChange({ palette: { ...style.palette, [key]: e.target.value.toUpperCase() } })}
                className="h-9 w-full cursor-pointer rounded-lg border border-line bg-surface p-1"
              />
            </label>
          ))}
        </div>

        <Field label="Fonte dos títulos">
          <div className="flex flex-wrap gap-1.5">
            {TITLE_FONT_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ titleFont: id })}
                className={chipClass(style.titleFont === id)}
                style={{ fontFamily: TITLE_FONTS[id].stack, fontWeight: TITLE_FONTS[id].weight }}
              >
                {TITLE_FONTS[id].label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={`Tamanho dos títulos · ${Math.round(style.titleScale * 100)}%`}>
          <input
            type="range"
            min={0.7}
            max={1.4}
            step={0.05}
            value={style.titleScale}
            onChange={(e) => onChange({ titleScale: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </Field>

        <Field label="Alinhamento do texto">
          <Segmented
            value={style.align}
            onChange={(align) => onChange({ align })}
            options={[
              { value: "left", label: "Esquerda" },
              { value: "center", label: "Centro" },
            ]}
          />
        </Field>
        <Field label="Posição do texto">
          <Segmented
            value={style.verticalAlign}
            onChange={(verticalAlign) => onChange({ verticalAlign })}
            options={[
              { value: "top", label: "Topo" },
              { value: "center", label: "Meio" },
              { value: "bottom", label: "Base" },
            ]}
          />
        </Field>

        <Field label="Fundo do layout Destaque">
          <Segmented
            value={style.coverBackground}
            onChange={(coverBackground) => onChange({ coverBackground })}
            options={[
              { value: "accent", label: "Cor de destaque" },
              { value: "background", label: "Fundo" },
            ]}
          />
        </Field>

        <Field label="Decoração do fundo">
          <div className="flex flex-wrap gap-1.5">
            {FEED_DECORS.map((decor) => (
              <button key={decor} type="button" onClick={() => onChange({ decor })} className={chipClass(style.decor === decor)}>
                {FEED_DECOR_LABELS[decor]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Proporção">
          <select value={style.size} onChange={(e) => onChange({ size: e.target.value as FeedStyle["size"] })} className={inputClass}>
            {FEED_CANVAS_SIZES.map((id) => (
              <option key={id} value={id}>
                {CANVAS_SIZES[id].label}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-ink-soft">
          <input
            type="checkbox"
            checked={style.showPageNumber}
            onChange={(e) => onChange({ showPageNumber: e.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Mostrar numeração (1/5)
        </label>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-faint hover:text-danger">
          <RotateCcw className="h-3.5 w-3.5" /> Recomeçar do zero
        </button>
      </div>
    </Panel>
  );
}
