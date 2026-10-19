"use client";

import { useMemo, useState } from "react";
import { Copy, Download, FileText, Import, Presentation, Wand2 } from "lucide-react";
import {
  Field,
  ImagePicker,
  inputClass,
  insertAt,
  Notice,
  Panel,
  PreviewPane,
  SlideStrip,
  swap,
  ToolbarButton,
  type NoticeMessage,
} from "@/components/editor/ui";
import { downloadFile, downloadRender } from "@/lib/client/api";
import { MAX_FEED_SLIDES } from "@/lib/feed/schema";
import { CANVAS_SIZES } from "@/lib/formats";
import {
  FEED_LAYOUT_LABELS,
  renderFeedSlide,
  sectionNumberAt,
  splitContentIntoSlides,
  type FeedBrand,
  type FeedStyle,
} from "@/lib/templates/feed";
import { browserFontCss } from "@/lib/templates/fonts";
import { ReferencePanel, type AiReferenceResult } from "./ReferencePanel";
import { SlideFields } from "./SlideFields";
import { StylePanel } from "./StylePanel";
import { FEED_STORAGE_KEY, POST_MODES, type PostMode } from "./modes";
import { StoryGuides } from "./StoryGuides";
import { isFeedDraft, newFeedSlide, useFeedDraft, type FeedEditorSlide } from "./useFeedDraft";

const ALIGN_LABELS = { left: "à esquerda", center: "centralizado" } as const;
const VERTICAL_LABELS = { top: "no topo", center: "no meio", bottom: "na base" } as const;

type DownloadTarget = "one" | "all" | "pdf" | "pptx";

