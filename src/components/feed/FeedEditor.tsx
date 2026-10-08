"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Download, RotateCcw, Trash2, Wand2 } from "lucide-react";
import {
  Field,
  IconButton,
  ImagePicker,
  inputClass,
  insertAt,
  Notice,
  Panel,
  PreviewPane,
  Segmented,
  SlideStrip,
  swap,
  ToolbarButton,
  type NoticeMessage,
} from "@/components/editor/ui";
import { downloadRender } from "@/lib/client/api";
import { MAX_FEED_SLIDES } from "@/lib/feed/schema";
import { CANVAS_SIZES, FEED_CANVAS_SIZES } from "@/lib/formats";
import {
  FEED_LAYOUT_LABELS,
  FEED_LAYOUTS,
  FEED_PALETTES,
  renderFeedSlide,
  splitContentIntoSlides,
  type FeedBrand,
  type FeedPalette,
  type FeedStyle,
} from "@/lib/templates/feed";
import { browserFontCss } from "@/lib/templates/fonts";
import { newFeedSlide, useFeedDraft, type FeedEditorSlide } from "./useFeedDraft";

const FIELD_LABELS = {
  destaque: { title: "Título", body: "Subtítulo (opcional)", image: "Imagem de fundo (opcional)" },
  texto: { title: "Título", body: "Texto", image: null },
  citacao: { title: "Frase", body: "Autor (opcional)", image: null },
  foto: { title: "Título", body: "Texto (opcional)", image: "Foto" },
} as const;

const COLOR_FIELDS: { key: keyof FeedPalette; label: string }[] = [
  { key: "background", label: "Fundo" },
  { key: "text", label: "Texto" },
  { key: "accent", label: "Destaque" },
];

