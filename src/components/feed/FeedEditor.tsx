"use client";

import { textZoneOfFree, type ImageStyle, type TextZone } from "@/lib/ai/image-direction";

/** Uma imagem que o Estúdio automático vai gerar para um slide. */
interface ImageJob {
  id: string;
  prompt: string;
  face: boolean;
  zone: TextZone;
  style: ImageStyle;
  /** Proporção pedida ao Gemini (ex.: "3:2" para a metade de cima ou de baixo da tela). */
  aspect?: string;
}
import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Download, MoreHorizontal, Redo2, Save, Shuffle, Undo2, Wand2 } from "lucide-react";
import { ReviewDialog } from "./ReviewDialog";
import { ApprovalDialog, StatusChip, useApprovals } from "./ApprovalDialog";
import { useUndoHistory } from "@/components/editor/useUndoHistory";
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
import { AllSlidesView } from "@/components/editor/AllSlidesView";
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
import { ReferencePanel, type AiReferenceLayouts } from "./ReferencePanel";
import { SlideFields } from "./SlideFields";
import { StylePanel } from "./StylePanel";
import { FEED_STORAGE_KEY, POST_MODES, type PostMode } from "./modes";
import { StoryGuides } from "./StoryGuides";
import { EMPTY_FREE, FreeHandles } from "./FreeEditor";
import { GeneratorPanel, type GeneratedSlide, type GeneratorOptions } from "./GeneratorPanel";
import {
  buildPreset,
  FREE_PRESETS,
  presetById,
  presetWantsImage,
  rebuildWithPreset,
  SEMANTIC_PRESETS,
  CHAT_PRESETS,
  gridSlots,
  hasMotion,
  applyMotionPreset,
  fillTemplate,
  freePhotos,
  freeTexts,
  newElementId,
  templateInfo,
  type FreeElement,
  type FreeSlide,
} from "@/lib/templates/free";
import { hasLayouts, type EstiloLayouts } from "@/lib/estilos";
import { SaveStyleDialog } from "./SaveStyleDialog";
import { sendThumbnail } from "@/lib/client/generated-images";
import { imageFileToDataUrl } from "@/lib/client/image";
import { isFeedDraft, newFeedSlide, useFeedDraft, type FeedEditorSlide } from "./useFeedDraft";

const ALIGN_LABELS = { left: "à esquerda", center: "centralizado" } as const;
const VERTICAL_LABELS = { top: "no topo", center: "no meio", bottom: "na base" } as const;

type DownloadTarget = "one" | "all" | "pdf" | "pptx" | "video";
type SidebarSection = "marca" | "conteudo" | "estilo" | "referencia";

/** Editor com a identidade da marca: Post de Feed, Story ou Apresentação (mesmo template, tamanhos e layouts diferentes). */
/** Modelo quando a IA não mandou um válido (ou para peças geradas antes da escolha de modelos). */
function fallbackModel(it: GeneratedSlide): string {
  if (it.tipo === "capa") return "capa-revista";
  if (it.tipo === "lista") return "interno-checklist";
  if (it.tipo === "numero") return "interno-dado";
  if (it.tipo === "citacao") return "interno-citacao-foto";
  if (it.tipo === "cta") return "final-salvar";
  return "interno-texto";
}