/** Editor com a identidade da marca: Post de Feed, Story ou Apresentação (mesmo template, tamanhos e layouts diferentes). */
export function FeedEditor({ mode = "feed" }: { mode?: PostMode }) {
  const config = POST_MODES[mode];
  const isStory = mode === "story";
  const isPresentation = mode === "apresentacao";
  const { draft, setDraft, reset } = useFeedDraft(config.storageKey, config.initialDraft);
  const { brand, style, slides } = draft;
  const [showGuides, setShowGuides] = useState(true);

  const [activeIndex, setActiveIndex] = useState(0);
  const [content, setContent] = useState("");
  const [downloading, setDownloading] = useState<DownloadTarget | null>(null);
  const [message, setMessage] = useState<NoticeMessage | null>(null);

  const safeIndex = Math.min(activeIndex, slides.length - 1);
  const active = slides[safeIndex];
  const { width, height } = CANVAS_SIZES[style.size];

  const previewHtml = useMemo(
    () =>
      renderFeedSlide({
        slide: active,
        brand,
        style,
        index: safeIndex,
        total: slides.length,
        fontCss: browserFontCss,
        sectionNumber: sectionNumberAt(slides, safeIndex),
      }),
    [active, brand, style, safeIndex, slides],
  );

  const showError = (text: string) => setMessage({ kind: "error", text });
  const showInfo = (text: string) => setMessage({ kind: "info", text });
  const updateBrand = (patch: Partial<FeedBrand>) => setDraft((d) => ({ ...d, brand: { ...d.brand, ...patch } }));
  const updateStyle = (patch: Partial<FeedStyle>) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));
  const updateActive = (patch: Partial<FeedEditorSlide>) =>
    setDraft((d) => ({ ...d, slides: d.slides.map((s, i) => (i === safeIndex ? { ...s, ...patch } : s)) }));

  const addSlide = () => {
    if (slides.length >= MAX_FEED_SLIDES) return;
    setDraft((d) => ({ ...d, slides: insertAt(d.slides, safeIndex + 1, newFeedSlide({ layout: "texto" })) }));
    setActiveIndex(safeIndex + 1);
  };

  const removeSlide = () => {
    if (slides.length === 1) return;
    setDraft((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== safeIndex) }));
    setActiveIndex(Math.max(0, safeIndex - 1));
  };

  const moveSlide = (delta: -1 | 1) => {
    const target = safeIndex + delta;
    if (target < 0 || target >= slides.length) return;
    setDraft((d) => ({ ...d, slides: swap(d.slides, safeIndex, target) }));
    setActiveIndex(target);
  };

  const importContent = () => {
    const created = splitContentIntoSlides(content).slice(0, MAX_FEED_SLIDES);
    if (created.length === 0) return;
    if (!window.confirm(`Isso vai substituir os slides atuais por ${created.length} slide(s). Continuar?`)) return;
    setDraft((d) => ({ ...d, slides: created.map((slide) => newFeedSlide(slide)) }));
    setActiveIndex(0);
    showInfo(`${created.length} slide(s) criados. Ajuste o layout de cada um se quiser.`);
  };

  const handleDownload = async (target: DownloadTarget) => {
    setDownloading(target);
    setMessage(null);
    const payload = {
      brand,
      style,
      slides: slides.map(({ layout, title, body, image, icon, notes }) => ({ layout, title, body, image, icon, notes: notes || null })),
    };
    try {
      if (target === "pdf" || target === "pptx") {
        await downloadFile(`/api/presentation/export?format=${target}`, payload, `apresentacao.${target}`);
      } else {
        await downloadRender("/api/feed/render", payload, { index: target === "one" ? safeIndex : undefined, zipName: config.zipName });
      }
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
      showInfo("Texto dos slides copiado.");
    } catch {
      showError("Não foi possível copiar.");
    }
  };

  /** Traz marca, estilo e slides do rascunho do Post de Feed, já no tamanho do Story. */
  const importFromFeed = () => {
    let feed: unknown = null;
    try {
      feed = JSON.parse(window.localStorage.getItem(FEED_STORAGE_KEY) ?? "null");
    } catch {
      // rascunho ilegível: trata como inexistente
    }
    if (!isFeedDraft(feed)) {
      showError("Não encontrei um rascunho do Post de Feed neste navegador.");
      return;
    }
    if (!window.confirm(`Trazer os ${feed.slides.length} slide(s), a marca e o estilo do Post de Feed? Os stories atuais serão substituídos.`)) return;
    setDraft({
      brand: feed.brand,
      style: { ...feed.style, size: config.sizes[0], customLayout: null },
      slides: feed.slides.map((slide) => newFeedSlide({ ...slide, layout: slide.layout === "referencia" ? "texto" : slide.layout })),
    });
    setActiveIndex(0);
    showInfo("Conteúdo do Post de Feed importado. Confira cada story: o formato vertical pode pedir ajustes de texto.");
  };

  const applyInspiration: Parameters<typeof ReferencePanel>[0]["onInspire"] = ({ palette, layout }) => {
    updateStyle({
      palette: { background: palette.background, text: palette.text, accent: palette.accent ?? style.palette.accent },
      ...(layout ? { align: layout.align, verticalAlign: layout.verticalAlign, titleScale: layout.titleScale } : {}),
      // Na referência o título fica sobre o fundo dela; o Destaque copia isso em vez de usar a cor de destaque.
      ...(layout?.layout === "destaque" ? { coverBackground: "background" as const } : {}),
    });
    if (layout) updateActive({ layout: layout.layout });
    showInfo(
      layout
        ? `Cores aplicadas e layout ${FEED_LAYOUT_LABELS[layout.layout]} no slide atual, com texto ${ALIGN_LABELS[layout.align]} ${VERTICAL_LABELS[layout.verticalAlign]}.`
        : "Cores aplicadas. Não encontrei texto legível na referência para copiar a posição.",
    );
  };

  const applyAiStyle = (result: AiReferenceResult) => {
    updateStyle({ ...result.style, customLayout: result.customLayout });
    updateActive({ layout: "referencia", icon: active.icon ?? result.icon });
    showInfo(`Layout "${result.name}" criado e aplicado no slide atual. Ele fica disponível como "Da referência" para os outros slides.`);
  };

  const preview = (
    <PreviewPane
      html={previewHtml}
      width={width}
      height={height}
      index={safeIndex}
      total={slides.length}
      onNavigate={setActiveIndex}
      maxWidth={isStory ? 340 : isPresentation ? 760 : 400}
      overlay={isStory && showGuides ? <StoryGuides showStickerSlot={active.layout === "sticker"} /> : undefined}
      controls={
        isStory ? (
          <label className="mt-3 flex items-center justify-center gap-2 text-[12.5px] text-ink-soft">
            <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} className="h-4 w-4 accent-accent" />
            Mostrar áreas cobertas pelo Instagram
          </label>
        ) : undefined
      }
    />
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{config.title}</h1>
          <p className="max-w-2xl text-[13px] text-ink-soft">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStory && (
            <ToolbarButton icon={Import} onClick={importFromFeed}>
              Importar do Post de Feed
            </ToolbarButton>
          )}
          <ToolbarButton icon={Copy} onClick={copyTexts}>
            Copiar textos
          </ToolbarButton>
          <ToolbarButton icon={Download} busy={downloading === "one"} disabled={downloading !== null} onClick={() => handleDownload("one")}>
            Baixar slide
          </ToolbarButton>
          <ToolbarButton
            icon={Download}
            primary={!isPresentation}
            busy={downloading === "all"}
            disabled={downloading !== null}
            onClick={() => handleDownload("all")}
          >
            {isPresentation ? "Imagens (.zip)" : "Baixar todos (.zip)"}
          </ToolbarButton>
          {isPresentation && (
            <>
              <ToolbarButton icon={FileText} busy={downloading === "pdf"} disabled={downloading !== null} onClick={() => handleDownload("pdf")}>
                PDF
              </ToolbarButton>
              <ToolbarButton
                icon={Presentation}
                primary
                busy={downloading === "pptx"}
                disabled={downloading !== null}
                onClick={() => handleDownload("pptx")}
              >
                PowerPoint (.pptx)
              </ToolbarButton>
            </>
          )}
        </div>
      </div>

      <Notice message={message} onClose={() => setMessage(null)} />

      <div className={`grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] ${isPresentation ? "" : "xl:grid-cols-[300px_minmax(0,1fr)_400px]"}`}>
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

          <ReferencePanel
            size={style.size}
            customLayout={style.customLayout}
            onInspire={applyInspiration}
            onAiStyle={applyAiStyle}
            onRemoveCustomLayout={() => updateStyle({ customLayout: null })}
            onError={showError}
          />

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
              <Field label={isPresentation ? "Usuário (opcional; sem ele, o rodapé mostra o nome)" : "Usuário"}>
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

          <StylePanel
            style={style}
            sizes={config.sizes}
            onChange={updateStyle}
            onReset={() => {
              if (window.confirm("Apagar o rascunho atual e começar de novo?")) {
                reset();
                setActiveIndex(0);
              }
            }}
          />
        </aside>

        {/* Slides + editor */}
        <section className="min-w-0 space-y-4">
          {isPresentation && <div className="rounded-2xl border border-line bg-surface p-4">{preview}</div>}
          <SlideStrip
            items={slides.map((s) => ({ id: s.id, label: FEED_LAYOUT_LABELS[s.layout], preview: s.title }))}
            activeIndex={safeIndex}
            onSelect={setActiveIndex}
            onAdd={addSlide}
            canAdd={slides.length < MAX_FEED_SLIDES}
          />
          <SlideFields
            slide={active}
            index={safeIndex}
            total={slides.length}
            availableLayouts={config.layouts}
            hasCustomLayout={Boolean(style.customLayout)}
            showNotes={isPresentation}
            onChange={updateActive}
            onMove={moveSlide}
            onRemove={removeSlide}
            onError={showError}
            onInfo={showInfo}
          />
        </section>

        {/* Preview (na Apresentação ele fica largo, acima do editor do slide) */}
        {!isPresentation && <section className="lg:col-span-2 xl:col-span-1">{preview}</section>}
      </div>
    </div>
  );
}
