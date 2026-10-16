"use client";

import { STICKER_SLOT, STORY_SAFE_ZONES } from "@/lib/templates/feed";

/**
 * Guias do Story desenhadas por cima do preview: as faixas que o Instagram cobre
 * (perfil no topo, campo de resposta na base) e o espaço do sticker. Não saem na imagem.
 */
export function StoryGuides({ showStickerSlot }: { showStickerSlot: boolean }) {
  const band = "absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,rgba(17,17,17,.28)_0_6px,rgba(17,17,17,.12)_6px_12px)]";
  const label = "rounded-full bg-black/60 px-2.5 py-1 text-[10.5px] font-medium text-white";
  return (
    <>
      <div className={`${band} top-0`} style={{ height: `${STORY_SAFE_ZONES.topPercent}%` }}>
        <span className={label}>Perfil e barra do Instagram</span>
      </div>
      <div className={`${band} bottom-0`} style={{ height: `${STORY_SAFE_ZONES.bottomPercent}%` }}>
        <span className={label}>Campo de resposta</span>
      </div>
      {showStickerSlot && (
        <div
          className="absolute flex items-center justify-center rounded-xl border-2 border-dashed border-sky-500 bg-sky-500/10"
          style={{
            top: `${STICKER_SLOT.topPercent}%`,
            height: `${STICKER_SLOT.heightPercent}%`,
            left: `${(92 / 1080) * 100}%`,
            right: `${(92 / 1080) * 100}%`,
          }}
        >
          <span className="rounded-full bg-sky-600 px-2.5 py-1 text-[10.5px] font-medium text-white">Cole aqui a enquete, pergunta ou link</span>
        </div>
      )}
    </>
  );
}
