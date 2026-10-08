"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Download, ImagePlus, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
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
import { downloadRender, generateCarousel } from "@/lib/client/api";
import { imageFileToDataUrl } from "@/lib/client/image";
import { CANVAS_SIZES, TWEET_CANVAS_SIZES } from "@/lib/formats";
import { browserFontCss } from "@/lib/templates/fonts";
import { renderTweetSlide, type TweetProfile, type TweetStyle } from "@/lib/templates/tweet";
import { MAX_SLIDES } from "@/lib/tweet/schema";
import { newSlide, useTweetDraft, type EditorSlide } from "./useTweetDraft";

const RECOMMENDED_MAX_CHARS = 220;
const SLIDE_COUNT_OPTIONS = [5, 7, 10, 12];

export function TweetEditor() {
  const { draft, setDraft, reset } = useTweetDraft();
  const { profile, style, slides, caption } = draft;

  const [activeIndex, setActiveIndex] = useState(0);
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(7);
  const [brandContext, setBrandContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<"one" | "all" | null>(null);
  const [message, setMessage] = useState<NoticeMessage | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const safeIndex = Math.min(activeIndex, slides.length - 1);
  const active = slides[safeIndex];
  const { width, height } = CANVAS_SIZES[style.size];

  const previewHtml = useMemo(
    () => renderTweetSlide({ slide: active, profile, style, fontCss: browserFontCss }),
    [active, profile, style],
  );

  const updateProfile = (patch: Partial<TweetProfile>) =>
    setDraft((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const updateStyle = (patch: Partial<TweetStyle>) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));
  const updateActive = (patch: Partial<EditorSlide>) =>
    setDraft((d) => ({ ...d, slides: d.slides.map((s, i) => (i === safeIndex ? { ...s, ...patch } : s)) }));

  const addSlide = () => {
    if (slides.length >= MAX_SLIDES) return;
    setDraft((d) => ({ ...d, slides: insertAt(d.slides, safeIndex + 1, newSlide(`Slide ${d.slides.length + 1}`)) }));
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

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      updateProfile({ avatar: await imageFileToDataUrl(file, { maxSide: 400, square: true }) });
    } catch {
      setMessage({ kind: "error", text: "Não foi possível ler essa imagem." });
    }
  };

  const handleGenerate = async () => {
    const hasContent = slides.some((s) => s.text.trim());
    if (hasContent && !window.confirm("Gerar com IA vai substituir os slides atuais. Continuar?")) return;
    setGenerating(true);
    setMessage(null);
    try {
      const result = await generateCarousel({
        topic,
        slideCount,
        name: profile.name,
        handle: profile.handle,
        brandContext: brandContext.trim() || undefined,
      });
      setDraft((d) => ({
        ...d,
        slides: result.slides.slice(0, MAX_SLIDES).map((s) => newSlide(s.label, s.text)),
        caption: result.caption,
      }));
      setActiveIndex(0);
      setMessage({ kind: "info", text: `${result.slides.length} slides gerados. Revise e ajuste antes de exportar.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Erro ao gerar." });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (mode: "one" | "all") => {
    setDownloading(mode);
    setMessage(null);
    try {
      await downloadRender(
        "/api/tweet/render",
        { profile, style, slides: slides.map(({ text, image }) => ({ text, image })) },
        { index: mode === "one" ? safeIndex : undefined, zipName: "carrossel-tweet.zip" },
      );
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Erro ao exportar." });
    } finally {
      setDownloading(null);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ kind: "info", text: `${label} copiado.` });
    } catch {
      setMessage({ kind: "error", text: "Não foi possível copiar." });
    }
  };

  const allTexts = slides.map((s, i) => `Slide ${i + 1} · ${s.label}\n${s.text}`).join("\n\n---\n\n");

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Carrossel Tweet</h1>
          <p className="text-[13px] text-ink-soft">Cada slide vira um post no estilo X. O preview é a imagem final.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolbarButton icon={Copy} onClick={() => copyText(allTexts, "Texto dos slides")}>
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
          <Panel title="Gerar com IA">
            <div className="space-y-3">
              <Field label="Tema do carrossel">
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  placeholder="Ex.: Por que consistência vence talento no marketing"
                  className={`${inputClass} resize-none`}
                />
              </Field>
              <Field label="Número de slides">
                <Segmented value={slideCount} onChange={setSlideCount} options={SLIDE_COUNT_OPTIONS.map((n) => ({ value: n, label: String(n) }))} />
              </Field>
              <Field label="Contexto da marca (opcional)">
                <textarea
                  value={brandContext}
                  onChange={(e) => setBrandContext(e.target.value)}
                  rows={3}
                  placeholder="Público, tom de voz, produto, palavras a evitar…"
                  className={`${inputClass} resize-none`}
                />
              </Field>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || topic.trim().length < 3}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Escrevendo os slides…" : "Gerar slides"}
              </button>
            </div>
          </Panel>

          <Panel title="Perfil">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-dashed border-line-strong bg-canvas text-ink-faint hover:text-ink"
                  aria-label="Escolher foto de perfil"
                >
                  {profile.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                </button>
                <div className="text-[12.5px] text-ink-soft">
                  Foto de perfil
                  {profile.avatar && (
                    <button type="button" onClick={() => updateProfile({ avatar: null })} className="ml-2 text-danger hover:underline">
                      remover
                    </button>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    pickAvatar(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              <Field label="Nome">
                <input value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} className={inputClass} maxLength={80} />
              </Field>
              <Field label="Usuário">
                <input
                  value={profile.handle}
                  onChange={(e) => updateProfile({ handle: e.target.value.replace(/\s+/g, "") })}
                  placeholder="@usuario"
                  className={inputClass}
                  maxLength={40}
                />
              </Field>
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  checked={profile.verified}
                  onChange={(e) => updateProfile({ verified: e.target.checked })}
                  className="h-4 w-4 accent-accent"
                />
                Selo de verificado
              </label>
            </div>
          </Panel>

          <Panel title="Estilo">
            <div className="space-y-3">
              <Field label="Tema">
                <Segmented
                  value={style.theme}
                  onChange={(theme) => updateStyle({ theme })}
                  options={[
                    { value: "light", label: "Claro" },
                    { value: "dark", label: "Escuro" },
                  ]}
                />
              </Field>
              <Field label="Proporção">
                <select value={style.size} onChange={(e) => updateStyle({ size: e.target.value as TweetStyle["size"] })} className={inputClass}>
                  {TWEET_CANVAS_SIZES.map((id) => (
                    <option key={id} value={id}>
                      {CANVAS_SIZES[id].label}
                    </option>
                  ))}
                </select>
              </Field>
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
            items={slides.map((s) => ({ id: s.id, label: s.label, preview: s.text }))}
            activeIndex={safeIndex}
            onSelect={setActiveIndex}
            onAdd={addSlide}
            canAdd={slides.length < MAX_SLIDES}
          />

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[12px] font-bold text-white">{safeIndex + 1}</span>
              <input
                value={active.label}
                onChange={(e) => updateActive({ label: e.target.value })}
                aria-label="Rótulo do slide"
                className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-[14px] font-semibold outline-none hover:border-line focus:border-accent"
              />
              <div className="flex items-center gap-1">
                <IconButton label="Mover para a esquerda" onClick={() => moveSlide(safeIndex, -1)} disabled={safeIndex === 0} icon={ArrowLeft} />
                <IconButton label="Mover para a direita" onClick={() => moveSlide(safeIndex, 1)} disabled={safeIndex === slides.length - 1} icon={ArrowRight} />
                <IconButton label="Excluir slide" onClick={() => removeSlide(safeIndex)} disabled={slides.length === 1} icon={Trash2} danger />
              </div>
            </div>

            <textarea
              value={active.text}
              onChange={(e) => updateActive({ text: e.target.value })}
              rows={10}
              placeholder={"Escreva o texto do slide…\n\nUse **asteriscos** para negrito e linhas separadas para parágrafos."}
              className={`${inputClass} min-h-[240px] resize-y text-[14.5px] leading-relaxed`}
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className={active.text.length > RECOMMENDED_MAX_CHARS ? "text-danger" : "text-ink-faint"}>
                {active.text.length} caracteres
                {active.text.length > RECOMMENDED_MAX_CHARS && ` · recomendado até ${RECOMMENDED_MAX_CHARS}`}
              </span>
              <span className="text-ink-faint">Dica: **palavra** fica em negrito</span>
            </div>

            <div className="mt-4">
              <ImagePicker
                value={active.image}
                onChange={(image) => updateActive({ image })}
                onError={(text) => setMessage({ kind: "error", text })}
                label={active.image ? "Imagem abaixo do texto" : "Adicionar imagem ao slide (opcional)"}
              />
            </div>
          </div>

          {caption && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Legenda do Instagram</h2>
                <button type="button" onClick={() => copyText(caption, "Legenda")} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </button>
              </div>
              <textarea
                value={caption}
                onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                rows={6}
                className={`${inputClass} resize-y leading-relaxed`}
              />
            </div>
          )}
        </section>

        {/* Preview */}
        <section className="lg:col-span-2 xl:col-span-1">
          <PreviewPane html={previewHtml} width={width} height={height} index={safeIndex} total={slides.length} onNavigate={setActiveIndex} />
        </section>
      </div>
    </div>
  );
}
