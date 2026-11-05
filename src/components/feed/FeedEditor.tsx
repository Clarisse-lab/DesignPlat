"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, MoreHorizontal, Save, Wand2 } from "lucide-react";
import {
  Field,
  ImagePicker,
  inputClass,
  insertAt,
  MenuButton,
  Notice,
  Panel,
  PreviewPane,
  Section,
  SlideStrip,
  swap,
  ToolbarButton,
  type MenuItem,
  type NoticeMessage,
} from "@/components/editor/ui";
import { ClientPanel, useStudioClients, type StudioClient } from "@/components/editor/ClientPanel";
import { useSavedPieces, type OpenedPiece } from "@/components/editor/SavedPieces";
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
import { EMPTY_FREE, FreeHandles } from "./FreeEditor";
import { GeneratorPanel, type GeneratedSlide, type GeneratorStyle } from "./GeneratorPanel";
import { buildPreset, type FreeSlide } from "@/lib/templates/free";
import { isFeedDraft, newFeedSlide, useFeedDraft, type FeedEditorSlide } from "./useFeedDraft";

const ALIGN_LABELS = { left: "à esquerda", center: "centralizado" } as const;
const VERTICAL_LABELS = { top: "no topo", center: "no meio", bottom: "na base" } as const;

type DownloadTarget = "one" | "all" | "pdf" | "pptx";
type SidebarSection = "marca" | "conteudo" | "estilo" | "referencia";

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
  const { clients, enabled: studioEnabled } = useStudioClients();
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [section, setSection] = useState<SidebarSection | null>("conteudo");
  // Link do Escritório: /feed?cliente=<slug>&pauta=<id> já escolhe o cliente e a pauta.
  const [linkParams, setLinkParams] = useState<{ cliente: string | null; pauta: number | null } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pauta = Number(params.get("pauta"));
    // Os parâmetros da URL só existem no navegador: leitura única ao montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkParams({ cliente: params.get("cliente"), pauta: Number.isInteger(pauta) && pauta > 0 ? pauta : null });
  }, []);

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

  /** Aplica o kit de marca do cliente: marca inteira e estilo (mantendo o formato desta ferramenta). */
  const selectClient = (client: StudioClient | null) => {
    if (!client) {
      setDraft((d) => ({ ...d, cliente: null }));
      return;
    }
    const kit = client.kit;
    setDraft((d) => {
      if (!kit) return { ...d, cliente: { slug: client.slug, nome: client.nome } };
      const { size: kitSize, customLayout: _ignored, ...kitStyle } = kit.estilo;
      void _ignored;
      const size = kitSize && config.sizes.includes(kitSize) ? kitSize : d.style.size;
      return {
        ...d,
        cliente: { slug: client.slug, nome: client.nome },
        brand: { name: kit.marca.name, handle: kit.marca.handle, logo: kit.marca.logo ?? null },
        style: { ...d.style, ...kitStyle, size, customLayout: null },
      };
    });
    showInfo(kit ? `Kit de marca de ${client.nome} aplicado.` : `${client.nome} ainda não tem kit de marca: só as fotos e a IA usam o cliente.`);
  };

  // Aplica o cliente do link do Escritório assim que a lista de clientes chega.
  useEffect(() => {
    if (!linkParams?.cliente || !clients) return;
    const client = clients.find((c) => c.slug === linkParams.cliente);
    if (client && draft.cliente?.slug !== client.slug) selectClient(client);
    setLinkParams((p) => (p ? { ...p, cliente: null } : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, linkParams?.cliente]);

  /** Monta os slides a partir das telas geradas, com os modelos do Livre (revista) ou os layouts clássicos. */
  const applyGenerated = (items: GeneratedSlide[], legenda: string, genStyle: GeneratorStyle) => {
    if (slides.some((s) => s.title.trim()) && !window.confirm(`Substituir os ${slides.length} slide(s) atuais pelas ${items.length} telas geradas?`)) return;
    const withTag = (free: FreeSlide, etiqueta: string): FreeSlide => ({
      ...free,
      elements: etiqueta.trim()
        ? free.elements.map((el) => (el.kind === "etiqueta" ? { ...el, text: etiqueta.trim().toUpperCase() } : el))
        : free.elements.filter((el) => el.kind !== "etiqueta" || !/^(DESTAQUE|✦ O DESAFIO)$/.test(el.text ?? "")),
    });
    // Capa varia a cada geração; internos alternam entre dois modelos para o carrossel não ficar monótono.
    const capas = ["capa-revista", "capa-perfil-chip", "capa-marca-texto", "capa-editorial", "capa-chip-central"];
    const capa = capas[Math.floor(Math.random() * capas.length)];
    let interno = 0;
    const built = items.slice(0, MAX_FEED_SLIDES).map((it) => {
      const base = { title: it.titulo, body: it.texto };
      if (genStyle === "revista") {
        const id =
          it.tipo === "capa"
            ? capa
            : it.tipo === "lista"
              ? "interno-checklist"
              : it.tipo === "numero"
                ? "interno-dado"
                : it.tipo === "cta"
                  ? "final-salvar"
                  : it.tipo === "texto"
                    ? interno++ % 2 === 0 ? "interno-texto" : "interno-cartao"
                    : null;
        if (id) {
          const free = buildPreset(id, { title: it.titulo, body: it.tipo === "capa" ? it.etiqueta : it.texto, hasImage: false }, { placeholders: false });
          return newFeedSlide({ layout: "livre", ...base, free: withTag(free, it.tipo === "capa" ? "" : it.etiqueta) });
        }
      }
      const layout = it.tipo === "capa" || it.tipo === "cta" ? "destaque" : it.tipo;
      return newFeedSlide({ layout, ...base });
    });
    setDraft((d) => ({ ...d, slides: built, legenda }));
    setActiveIndex(0);
    setSelectedElement(null);
  };

  /** Abre uma peça ou template salvo no lugar do rascunho atual. */
  const openPiece = (piece: OpenedPiece) => {
    if (!isFeedDraft(piece.dados)) {
      showError("Essa peça não é deste editor ou está incompleta.");
      return;
    }
    if (!window.confirm("Abrir no lugar do rascunho atual? O que não foi salvo se perde.")) return;
    const dados = piece.dados;
    const cliente = piece.cliente_slug ? (clients?.find((c) => c.slug === piece.cliente_slug) ?? { slug: piece.cliente_slug, nome: piece.cliente_slug }) : null;
    setDraft({
      ...dados,
      style: { ...dados.style, size: config.sizes.includes(dados.style.size) ? dados.style.size : config.sizes[0] },
      cliente: cliente ? { slug: cliente.slug, nome: cliente.nome } : null,
      pecaId: piece.id,
      titulo: piece.titulo || null,
    });
    setActiveIndex(0);
    showInfo(piece.template ? "Template aberto como peça nova: troque os textos e salve com outro nome." : `Peça "${piece.titulo}" aberta.`);
  };

  /** Carrossel infinito: este slide vira o pedaço 1 e entram novos slides Livre com os pedaços seguintes. */
  const spreadPhoto = (total: number) => {
    const base = slides[safeIndex];
    if (!base.image || !base.free) return;
    const extra = total - 1;
    if (slides.length + extra > MAX_FEED_SLIDES) {
      showError(`Não cabe: o limite é de ${MAX_FEED_SLIDES} slides.`);
      return;
    }
    const pieces = Array.from({ length: extra }, (_, k) =>
      newFeedSlide({
        layout: "livre",
        title: "",
        body: "",
        image: base.image,
        free: { bg: "foto", overlay: base.free!.overlay, progress: base.free!.progress, pan: { total, part: k + 1 }, elements: [] },
      }),
    );
    setDraft((d) => {
      const first = { ...d.slides[safeIndex], free: { ...d.slides[safeIndex].free!, pan: { total, part: 0 } } };
      const next = [...d.slides];
      next.splice(safeIndex, 1, first, ...pieces);
      return { ...d, slides: next };
    });
    showInfo(`Foto espalhada por ${total} slides. Os novos slides começam sem texto: adicione o que quiser em cada um.`);
  };

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
      slides: slides.map(({ layout, title, body, image, icon, notes, free }) => ({ layout, title, body, image, icon, notes: notes || null, free: free ?? null })),
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
      interactiveOverlay={
        active.layout === "livre" ? (
          <FreeHandles
            free={active.free ?? EMPTY_FREE}
            canvasHeight={height}
            selectedId={selectedElement}
            onSelect={setSelectedElement}
            onChange={(free) => updateActive({ free })}
          />
        ) : undefined
      }
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

  const pieces = useSavedPieces({
    ferramenta: mode,
    pecaId: draft.pecaId ?? null,
    titulo: draft.titulo ?? null,
    clienteSlug: draft.cliente?.slug ?? null,
    clienteNome: draft.cliente?.nome ?? null,
    suggestedTitle: (slides[0]?.title || config.title).replace(/\*\*/g, "").slice(0, 80),
    getDados: () => {
      const { pecaId: _id, titulo: _titulo, ...rest } = draft;
      void _id;
      void _titulo;
      return rest as unknown as Record<string, unknown>;
    },
    onSaved: (id, titulo) => setDraft((d) => ({ ...d, pecaId: id, titulo })),
    onOpen: openPiece,
    onError: showError,
    onInfo: showInfo,
  });

  const downloadItems: MenuItem[] = isPresentation
    ? [
        { label: "PowerPoint (.pptx)", onClick: () => handleDownload("pptx") },
        { label: "PDF", hint: "Texto selecionável", onClick: () => handleDownload("pdf") },
        { label: "Imagens (.zip)", onClick: () => handleDownload("all") },
        { label: "Só este slide (PNG)", onClick: () => handleDownload("one") },
      ]
    : [
        { label: "Todos os slides (.zip)", onClick: () => handleDownload("all") },
        { label: "Só este slide (PNG)", onClick: () => handleDownload("one") },
      ];
  const moreItems: MenuItem[] = [
    ...(studioEnabled
      ? [
          { label: "Abrir peça ou template…", onClick: pieces.openBrowser },
          { label: "Salvar como template", hint: "Para reaproveitar o design com outros textos", onClick: () => pieces.save(true) },
        ]
      : []),
    ...(isStory ? [{ label: "Importar do Post de Feed", onClick: importFromFeed }] : []),
    { label: "Copiar os textos dos slides", onClick: copyTexts },
    {
      label: "Recomeçar do zero",
      onClick: () => {
        if (window.confirm("Apagar o rascunho atual e começar de novo?")) {
          reset();
          setActiveIndex(0);
        }
      },
    },
  ];
  const sectionProps = (id: SidebarSection) => ({ open: section === id, onToggle: () => setSection((s) => (s === id ? null : id)) });

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{draft.titulo || config.title}</h1>
          <p className="max-w-2xl text-[13px] text-ink-soft">
            {draft.titulo ? `${config.title}${draft.cliente ? ` · ${draft.cliente.nome}` : ""}` : config.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MenuButton icon={MoreHorizontal} label="Mais" items={moreItems} />
          {studioEnabled && (
            <ToolbarButton icon={Save} busy={pieces.busy === "save"} disabled={pieces.busy !== null} onClick={() => pieces.save(false)}>
              {draft.pecaId ? "Salvar" : "Salvar peça"}
            </ToolbarButton>
          )}
          <MenuButton icon={Download} label="Baixar" primary busy={downloading !== null} items={downloadItems} />
        </div>
      </div>
      {pieces.dialog}

      <Notice message={message} onClose={() => setMessage(null)} />

      <div className={`grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] ${isPresentation ? "" : "xl:grid-cols-[300px_minmax(0,1fr)_400px]"}`}>
        {/* Configurações: um bloco aberto por vez */}
        <aside className="space-y-3">
          <Section title="Cliente e marca" summary={draft.cliente?.nome ?? brand.name} {...sectionProps("marca")}>
            {studioEnabled && <ClientPanel clients={clients} value={draft.cliente?.slug ?? null} onSelect={selectClient} />}
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
                <div className="grid grid-cols-2 gap-2">
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
              </div>
            </Panel>
          </Section>

          <Section title="Conteúdo" summary={`${slides.length} slide(s)`} {...sectionProps("conteudo")}>
            {studioEnabled && mode === "feed" && (
              <GeneratorPanel
                clienteSlug={draft.cliente?.slug ?? null}
                nome={brand.name}
                handle={brand.handle}
                initialPautaId={linkParams?.pauta ?? null}
                legenda={draft.legenda ?? null}
                onGenerated={applyGenerated}
                onError={showError}
                onInfo={showInfo}
              />
            )}
            <Panel title="Colar um texto pronto">
              <div className="space-y-2">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder={"Cada parágrafo vira um slide: a primeira linha é o título e as seguintes, o texto. Use --- para separar slides com vários parágrafos."}
                  className={`${inputClass} resize-y`}
                />
                <button
                  type="button"
                  onClick={importContent}
                  disabled={!content.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" /> Criar slides com este texto
                </button>
              </div>
            </Panel>
          </Section>

          <Section
            title="Estilo"
            summary={
              <span className="inline-flex items-center gap-1.5">
                {[style.palette.background, style.palette.text, style.palette.accent].map((c) => (
                  <span key={c} className="h-3 w-3 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </span>
            }
            {...sectionProps("estilo")}
          >
            <StylePanel style={style} sizes={config.sizes} onChange={updateStyle} onReset={() => {}} hideReset />
          </Section>

          <Section title="Copiar de uma referência" summary="cores e posição de um post" {...sectionProps("referencia")}>
            <ReferencePanel
              size={style.size}
              customLayout={style.customLayout}
              onInspire={applyInspiration}
              onAiStyle={applyAiStyle}
              onRemoveCustomLayout={() => updateStyle({ customLayout: null })}
              onError={showError}
            />
          </Section>
        </aside>

        {/* Slides + editor */}
        <section className="min-w-0 space-y-4">
          {isPresentation && <div className="rounded-2xl border border-line bg-surface p-4">{preview}</div>}
          <SlideStrip
            items={slides.map((s) => ({
              id: s.id,
              label: FEED_LAYOUT_LABELS[s.layout],
              preview: s.layout === "livre" ? (s.free?.elements.find((el) => el.kind === "titulo")?.text ?? s.title) : s.title,
            }))}
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
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            onSpread={spreadPhoto}
            preview={{ brand, palette: style.palette, titleFont: style.titleFont, width, height }}
            imageAi={
              studioEnabled
                ? {
                    size: style.size,
                    clienteSlug: draft.cliente?.slug ?? null,
                    clienteNome: draft.cliente?.nome ?? null,
                    palette: [style.palette.background, style.palette.text, style.palette.accent],
                  }
                : null
            }
          />
        </section>

        {/* Preview (na Apresentação ele fica largo, acima do editor do slide) */}
        {!isPresentation && <section className="lg:col-span-2 xl:col-span-1">{preview}</section>}
      </div>
    </div>
  );
}
