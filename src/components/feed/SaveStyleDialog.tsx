"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { inputClass } from "@/components/editor/ui";
import { IMAGE_STYLE_LABELS, IMAGE_STYLES, type ImageStyle } from "@/lib/ai/image-direction";
import type { Estilo, EstiloDados } from "@/lib/estilos";
import type { FeedPalette } from "@/lib/templates/feed";
import type { TitleFontId } from "@/lib/templates/fonts";
import { layoutSignature, stripTemplate, type FreeSlide } from "@/lib/templates/free";
import type { FeedEditorSlide } from "./useFeedDraft";

const MAX_INTERNOS = 4;

/**
 * Salva o carrossel aberto como estilo: a 1ª tela vira a capa, a última o fechamento e as do meio
 * (sem repetir desenho, até 4) as telas internas. Cores e fonte vêm da seção Estilo.
 */
export function SaveStyleDialog({
  slides,
  palette,
  titleFont,
  cliente,
  current,
  onClose,
  onSaved,
}: {
  slides: FeedEditorSlide[];
  palette: FeedPalette;
  titleFont: TitleFontId;
  cliente: { slug: string; nome: string } | null;
  /** Estilo com que este carrossel foi gerado (pode ser substituído). */
  current: { id: string; nome: string } | null;
  onClose: () => void;
  onSaved: (estilo: Estilo) => void;
}) {
  const livre = (sl: FeedEditorSlide | undefined): FreeSlide | null => (sl && sl.layout === "livre" && sl.free && !sl.free.pan ? sl.free : null);
  const last = slides.length - 1;
  const capa = livre(slides[0]);
  const final = slides.length > 1 ? livre(slides[last]) : null;
  const middle = useMemo(
    () => slides.map((sl, i) => ({ i, sl, free: i > 0 && i < last ? livre(sl) : null })).filter((m): m is { i: number; sl: FeedEditorSlide; free: FreeSlide } => m.free !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slides],
  );
  // Por padrão: a primeira tela de cada desenho diferente (até 4).
  const [picked, setPicked] = useState<Set<number>>(() => {
    const seen = new Set<string>();
    const out = new Set<number>();
    for (const m of middle) {
      const sig = layoutSignature(m.free);
      if (seen.has(sig) || out.size >= MAX_INTERNOS) continue;
      seen.add(sig);
      out.add(m.i);
    }
    return out;
  });

  const [existing, setExisting] = useState<Estilo | null>(null);
  const [replace, setReplace] = useState(Boolean(current));
  const [nome, setNome] = useState(current?.nome ?? "");
  const [scope, setScope] = useState<"cliente" | "agencia">(cliente ? "cliente" : "agencia");
  const [padrao, setPadrao] = useState(false);
  const [imageStyle, setImageStyle] = useState<ImageStyle>("auto");
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Para substituir, traz o que o estilo atual já tem (tom do texto, fotos, cena, padrão).
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    fetch(`/api/estudio/estilos${cliente ? `?cliente=${encodeURIComponent(cliente.slug)}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        const found: Estilo | undefined = (data.estilos ?? []).find((e: Estilo) => e.id === current.id);
        if (cancelled || !found) return;
        setExisting(found);
        setImageStyle(found.dados.imagem?.estilo ?? "auto");
        setTexto(found.dados.texto ?? "");
        setPadrao(found.padrao);
        setScope(found.cliente_slug ? "cliente" : "agencia");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [current, cliente]);

  const internos = middle.filter((m) => picked.has(m.i));
  const total = (capa ? 1 : 0) + internos.length + (final ? 1 : 0);

  const toggle = (i: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(i)) next.delete(i);
      else if (next.size < MAX_INTERNOS) next.add(i);
      return next;
    });

  const save = async () => {
    if (nome.trim().length < 2) {
      setError("Dê um nome ao estilo.");
      return;
    }
    if (!total) {
      setError("Nenhuma tela no layout Livre para salvar.");
      return;
    }
    setBusy(true);
    setError("");
    const keep = replace ? existing : null;
    const dados: EstiloDados = {
      modelos: [],
      layouts: {
        capa: capa ? stripTemplate(capa) : null,
        internos: internos.map((m) => stripTemplate(m.free)),
        final: final ? stripTemplate(final) : null,
      },
      feed: { palette, titleFont },
      imagem: { estilo: imageStyle, cena: keep?.dados.imagem?.cena ?? "" },
      texto: texto.trim(),
    };
    const partes = [capa ? "capa" : "", internos.length ? `${internos.length} tela(s) interna(s)` : "", final ? "fechamento" : ""].filter(Boolean).join(", ");
    try {
      const response = await fetch("/api/estudio/estilos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: keep?.id ?? null,
          nome: nome.trim(),
          descricao: `Telas próprias (${partes}), salvas de um carrossel editado.`,
          cliente_slug: scope === "cliente" && cliente ? cliente.slug : null,
          padrao: scope === "cliente" && Boolean(cliente) && padrao,
          dados,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Não foi possível salvar o estilo.");
      onSaved(data.estilo as Estilo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o estilo.");
      setBusy(false);
    }
  };

  const label = (sl: FeedEditorSlide) => (sl.title || sl.body || "sem texto").replace(/\*\*/g, "").slice(0, 48);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Salvar como estilo">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold">Salvar como estilo</h2>
            <p className="text-[12.5px] text-ink-soft">
              O desenho destas telas vira um estilo para o Gerar carrossel. A IA escreve o texto no tamanho de cada tela e gera as fotos nos espaços de foto.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar" className="rounded-md p-1 text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1.5 rounded-xl bg-canvas p-3 text-[12.5px]">
          <p>
            <strong>Capa:</strong> {capa ? `tela 1 · ${label(slides[0])}` : "a tela 1 não está no layout Livre (fica sem capa própria)"}
          </p>
          <div>
            <strong>Telas internas</strong> <span className="text-ink-faint">(até {MAX_INTERNOS}, uma de cada desenho)</span>
            {middle.length ? (
              <div className="mt-1 space-y-1">
                {middle.map((m) => (
                  <label key={m.sl.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={picked.has(m.i)} onChange={() => toggle(m.i)} className="h-4 w-4 accent-accent" />
                    <span className="truncate">
                      Tela {m.i + 1} · {label(m.sl)}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-ink-faint">Nenhuma tela interna no layout Livre.</p>
            )}
          </div>
          <p>
            <strong>Fechamento:</strong> {final ? `tela ${last + 1} · ${label(slides[last])}` : "sem fechamento próprio"}
          </p>
          <p className="text-ink-faint">Cores e fonte dos títulos: as da seção Estilo. Fotos não são salvas, só os espaços delas.</p>
        </div>

        {current && (
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-4 w-4 accent-accent" />
            Substituir o estilo &quot;{current.nome}&quot; (desmarque para salvar como novo)
          </label>
        )}

        <label className="block space-y-1">
          <span className="text-[12px] font-medium text-ink-soft">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Ex.: Editorial laranja" className={inputClass} />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-[12px] font-medium text-ink-soft">Para</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as "cliente" | "agencia")} className={inputClass}>
              {cliente && <option value="cliente">{cliente.nome}</option>}
              <option value="agencia">Toda a agência</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-medium text-ink-soft">Fotos geradas</span>
            <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value as ImageStyle)} className={inputClass}>
              {IMAGE_STYLES.filter((id) => id !== "recorte").map((id) => (
                <option key={id} value={id}>
                  {IMAGE_STYLE_LABELS[id].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {scope === "cliente" && cliente && (
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={padrao} onChange={(e) => setPadrao(e.target.checked)} className="h-4 w-4 accent-accent" />
            Usar como padrão de {cliente.nome} (já vem escolhido no Gerar carrossel)
          </label>
        )}

        <label className="block space-y-1">
          <span className="text-[12px] font-medium text-ink-soft">Tom do texto (opcional)</span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={3000}
            placeholder="Ex.: frases curtas e diretas, fala com 'você', sem emoji."
            className={`${inputClass} resize-y`}
          />
        </label>

        {error && <p className="text-[12.5px] text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:text-ink">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {replace && current ? "Salvar alterações" : "Salvar estilo"}
          </button>
        </div>
      </div>
    </div>
  );
}