export function FeedEditor() {
  const { draft, setDraft, reset } = useFeedDraft();
  const { brand, style, slides } = draft;

  const [activeIndex, setActiveIndex] = useState(0);
  const [content, setContent] = useState("");
  const [downloading, setDownloading] = useState<"one" | "all" | null>(null);
  const [message, setMessage] = useState<NoticeMessage | null>(null);

  const safeIndex = Math.min(activeIndex, slides.length - 1);
  const active = slides[safeIndex];
  const { width, height } = CANVAS_SIZES[style.size];
  const labels = FIELD_LABELS[active.layout];

  const previewHtml = useMemo(
    () => renderFeedSlide({ slide: active, brand, style, index: safeIndex, total: slides.length, fontCss: browserFontCss }),
    [active, brand, style, safeIndex, slides.length],
  );

  const showError = (text: string) => setMessage({ kind: "error", text });
  const updateBrand = (patch: Partial<FeedBrand>) => setDraft((d) => ({ ...d, brand: { ...d.brand, ...patch } }));
  const updateStyle = (patch: Partial<FeedStyle>) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));
  const updatePalette = (patch: Partial<FeedPalette>) =>
    setDraft((d) => ({ ...d, style: { ...d.style, palette: { ...d.style.palette, ...patch } } }));
  const updateActive = (patch: Partial<FeedEditorSlide>) =>
    setDraft((d) => ({ ...d, slides: d.slides.map((s, i) => (i === safeIndex ? { ...s, ...patch } : s)) }));

  const addSlide = () => {
    if (slides.length >= MAX_FEED_SLIDES) return;
    setDraft((d) => ({ ...d, slides: insertAt(d.slides, safeIndex + 1, newFeedSlide({ layout: "texto" })) }));
    setActiveIndex(safeIndex + 1);
  };

  const removeSlide = (index: number) => {
    if (slides.length === 1) return;
    setDraft((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== index) }));
    setActiveIndex((current) => (current >= index ? Math.max(0, current - 1) : current));
  };

  const moveSlide = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    setDraft((d) => ({ ...d, slides: swap(d.slides, index, target) }));
    setActiveIndex(target);
  };

  const importContent = () => {
    const created = splitContentIntoSlides(content).slice(0, MAX_FEED_SLIDES);
    if (created.length === 0) return;
    if (!window.confirm(`Isso vai substituir os slides atuais por ${created.length} slide(s). Continuar?`)) return;
    setDraft((d) => ({ ...d, slides: created.map((slide) => newFeedSlide(slide)) }));
    setActiveIndex(0);
    setMessage({ kind: "info", text: `${created.length} slide(s) criados. Ajuste o layout de cada um se quiser.` });
  };

  const handleDownload = async (mode: "one" | "all") => {
    setDownloading(mode);
    setMessage(null);
    try {
      await downloadRender(
        "/api/feed/render",
        { brand, style, slides: slides.map(({ layout, title, body, image }) => ({ layout, title, body, image })) },
        { index: mode === "one" ? safeIndex : undefined, zipName: "post-feed.zip" },
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "Erro ao exportar.");
    } finally {
      setDownloading(null);
    }
  };

  const copyTexts = async () => {
    const text = slides.map((s, i) => `Slide ${i + 1}\n${[s.title, s.body].filter(Boolean).join("\n")}`).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ kind: "info", text: "Texto dos slides copiado." });
    } catch {
      showError("Não foi possível copiar.");
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Post de Feed</h1>
          <p className="text-[13px] text-ink-soft">Posts e carrosséis com a identidade da sua marca. O preview é a imagem final.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolbarButton icon={Copy} onClick={copyTexts}>
            Copiar textos
          </ToolbarButton>
          <ToolbarButton icon={Download} busy={downloading === "one"} disabled={downloading !== null} onClick={() => handleDownload("one")}>
            Baixar slide
          </ToolbarButton>
          <ToolbarButton icon={Download} primary busy={downloading === "all"} disabled={downloading !== null} onClick={() => handleDownload("all")}>
            Baixar todos (.zip)
          </ToolbarButton>
        </div>
      </div>

      <Notice message={message} onClose={() => setMessage(null)} />

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_400px]">
        {/* Configurações */}
        <aside className="space-y-4">
          <Panel title="Criar a partir do texto">
            <div className="space-y-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder={"Cole aqui o texto do conteúdo.\n\nCada parágrafo vira um slide: a primeira linha é o título e as seguintes, o texto."}
                className={`${inputClass} resize-y`}
              />
              <p className="text-[11.5px] leading-relaxed text-ink-faint">
                Separe os slides com uma linha em branco, ou com uma linha só com <code>---</code> se quiser vários parágrafos no
                mesmo slide.
              </p>
              <button
                type="button"
                onClick={importContent}
                disabled={!content.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4" /> Criar slides
              </button>
            </div>
          </Panel>

          <Panel title="Marca">
            <div className="space-y-3">
              <ImagePicker
                value={brand.logo}
                onChange={(logo) => updateBrand({ logo })}
                onError={showError}
                label={brand.logo ? "Logo da marca" : "Adicionar logo (opcional)"}
                maxSide={400}
                square
              />
              <Field label="Nome">
                <input value={brand.name} onChange={(e) => updateBrand({ name: e.target.value })} className={inputClass} maxLength={80} />
              </Field>
              <Field label="Usuário">
                <input
                  value={brand.handle}
                  onChange={(e) => updateBrand({ handle: e.target.value.replace(/\s+/g, "") })}
                  placeholder="@usuario"
                  className={inputClass}
                  maxLength={40}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Estilo">
            <div className="space-y-3">
              <Field label="Paleta">
                <div className="flex flex-wrap gap-2">
                  {FEED_PALETTES.map(({ name, palette }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => updateStyle({ palette })}
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
                      onChange={(e) => updatePalette({ [key]: e.target.value.toUpperCase() })}
                      className="h-9 w-full cursor-pointer rounded-lg border border-line bg-surface p-1"
                    />
                  </label>
                ))}
              </div>
              <Field label="Fonte dos títulos">
                <Segmented
                  value={style.titleFont}
                  onChange={(titleFont) => updateStyle({ titleFont })}
                  options={[
                    { value: "sans", label: "Moderna" },
                    { value: "serif", label: "Elegante" },
                  ]}
                />
              </Field>
              <Field label="Proporção">
                <select value={style.size} onChange={(e) => updateStyle({ size: e.target.value as FeedStyle["size"] })} className={inputClass}>
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
                  onChange={(e) => updateStyle({ showPageNumber: e.target.checked })}
                  className="h-4 w-4 accent-accent"
                />
                Mostrar numeração (1/5)
              </label>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Apagar o rascunho atual e começar de novo?")) {
                    reset();
                    setActiveIndex(0);
                  }
                }}
                className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-faint hover:text-danger"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Recomeçar do zero
              </button>
            </div>
          </Panel>
        </aside>

        {/* Slides + editor */}
        <section className="min-w-0 space-y-4">
          <SlideStrip
            items={slides.map((s) => ({ id: s.id, label: FEED_LAYOUT_LABELS[s.layout], preview: s.title }))}
            activeIndex={safeIndex}
            onSelect={setActiveIndex}
            onAdd={addSlide}
            canAdd={slides.length < MAX_FEED_SLIDES}
          />

          <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[12px] font-bold text-white">{safeIndex + 1}</span>
              <div className="min-w-[260px] flex-1">
                <Segmented
                  value={active.layout}
                  onChange={(layout) => updateActive({ layout })}
                  options={FEED_LAYOUTS.map((layout) => ({ value: layout, label: FEED_LAYOUT_LABELS[layout] }))}
                />
              </div>
              <div className="flex items-center gap-1">
                <IconButton label="Mover para a esquerda" onClick={() => moveSlide(safeIndex, -1)} disabled={safeIndex === 0} icon={ArrowLeft} />
                <IconButton label="Mover para a direita" onClick={() => moveSlide(safeIndex, 1)} disabled={safeIndex === slides.length - 1} icon={ArrowRight} />
                <IconButton label="Excluir slide" onClick={() => removeSlide(safeIndex)} disabled={slides.length === 1} icon={Trash2} danger />
              </div>
            </div>

            <Field label={labels.title}>
              <textarea
                value={active.title}
                onChange={(e) => updateActive({ title: e.target.value })}
                rows={3}
                className={`${inputClass} resize-y text-[14.5px] leading-relaxed`}
              />
            </Field>
            <Field label={labels.body}>
              <textarea
                value={active.body}
                onChange={(e) => updateActive({ body: e.target.value })}
                rows={active.layout === "texto" ? 7 : 3}
                className={`${inputClass} resize-y text-[14.5px] leading-relaxed`}
              />
            </Field>
            {labels.image && (
              <ImagePicker value={active.image} onChange={(image) => updateActive({ image })} onError={showError} label={labels.image} />
            )}
            <p className="text-[12px] text-ink-faint">Dica: **palavra** fica em negrito (nos layouts Texto e Foto, na cor de destaque).</p>
          </div>
        </section>

        {/* Preview */}
        <section className="lg:col-span-2 xl:col-span-1">
          <PreviewPane html={previewHtml} width={width} height={height} index={safeIndex} total={slides.length} onNavigate={setActiveIndex} />
        </section>
      </div>
    </div>
  );
}