export function FeedEditor({ mode = "feed" }: { mode?: PostMode }) {
  const config = POST_MODES[mode];
  const isStory = mode === "story";
  const isPresentation = mode === "apresentacao";
  const { draft, setDraft, reset, loaded } = useFeedDraft(config.storageKey, config.initialDraft);
  /** O rascunho do navegador já foi conferido com a peça do Supabase (só depois disso salva sozinho). */
  const [draftChecked, setDraftChecked] = useState(false);
  const { brand, style, slides } = draft;
  const [showGuides, setShowGuides] = useState(true);

  const [activeIndex, setActiveIndex] = useState(0);
  const [content, setContent] = useState("");
  const [downloading, setDownloading] = useState<DownloadTarget | null>(null);
  const [message, setMessage] = useState<NoticeMessage | null>(null);
  const { clients, enabled: studioEnabled } = useStudioClients();
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [saveStyleOpen, setSaveStyleOpen] = useState(false);
  /** Muda quando um estilo é salvo: o Gerar carrossel recarrega a lista e já escolhe o salvo. */
  const [savedEstilo, setSavedEstilo] = useState<{ id: string; version: number } | null>(null);
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

  /** Muda para tocar a animação da tela de novo na prévia. */
  const [replay, setReplay] = useState(0);
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
        animate: active.layout === "livre" && hasMotion(active.free),
      }) + (replay ? `<!--r${replay}-->` : ""),
    [active, brand, style, safeIndex, slides, replay],
  );

  // "Ver todas as telas": o HTML de cada tela só é montado com a grade aberta.
  const [showAll, setShowAll] = useState(false);
  const allHtmls = useMemo(
    () =>
      showAll
        ? slides.map((slide, i) =>
            renderFeedSlide({ slide, brand, style, index: i, total: slides.length, fontCss: browserFontCss, sectionNumber: sectionNumberAt(slides, i) }),
          )
        : [],
    [showAll, slides, brand, style],
  );

  // Desfazer/refazer: slides, estilo e marca (o resto do rascunho, como peça e cliente, fica fora).
  const styleKey = JSON.stringify(draft.style);
  const undoValue = useMemo(
    () => ({ slides: draft.slides, brand: draft.brand, style: draft.style }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.slides, draft.brand, styleKey],
  );
  const history = useUndoHistory(
    undoValue,
    (a, b) => a.slides === b.slides && a.brand === b.brand && JSON.stringify(a.style) === JSON.stringify(b.style),
    (v) => {
      setDraft((d) => ({ ...d, slides: v.slides, brand: v.brand, style: v.style }));
      setSelectedElement(null);
    },
    draftChecked,
  );

  const showError = (text: string) => setMessage({ kind: "error", text });
  const showInfo = (text: string) => setMessage({ kind: "info", text });
  const updateBrand = (patch: Partial<FeedBrand>) => setDraft((d) => ({ ...d, brand: { ...d.brand, ...patch } }));
  const updateStyle = (patch: Partial<FeedStyle>) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));
  const updateActive = (patch: Partial<FeedEditorSlide>) =>
    setDraft((d) => ({ ...d, slides: d.slides.map((s, i) => (i === safeIndex ? { ...s, ...patch } : s)) }));

  /** Aplica o kit de marca do cliente: marca inteira e estilo (mantendo o formato desta ferramenta). */
  const selectClient = async (client: StudioClient | null) => {
    if (!client) {
      setDraft((d) => ({ ...d, cliente: null }));
      return;
    }
    const kit = client.kit;
    // Outro cliente: o carrossel do anterior fica salvo e o editor começa limpo para o novo.
    // (Antes os slides ficavam, e o salvamento automático gravaria por cima da peça do outro cliente.)
    const previous = draft.cliente;
    const switching = Boolean(previous && previous.slug !== client.slug && draftHasContent);
    if (switching) {
      await pieces.flush();
      history.reset();
      reset();
      setActiveIndex(0);
      setSelectedElement(null);
    }
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
    const kitInfo = kit ? `Kit de marca de ${client.nome} aplicado.` : `${client.nome} ainda não tem kit de marca: só as fotos e a IA usam o cliente.`;
    showInfo(switching && previous ? `${kitInfo} O carrossel de ${previous.nome} ficou salvo em Mais → Abrir peça.` : kitInfo);
  };

  // Aplica o cliente do link do Escritório assim que a lista de clientes chega.
  useEffect(() => {
    if (!linkParams?.cliente || !clients) return;
    const client = clients.find((c) => c.slug === linkParams.cliente);
    if (client && draft.cliente?.slug !== client.slug) selectClient(client);
    setLinkParams((p) => (p ? { ...p, cliente: null } : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, linkParams?.cliente]);

  /** Troca a etiqueta dos modelos pela da tela gerada (ou some com a etiqueta de exemplo). */
  const withTag = (free: FreeSlide, etiqueta: string): FreeSlide => ({
    ...free,
    elements: etiqueta.trim()
      ? free.elements.map((el) => (el.kind === "etiqueta" ? { ...el, text: etiqueta.trim().toUpperCase() } : el))
      : free.elements.filter((el) => el.kind !== "etiqueta" || !/^(DESTAQUE|✦ O DESAFIO)$/.test(el.text ?? "")),
  });

  /** Coloca uma foto no slide: no primeiro espaço de imagem vazio, ou como foto de fundo. */
  const placeImage = (slide: FeedEditorSlide, image: string): FeedEditorSlide => {
    const free = slide.free;
    if (!free) return { ...slide, image };
    // Primeiro espaço vazio: uma imagem sem foto ou a próxima posição livre de uma grade.
    const emptyCell = (e: FreeElement) => Array.from({ length: gridSlots(e.grid) }, (_, i) => i).find((i) => !e.images?.[i]);
    const slot = free.elements.findIndex((e) => (e.kind === "imagem" && !e.image) || (e.kind === "grade" && emptyCell(e) !== undefined));
    if (slot >= 0) {
      const elements = free.elements.map((e, k) => {
        if (k !== slot) return e;
        if (e.kind === "imagem") return { ...e, image };
        const cell = emptyCell(e) ?? 0;
        const images = [...(e.images ?? [])];
        while (images.length <= cell) images.push(null);
        images[cell] = image;
        return { ...e, images };
      });
      return { ...slide, free: { ...free, elements } };
    }
    return { ...slide, image, free: { ...free, bg: "foto", overlay: free.overlay === "nenhuma" ? "base" : free.overlay } };
  };

  const [generatingImages, setGeneratingImages] = useState(false);

  /** Gera com o Gemini as fotos descritas pela IA, uma por vez, e coloca cada uma no seu slide. */
  const generateImages = async (jobs: ImageJob[]) => {
    setGeneratingImages(true);
    let done = 0;
    let spent = 0;
    try {
      for (const job of jobs) {
        showInfo(`Gerando imagem ${done + 1} de ${jobs.length}…`);
        const response = await fetch("/api/estudio/imagem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: job.prompt,
            size: style.size,
            clienteSlug: draft.cliente?.slug ?? null,
            rostos: job.face && brand.logo ? [brand.logo] : [],
            paleta: [style.palette.background, style.palette.text, style.palette.accent],
            zona: job.zone,
            estilo: job.style,
            proporcao: job.aspect,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error ?? "Erro ao gerar a imagem.");
        const blob = await (await fetch(data.imagem)).blob();
        void sendThumbnail(data.imagem_id, blob);
        const image = await imageFileToDataUrl(new File([blob], "ia.png", { type: blob.type }), { maxSide: 1600 });
        spent += Number(data.custo_usd) || 0;
        history.silent(); // a imagem chegando sozinha não vira passo de desfazer
        setDraft((d) => ({ ...d, slides: d.slides.map((sl) => (sl.id === job.id ? placeImage(sl, image) : sl)) }));
        done++;
      }
      showInfo(`Carrossel pronto: ${done} imagem(ns) geradas (US$ ${spent.toFixed(2).replace(".", ",")}). Revise e salve.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Erro ao gerar a imagem.";
      showError(done ? `${done} de ${jobs.length} imagens geradas. Parou em: ${reason}` : reason);
    } finally {
      setGeneratingImages(false);
    }
  };

  /**
   * Com estilo, a tela tem de usar um modelo dele. Se a IA escolheu outro, troca pelo modelo do estilo
   * da mesma posição (capa na 1ª tela, fechamento na última, interno no meio).
   */
  const keepInStyle = (id: string, k: number, total: number, modelos: string[] | undefined): string => {
    if (!modelos?.length || modelos.includes(id)) return id;
    const valid = modelos.filter((m) => presetById(m).id === m);
    if (!valid.length) return id;
    const want = k === 0 ? "capa" : k === total - 1 ? "final" : "interno";
    return valid.find((m) => presetById(m).category === want) ?? valid.find((m) => presetById(m).category === "interno") ?? valid[0];
  };

  /** Tela própria do estilo para a posição: capa na 1ª, fechamento na última, interna (pela variante) no meio. */
  const pickTemplate = (layouts: EstiloLayouts, k: number, total: number, variante: number): FreeSlide | null => {
    const interno = layouts.internos.length ? layouts.internos[Math.abs(variante) % layouts.internos.length] : null;
    if (k === 0) return layouts.capa ?? interno ?? null;
    if (k === total - 1) return layouts.final ?? interno ?? null;
    return interno ?? null;
  };

  /** Monta os slides a partir das telas geradas, com os modelos escolhidos pela IA (revista) ou os layouts clássicos. */
  const applyGenerated = async (items: GeneratedSlide[], legenda: string, options: GeneratorOptions) => {
    // Sem pergunta: a janela de confirmação chegava depois de 20-40 s de espera e o Chrome a
    // cancelava sozinho quando a pessoa tinha trocado de aba (as telas pagas eram descartadas).
    // O carrossel atual é salvo antes e continua em "Abrir peça".
    const hadContent = draftHasContent;
    const saved = await pieces.flush();
    const list = items.slice(0, MAX_FEED_SLIDES);
    const jobs: ImageJob[] = [];
    const built = list.map((it, k) => {
      const base = { title: it.titulo, body: it.texto };
      const layouts = options.estilo?.dados.layouts;
      if (options.style === "revista" && hasLayouts(layouts)) {
        // Estilo com telas próprias (salvas pela equipe): o desenho vem delas, a IA só escreveu o texto.
        const tpl = pickTemplate(layouts, k, list.length, it.variante ?? 0);
        if (tpl) {
          const prompt = (it.imagem ?? "").trim();
          const info = templateInfo(tpl);
          const wantsImage = prompt.length >= 5 && info.photos > 0 && (options.images === "todas" || (options.images === "capa" && k === 0));
          const free = fillTemplate(tpl, { title: it.titulo, body: it.texto, tag: it.etiqueta, hasImage: wantsImage });
          const slide = newFeedSlide({ layout: "livre", ...base, free });
          if (wantsImage) {
            const style: ImageStyle = options.estilo?.dados.imagem?.estilo ?? "auto";
            const scenes = prompt.split("||").map((p) => p.trim()).filter((p) => p.length >= 5);
            // Os espaços de foto são preenchidos em ordem (imagens e grades), e o fundo de foto por último.
            const slotZones: { zone: TextZone; aspect?: string }[] = free.elements.flatMap((e) =>
              e.kind === "imagem"
                ? [{ zone: "nenhuma" as TextZone }]
                : e.kind === "grade"
                  ? Array.from({ length: gridSlots(e.grid) }, () => ({ zone: (e.dim ? "inferior" : "nenhuma") as TextZone, aspect: e.grid === "2h" ? "3:2" : undefined }))
                  : [],
            );
            if (free.bg === "foto") slotZones.push({ zone: textZoneOfFree(free) });
            slotZones.forEach((slot, c) =>
              jobs.push({ id: slide.id, prompt: scenes[c] ?? scenes[0] ?? prompt, face: c === 0 && Boolean(it.rosto), zone: slot.zone, style, aspect: slot.aspect }),
            );
          }
          return slide;
        }
      }
      if (options.style === "revista") {
        const chosen = it.modelo && presetById(it.modelo).id === it.modelo ? it.modelo : fallbackModel(it);
        const id = keepInStyle(chosen, k, list.length, options.estilo?.dados.modelos);
        const prompt = (it.imagem ?? "").trim();
        const wantsImage = prompt.length >= 5 && presetWantsImage(id) && (options.images === "todas" || (options.images === "capa" && k === 0));
        const body = it.tipo === "capa" && !CHAT_PRESETS.has(id) ? it.etiqueta : it.texto;
        const free = buildPreset(id, { title: it.titulo, body, hasImage: wantsImage }, { placeholders: false });
        const slide = newFeedSlide({ layout: "livre", ...base, free: withTag(free, it.tipo === "capa" ? "" : it.etiqueta) });
        // Foto de fundo: a IA deixa livre a área do texto. Foto num espaço de imagem: sem zona.
        const slotImage = free.elements.some((e) => e.kind === "imagem" || e.kind === "grade");
        // Recorte de colagem pede a imagem no estilo "recorte retrô" (fundo branco que some no papel).
        const cutout = free.elements.some((e) => e.kind === "imagem" && e.cutout);
        const style: ImageStyle = cutout ? "recorte" : (options.estilo?.dados.imagem?.estilo ?? "auto");
        // Grade de fotos com frase por cima (ex.: duas fotos empilhadas): uma cena por foto, separadas por "||".
        const grid = free.elements.find((e) => e.kind === "grade");
        if (wantsImage && grid && grid.dim) {
          const cells = gridSlots(grid.grid);
          const scenes = prompt.split("||").map((p) => p.trim()).filter((p) => p.length >= 5);
          for (let c = 0; c < cells; c++) {
            const scene = scenes[c] ?? scenes[0] ?? prompt;
            jobs.push({ id: slide.id, prompt: scene, face: false, zone: "inferior", style, aspect: grid.grid === "2h" ? "3:2" : undefined });
          }
        } else if (wantsImage) jobs.push({ id: slide.id, prompt, face: !cutout && Boolean(it.rosto), zone: slotImage ? "nenhuma" : textZoneOfFree(free), style });
        return slide;
      }
      const layout = it.tipo === "capa" || it.tipo === "cta" ? "destaque" : it.tipo;
      return newFeedSlide({ layout, ...base });
    });
    // Capa animada: "Impacto" (título sobe e o destaque é pintado, zoom lento na foto). Telas de estilo
    // salvo que já têm animação ficam como estão.
    if (options.capaAnimada && built[0]?.free && !hasMotion(built[0].free)) {
      built[0] = { ...built[0], free: applyMotionPreset(built[0].free, "impacto") };
    }
    // Carrossel novo vira peça nova: o anterior continua salvo (não é sobrescrito).
    // O estilo de referência traz cores e fonte de título; logo, nome e @ continuam os do kit do cliente.
    const look = options.style === "revista" ? options.estilo?.dados.feed : undefined;
    history.reset(); // carrossel novo = histórico novo (o anterior ficou salvo como peça)
    setDraft((d) => ({
      ...d,
      slides: built,
      legenda,
      pecaId: null,
      titulo: null,
      estilo: options.estilo ? { id: options.estilo.id, nome: options.estilo.nome } : null,
      style: look ? { ...d.style, ...(look.palette ? { palette: look.palette } : {}), ...(look.titleFont ? { titleFont: look.titleFont } : {}) } : d.style,
    }));
    setActiveIndex(0);
    setSelectedElement(null);
    if (hadContent) {
      showInfo(
        saved
          ? `${built.length} telas montadas. O carrossel anterior ficou salvo em Mais → Abrir peça.`
          : `${built.length} telas montadas. Atenção: o carrossel anterior não conseguiu ser salvo (sem conexão?).`,
      );
    }
    if (jobs.length) void generateImages(jobs);
  };

  /** Categoria de cada posição: primeiro é capa, último é fechamento, o resto é interno. */
  const categoryAt = (index: number, total: number) => (index === 0 ? "capa" : index === total - 1 ? "final" : "interno");

  /** "Outra versão do design": sorteia outros modelos para cada tela, mantendo texto e fotos. */
  const shuffleDesign = () => {
    if (!slides.some((sl) => sl.layout === "livre" && sl.free && !sl.free.pan)) {
      showInfo("Não há telas no estilo Livre para variar. Gere o carrossel no estilo revista ou troque o layout para Livre.");
      return;
    }
    setDraft((d) => ({
      ...d,
      slides: d.slides.map((sl, k) => {
        if (sl.layout !== "livre" || !sl.free || sl.free.pan) return sl;
        const current = sl.free.preset ?? "";
        if (SEMANTIC_PRESETS.has(current)) return sl;
        const category = categoryAt(k, d.slides.length);
        const hasPhoto = Boolean(sl.image) || sl.free.elements.some((e) => (e.kind === "imagem" && e.image) || (e.kind === "grade" && (e.images ?? []).some(Boolean)));
        const options = FREE_PRESETS.filter(
          (p) => p.category === category && p.id !== current && !SEMANTIC_PRESETS.has(p.id) && (hasPhoto || !presetWantsImage(p.id) || p.photo),
        );
        if (!options.length) return sl;
        const pick = options[Math.floor(Math.random() * options.length)];
        const free = rebuildWithPreset(sl.free, pick.id, { title: sl.title, body: sl.body, image: sl.image ?? null });
        const tag = sl.free.elements.find((e) => e.kind === "etiqueta")?.text ?? "";
        return { ...sl, free: withTag(free, category === "capa" ? "" : tag) };
      }),
    }));
    setSelectedElement(null);
    showInfo("Nova versão do design aplicada. O texto e as fotos continuam os mesmos.");
  };

  /** Aplica um modelo interno em todas as telas internas (menos as de lista, dado, passo e citação). */
  const applyPresetToAll = (id: string) => {
    setDraft((d) => ({
      ...d,
      slides: d.slides.map((sl, k) => {
        if (categoryAt(k, d.slides.length) !== "interno" || sl.layout !== "livre" || !sl.free || sl.free.pan) return sl;
        if (SEMANTIC_PRESETS.has(sl.free.preset ?? "")) return sl;
        const tag = sl.free.elements.find((e) => e.kind === "etiqueta")?.text ?? "";
        return { ...sl, free: withTag(rebuildWithPreset(sl.free, id, { title: sl.title, body: sl.body, image: sl.image ?? null }), tag) };
      }),
    }));
    setSelectedElement(null);
    showInfo(`Modelo "${presetById(id).label}" aplicado nas telas internas.`);
  };

  /** Abre uma peça ou template salvo no lugar do rascunho atual. */
  const openPiece = (piece: OpenedPiece): boolean => {
    if (!isFeedDraft(piece.dados)) {
      showError("Essa peça não é deste editor ou está incompleta.");
      return false;
    }
    if (!window.confirm("Abrir no lugar da peça atual? A atual fica salva em Mais → Abrir peça.")) return false;
    const dados = piece.dados;
    history.reset();
    const cliente = piece.cliente_slug ? (clients?.find((c) => c.slug === piece.cliente_slug) ?? { slug: piece.cliente_slug, nome: piece.cliente_slug }) : null;
    setDraft({
      ...dados,
      style: { ...dados.style, size: config.sizes.includes(dados.style.size) ? dados.style.size : config.sizes[0] },
      cliente: cliente ? { slug: cliente.slug, nome: cliente.nome } : null,
      pecaId: piece.id,
      titulo: piece.titulo || null,
    });
    setActiveIndex(0);
    showInfo(piece.template ? "Template aberto como peça nova: troque os textos e salve com outro nome." : piece.titulo ? `Peça "${piece.titulo}" aberta.` : "Rascunho aberto. Use \"Dar nome e salvar\" para dar um nome a ele.");
    return true;
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

  /** Revisão aberta: pelo botão Revisar ou antes de baixar (aí guarda o que ia baixar). */
  const [review, setReview] = useState<{ mode: "revisar" } | { mode: "baixar"; target: DownloadTarget } | null>(null);
  const handleDownload = (target: DownloadTarget) => {
    if (target === "pdf" || target === "pptx") void doDownload(target);
    else setReview({ mode: "baixar", target });
  };

  /** Correção de português: troca o trecho na tela (1…) ou na legenda (0). */
  const updateSlide = (k: number, patch: Partial<FeedEditorSlide>) =>
    setDraft((d) => ({ ...d, slides: d.slides.map((sl, i) => (i === k ? { ...sl, ...patch } : sl)) }));
  const applyFix = (fix: { tela: number; trecho: string; sugestao: string }): boolean => {
    if (!fix.trecho) return false;
    if (fix.tela === 0) {
      if (!(draft.legenda ?? "").includes(fix.trecho)) return false;
      setDraft((d) => ({ ...d, legenda: (d.legenda ?? "").replace(fix.trecho, fix.sugestao) }));
      return true;
    }
    const k = fix.tela - 1;
    const sl = slides[k];
    if (!sl) return false;
    if (sl.layout === "livre" && sl.free) {
      const el = sl.free.elements.find((e) => (e.text ?? "").includes(fix.trecho));
      if (!el) return false;
      updateSlide(k, { free: { ...sl.free, elements: sl.free.elements.map((e) => (e.id === el.id ? { ...e, text: (e.text ?? "").replace(fix.trecho, fix.sugestao) } : e)) } });
      return true;
    }
    if (sl.title.includes(fix.trecho)) updateSlide(k, { title: sl.title.replace(fix.trecho, fix.sugestao) });
    else if (sl.body.includes(fix.trecho)) updateSlide(k, { body: sl.body.replace(fix.trecho, fix.sugestao) });
    else return false;
    return true;
  };

  const renderPayload = () => ({
    brand,
    style,
    slides: slides.map(({ layout, title, body, image, icon, notes, free }) => ({ layout, title, body, image, icon, notes: notes || null, free: free ?? null })),
  });
  const [approvalOpen, setApprovalOpen] = useState(false);

  const doDownload = async (target: DownloadTarget) => {
    setDownloading(target);
    setMessage(null);
    const payload = renderPayload();
    try {
      if (target === "pdf" || target === "pptx") {
        await downloadFile(`/api/presentation/export?format=${target}`, payload, `apresentacao.${target}`);
      } else {
        await downloadRender("/api/feed/render", payload, {
          index: target === "one" || target === "video" ? safeIndex : undefined,
          zipName: config.zipName,
          video: target === "video",
        });
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
    history.reset();
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

  /**
   * Telas copiadas da referência (Livre, editáveis). Com carrossel aberto, cada tela ganha o desenho da
   * posição dela (capa, interna, fechamento) mantendo texto e fotos; sem carrossel, entram as próprias
   * telas da referência com os textos dela, para editar e salvar como estilo.
   */
  const applyAiLayouts = (result: AiReferenceLayouts) => {
    const { layouts } = result;
    const fresh = (tpl: FreeSlide): FreeSlide => ({ ...tpl, elements: tpl.elements.map((e) => ({ ...e, id: newElementId() })) });
    setDraft((d) => {
      let next: FeedEditorSlide[];
      if (!draftHasContent) {
        next = [layouts.capa, ...layouts.internos, layouts.final]
          .filter((tpl): tpl is FreeSlide => Boolean(tpl))
          .map((tpl) => {
            const t = freeTexts(tpl);
            return newFeedSlide({ layout: "livre", title: t.title, body: t.body, free: fresh(tpl) });
          });
      } else {
        next = d.slides.map((sl, k) => {
          const tpl = pickTemplate(layouts, k, d.slides.length, k - 1);
          if (!tpl || sl.free?.pan) return sl;
          const texts = sl.layout === "livre" && sl.free ? freeTexts(sl.free) : { title: sl.title, body: sl.body, tag: "" };
          const photos = freePhotos(sl.layout === "livre" ? sl.free : null, sl.image);
          let out: FeedEditorSlide = {
            ...sl,
            layout: "livre",
            image: null,
            free: fillTemplate(tpl, { title: texts.title || sl.title, body: texts.body || sl.body, tag: texts.tag, hasImage: photos.length > 0 }),
          };
          for (const photo of photos) out = placeImage(out, photo);
          return out;
        });
      }
      return { ...d, slides: next.length ? next : d.slides, style: { ...d.style, palette: result.palette, titleFont: result.titleFont } };
    });
    setSelectedElement(null);
    showInfo(
      `Estilo "${result.name}" copiado como telas Livre: ajuste o que quiser e guarde em Mais → Salvar como estilo.`,
    );
  };

  const preview = (
    <PreviewPane
      html={previewHtml}
      width={width}
      height={height}
      index={safeIndex}
      total={slides.length}
      onNavigate={setActiveIndex}
      onShowAll={() => setShowAll(true)}
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

  // Assinatura do rascunho para o salvamento automático: imagens entram só pelo tamanho e pelo fim
  // (comparar MB de base64 a cada tecla seria caro); pecaId e titulo ficam de fora.
  const draftKey = useMemo(() => {
    const { pecaId: _id, titulo: _t, syncKey: _s, ...rest } = draft;
    void _id;
    void _t;
    void _s;
    return JSON.stringify(rest, (_k, v) => (typeof v === "string" && v.startsWith("data:") ? `img:${v.length}:${v.slice(-32)}` : v));
  }, [draft]);
  const draftHasContent = slides.some(
    (sl) =>
      sl.title.trim() ||
      sl.body.trim() ||
      sl.image ||
      (sl.free?.elements ?? []).some((e) => (e.text ?? "").trim() || e.image || (e.images ?? []).some(Boolean)),
  );

  const pieces = useSavedPieces({
    ferramenta: mode,
    pecaId: draft.pecaId ?? null,
    titulo: draft.titulo ?? null,
    clienteSlug: draft.cliente?.slug ?? null,
    clienteNome: draft.cliente?.nome ?? null,
    suggestedTitle: (slides[0]?.title || config.title).replace(/\*\*/g, "").slice(0, 80),
    getDados: () => {
      const { pecaId: _id, titulo: _titulo, syncKey: _sync, ...rest } = draft;
      void _id;
      void _titulo;
      void _sync;
      return rest as unknown as Record<string, unknown>;
    },
    onSaved: (id, titulo) => setDraft((d) => ({ ...d, pecaId: id, titulo })),
    onOpen: openPiece,
    onError: showError,
    onInfo: showInfo,
    autoSave: studioEnabled && draftChecked,
    contentKey: draftKey,
    hasContent: draftHasContent,
    onAutoSaved: (id) => setDraft((d) => ({ ...d, pecaId: id })),
    syncedKey: draft.syncKey ?? null,
    onSynced: (key) => setDraft((d) => (d.syncKey === key ? d : { ...d, syncKey: key })),
  });
  const approvals = useApprovals(studioEnabled ? (draft.pecaId ?? null) : null);

  // Ao abrir a página: se o rascunho do navegador aponta para uma peça mas tem mudanças que nunca
  // foram salvas nela (ex.: rascunho antigo, de antes do salvamento automático), ele vira peça nova.
  // Sem isso, o salvamento automático gravaria por cima de uma peça com outro conteúdo.
  useEffect(() => {
    if (!loaded || draftChecked) return;
    if (draft.pecaId && draft.syncKey !== draftKey) {
      setDraft((d) => ({ ...d, pecaId: null, titulo: null, syncKey: null }));
      showInfo("Este rascunho tinha mudanças que não estavam na peça salva: ele vai ser salvo como peça nova (a original ficou como estava).");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const downloadItems: MenuItem[] = isPresentation
    ? [
        { label: "PowerPoint (.pptx)", onClick: () => handleDownload("pptx") },
        { label: "PDF", hint: "Texto selecionável", onClick: () => handleDownload("pdf") },
        { label: "Imagens (.zip)", onClick: () => handleDownload("all") },
        { label: "Só este slide (PNG)", onClick: () => handleDownload("one") },
      ]
    : [
        {
          label: "Todos os slides (.zip)",
          hint: slides.some((sl) => sl.layout === "livre" && hasMotion(sl.free)) ? "Telas animadas vão em vídeo (MP4)" : undefined,
          onClick: () => handleDownload("all"),
        },
        { label: "Só este slide (PNG)", onClick: () => handleDownload("one") },
        ...(active.layout === "livre" && hasMotion(active.free) ? [{ label: "Vídeo deste slide (MP4)", hint: "Leva uns 15 a 30 segundos", onClick: () => handleDownload("video") }] : []),
      ];
  const moreItems: MenuItem[] = [
    ...(studioEnabled
      ? [
          { label: "Abrir peça ou template…", onClick: pieces.openBrowser },
          { label: "Salvar como template", hint: "Para reaproveitar o design com outros textos", onClick: () => pieces.save(true) },
          ...(mode !== "feed" ? [] : [{ label: "Salvar como estilo…", hint: "Capa, internas e fechamento para o Gerar carrossel", onClick: () => setSaveStyleOpen(true) }]),
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
          {studioEnabled && !isPresentation && (
            <button
              type="button"
              onClick={() => setApprovalOpen(true)}
              title="Link para o cliente ver, comentar e aprovar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-soft hover:text-ink"
            >
              {approvals.list[0] ? <StatusChip a={approvals.list[0]} /> : "Enviar para aprovação"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setReview({ mode: "revisar" })}
            title="Confere texto fora da tela, letra pequena, contraste, fotos, @ e legenda"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-soft hover:text-ink"
          >
            <ClipboardCheck className="h-4 w-4" />
            Revisar
          </button>
          <div className="inline-flex overflow-hidden rounded-lg border border-line bg-surface">
            <button
              type="button"
              onClick={history.undo}
              disabled={!history.canUndo}
              title="Desfazer (Ctrl+Z)"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-ink-soft hover:text-ink disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" />
              Desfazer
            </button>
            <button
              type="button"
              onClick={history.redo}
              disabled={!history.canRedo}
              title="Refazer (Ctrl+Shift+Z)"
              aria-label="Refazer"
              className="inline-flex items-center border-l border-line px-2.5 py-2 text-ink-soft hover:text-ink disabled:opacity-40"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
          <MenuButton icon={MoreHorizontal} label="Mais" items={moreItems} />
          {slides.some((sl) => sl.layout === "livre") && (
            <ToolbarButton icon={Shuffle} disabled={generatingImages} onClick={shuffleDesign}>
              Outra versão
            </ToolbarButton>
          )}
          {studioEnabled && (
            <ToolbarButton icon={Save} busy={pieces.busy === "save"} disabled={pieces.busy !== null} onClick={() => pieces.save(false)}>
              {draft.titulo ? "Salvar" : "Dar nome e salvar"}
            </ToolbarButton>
          )}
          {pieces.autoLabel && (
            <span className={`text-[12px] ${pieces.autoError ? "text-danger" : "text-ink-faint"}`} title="A peça se salva sozinha para a equipe. Abra em Mais → Abrir peça.">
              {pieces.autoLabel}
            </span>
          )}
          <MenuButton icon={Download} label="Baixar" primary busy={downloading !== null} items={downloadItems} />
        </div>
      </div>
      {pieces.dialog}
      {approvalOpen && (
        <ApprovalDialog
          approvals={approvals.list}
          reload={approvals.reload}
          ensureSaved={pieces.ensureSaved}
          buildRequest={() => ({
            render: renderPayload(),
            titulo: (draft.titulo || slides[0]?.title || config.title).replace(/\*\*/g, "").slice(0, 150) || "Post",
            legenda: mode === "feed" ? (draft.legenda ?? null) : null,
            cliente_slug: draft.cliente?.slug ?? null,
          })}
          onGoTo={(tela) => {
            setApprovalOpen(false);
            setActiveIndex(tela);
          }}
          onClose={() => setApprovalOpen(false)}
        />
      )}
      {review && (
        <ReviewDialog
          mode={review.mode}
          slides={slides}
          brand={brand}
          style={style}
          legenda={mode === "feed" ? (draft.legenda ?? null) : null}
          clienteSlug={draft.cliente?.slug ?? null}
          onGoTo={(tela, elementId) => {
            setReview(null);
            setActiveIndex(tela);
            setSelectedElement(elementId ?? null);
          }}
          onApplyFix={applyFix}
          onProceed={() => {
            const target = review.mode === "baixar" ? review.target : null;
            setReview(null);
            if (target) void doDownload(target);
          }}
          onClose={() => setReview(null)}
        />
      )}
      {saveStyleOpen && (
        <SaveStyleDialog
          slides={slides}
          palette={style.palette}
          titleFont={style.titleFont}
          cliente={draft.cliente ?? null}
          current={draft.estilo ?? null}
          onClose={() => setSaveStyleOpen(false)}
          onSaved={(estilo) => {
            setSaveStyleOpen(false);
            setDraft((d) => ({ ...d, estilo: { id: estilo.id, nome: estilo.nome } }));
            setSavedEstilo((v) => ({ id: estilo.id, version: (v?.version ?? 0) + 1 }));
            showInfo(`Estilo "${estilo.nome}" salvo. Ele já aparece em Conteúdo → Gerar carrossel → Estilo de referência.`);
          }}
        />
      )}
      {showAll && (
        <AllSlidesView
          htmls={allHtmls}
          width={width}
          height={height}
          activeIndex={safeIndex}
          onPick={(i) => {
            setActiveIndex(i);
            setSelectedElement(null);
            setShowAll(false);
          }}
          onClose={() => setShowAll(false)}
        />
      )}

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
                preferEstilo={savedEstilo}
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
              onAiLayouts={applyAiLayouts}
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
            onApplyAll={slides.length > 2 ? applyPresetToAll : undefined}
            onReplay={() => setReplay((n) => n + 1)}
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
