"use client";

// "Gerar carrossel com IA": parte da pauta com copy aprovada no Motor de Conteúdo (ou de um tema)
// e monta os slides com os modelos do editor. A legenda fica no rascunho para copiar.

import { useEffect, useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { inputClass, Panel, Segmented } from "@/components/editor/ui";
import type { Estilo } from "@/lib/estilos";
import { FREE_PRESETS } from "@/lib/templates/free";

interface PautaResumo {
  id: number;
  titulo: string;
  formato: string | null;
  status: string;
}

export interface GeneratedSlide {
  tipo: "capa" | "texto" | "lista" | "numero" | "citacao" | "cta";
  etiqueta: string;
  titulo: string;
  texto: string;
  /** Modelo do Livre escolhido pela IA para esta tela. */
  modelo?: string;
  /** Descrição da foto para gerar com IA (vazia quando o modelo não usa foto). */
  imagem?: string;
  /** A foto mostra o próprio cliente. */
  rosto?: boolean;
}

export type GeneratorStyle = "revista" | "classico";
export type GeneratorImages = "nenhuma" | "capa" | "todas";
export interface GeneratorOptions {
  style: GeneratorStyle;
  images: GeneratorImages;
  /** Estilo de referência usado (cores, fonte e estilo das imagens vêm dele). */
  estilo?: Estilo | null;
}

const CAPAS = FREE_PRESETS.filter((p) => p.category === "capa");
const INTERNOS = FREE_PRESETS.filter((p) => p.category === "interno");

export function GeneratorPanel({
  clienteSlug,
  nome,
  handle,
  initialPautaId,
  legenda,
  onGenerated,
  onError,
  onInfo,
}: {
  clienteSlug: string | null;
  nome: string;
  handle: string;
  /** Pauta vinda do link "Abrir no Design Mantora" do Escritório. */
  initialPautaId: number | null;
  legenda: string | null;
  onGenerated: (slides: GeneratedSlide[], legenda: string, options: GeneratorOptions) => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}) {
  const [source, setSource] = useState<"pauta" | "tema">(initialPautaId ? "pauta" : clienteSlug ? "pauta" : "tema");
  const [pautas, setPautas] = useState<PautaResumo[] | null>(null);
  const [pautaId, setPautaId] = useState<number | null>(initialPautaId);
  const [tema, setTema] = useState("");
  const [count, setCount] = useState<number | null>(null);
  // Sempre estilo revista (telas Livre, com modelos, imagens e estilo de referência). Os layouts
  // clássicos continuam no seletor "Layout" de cada tela; só saíram da geração.
  const style: GeneratorStyle = "revista";
  const [capa, setCapa] = useState("");
  const [interno, setInterno] = useState("");
  const [images, setImages] = useState<GeneratorImages>("nenhuma");
  const [busy, setBusy] = useState(false);
  const [estilos, setEstilos] = useState<Estilo[]>([]);
  /** "" = sem estilo (a IA escolhe entre todos os modelos). */
  const [estiloId, setEstiloId] = useState("");

  // Estilos do cliente e da agência; o padrão do cliente já vem marcado.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/estudio/estilos${clienteSlug ? `?cliente=${encodeURIComponent(clienteSlug)}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: Estilo[] = data.estilos ?? [];
        setEstilos(list);
        setEstiloId(list.find((e) => e.padrao && e.cliente_slug === clienteSlug)?.id ?? "");
      })
      .catch(() => !cancelled && setEstilos([]));
    return () => {
      cancelled = true;
    };
  }, [clienteSlug]);

  useEffect(() => {
    if (!clienteSlug) return;
    let cancelled = false;
    fetch(`/api/estudio/pautas?cliente=${encodeURIComponent(clienteSlug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPautas(data.pautas ?? []);
      })
      .catch(() => !cancelled && setPautas([]));
    return () => {
      cancelled = true;
    };
  }, [clienteSlug]);

  useEffect(() => {
    if (initialPautaId) {
      setPautaId(initialPautaId);
      setSource("pauta");
    }
  }, [initialPautaId]);

  const generate = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/estudio/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pautaId: source === "pauta" ? pautaId : null,
          tema: source === "tema" ? tema : null,
          nome,
          handle,
          clienteSlug,
          slides: count,
          capa: style === "revista" && capa && !estiloId ? capa : null,
          interno: style === "revista" && interno && !estiloId ? interno : null,
          estiloId: style === "revista" && estiloId ? estiloId : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Erro ao gerar.");
      onInfo(`${data.slides.length} telas montadas (US$ ${String(data.custo_usd).replace(".", ",")}).`);
      onGenerated(data.slides, data.legenda ?? "", { style, images: style === "revista" ? images : "nenhuma", estilo: data.estilo ?? null });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erro ao gerar.");
    } finally {
      setBusy(false);
    }
  };

  const ready = source === "pauta" ? Boolean(pautaId) : tema.trim().length >= 5;

  return (
    <Panel title="Gerar carrossel com IA">
      <div className="space-y-3">
        <Segmented
          value={source}
          options={[
            { value: "pauta", label: "Pauta do Motor" },
            { value: "tema", label: "Tema livre" },
          ]}
          onChange={setSource}
        />
        {source === "pauta" ? (
          !clienteSlug ? (
            <p className="text-[12.5px] text-ink-soft">Escolha o cliente no painel Cliente para ver as pautas com copy pronta.</p>
          ) : pautas === null ? (
            <p className="flex items-center gap-2 text-[12.5px] text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando pautas…
            </p>
          ) : (
            <select value={pautaId ?? ""} onChange={(e) => setPautaId(e.target.value ? Number(e.target.value) : null)} className={inputClass}>
              <option value="">{pautas.length ? "Escolha a pauta" : "Nenhuma pauta com copy pronta"}</option>
              {pautas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo.slice(0, 90)}
                </option>
              ))}
              {pautaId && !pautas.some((p) => p.id === pautaId) && <option value={pautaId}>Pauta #{pautaId}</option>}
            </select>
          )
        ) : (
          <textarea
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            rows={4}
            placeholder="Tema, ideia ou a copy inteira colada aqui."
            className={`${inputClass} resize-y`}
          />
        )}
        <select value={count ?? ""} onChange={(e) => setCount(e.target.value ? Number(e.target.value) : null)} className={inputClass} aria-label="Número de telas">
          <option value="">Telas: automático</option>
          {[4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n} telas
            </option>
          ))}
        </select>
        {style === "revista" && (
          <div className="space-y-2">
            {estilos.length > 0 && (
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-ink-soft">Estilo de referência</span>
              <select value={estiloId} onChange={(e) => setEstiloId(e.target.value)} className={inputClass} aria-label="Estilo de referência">
                <option value="">Nenhum (a IA escolhe os modelos)</option>
                {estilos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                    {e.padrao && e.cliente_slug ? " (padrão do cliente)" : e.cliente_slug ? "" : " (da agência)"}
                  </option>
                ))}
              </select>
              </label>
            )}
            {estiloId && (
              <p className="text-[11.5px] leading-relaxed text-ink-faint">
                {estilos.find((e) => e.id === estiloId)?.descricao ?? "O estilo escolhe os modelos, as cores e o jeito das imagens."}
              </p>
            )}
            {!estiloId && (
              <>
            <select value={capa} onChange={(e) => setCapa(e.target.value)} className={inputClass} aria-label="Modelo da capa">
              <option value="">Capa: a IA escolhe</option>
              {CAPAS.map((p) => (
                <option key={p.id} value={p.id}>
                  Capa: {p.label}
                </option>
              ))}
            </select>
            <select value={interno} onChange={(e) => setInterno(e.target.value)} className={inputClass} aria-label="Modelo das telas internas">
              <option value="">Telas internas: a IA escolhe</option>
              {INTERNOS.map((p) => (
                <option key={p.id} value={p.id}>
                  Internas: {p.label}
                </option>
              ))}
            </select>
              </>
            )}
            <select value={images} onChange={(e) => setImages(e.target.value as GeneratorImages)} className={inputClass} aria-label="Imagens com IA">
              <option value="nenhuma">Imagens com IA: não gerar</option>
              <option value="capa">Imagens com IA: só a capa</option>
              <option value="todas">Imagens com IA: todas as telas com foto</option>
            </select>
            {images !== "nenhuma" && (
              <p className="text-[11.5px] leading-relaxed text-ink-faint">
                Cada imagem custa cerca de US$ 0,04 e entra no limite do mês. Quando a tela mostra o cliente, o rosto vem do logo/foto do kit.
              </p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={generate}
          disabled={busy || !ready}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Montando as telas…" : "Gerar carrossel"}
        </button>
        <p className="text-[11.5px] leading-relaxed text-ink-faint">Segue a divisão de telas da copy quando ela já vem dividida. O carrossel atual fica salvo em Abrir peça.</p>
        {legenda && (
          <div className="space-y-1.5 rounded-lg bg-canvas p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-soft">Legenda</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(legenda).then(() => onInfo("Legenda copiada."), () => onError("Não foi possível copiar."))}
                className="inline-flex items-center gap-1 text-[12px] text-accent"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </button>
            </div>
            <p className="max-h-40 overflow-y-auto whitespace-pre-line text-[12px] leading-relaxed text-ink-soft">{legenda}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
