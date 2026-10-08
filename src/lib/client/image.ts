// Redimensiona imagens no navegador antes de enviar ao servidor,
// para manter os payloads pequenos e o rascunho cabendo no localStorage.

export async function imageFileToDataUrl(
  file: File,
  options: { maxSide: number; square?: boolean; quality?: number },
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (options.square) {
      const side = Math.min(sw, sh);
      sx = (sw - side) / 2;
      sy = (sh - side) / 2;
      sw = sh = side;
    }
    const scale = Math.min(1, options.maxSide / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", options.quality ?? 0.88);
  } finally {
    bitmap.close();
  }
}
