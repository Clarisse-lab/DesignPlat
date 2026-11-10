import "server-only";
// Peças salvas do estúdio: as imagens (data URLs) saem do JSON e vão para o bucket "design",
// com nome pelo hash do conteúdo (a mesma foto em várias peças vira um arquivo só).

import { createHash } from "node:crypto";
import { downloadObject, uploadObject } from "./supabase";

const DATA_URL = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const REF = /^storage:(pecas\/[a-f0-9]{64}\.(png|jpg|webp))$/;
const EXT: Record<string, string> = { png: "png", jpeg: "jpg", webp: "webp" };

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

async function mapStrings(value: Json, fn: (s: string) => Promise<string>): Promise<Json> {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return Promise.all(value.map((v) => mapStrings(v, fn)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await mapStrings(v, fn)] as const));
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * Arquivos que este servidor já subiu (o nome é o hash do conteúdo, então nunca mudam).
 * O salvamento automático manda a peça inteira a cada mudança: sem isso, subiria as mesmas fotos toda vez.
 */
const KNOWN = new Set<string>();

/** Troca cada imagem em data URL por uma referência ao Storage (sobe a imagem se ainda não existir). */
export async function extractImages(dados: Json): Promise<Json> {
  const uploaded = new Map<string, string>();
  return mapStrings(dados, async (s) => {
    const match = DATA_URL.exec(s);
    if (!match) return s;
    const bytes = Buffer.from(match[3], "base64");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const path = `pecas/${hash}.${EXT[match[2]]}`;
    if (!uploaded.has(path) && !KNOWN.has(path)) {
      await uploadObject(path, bytes, match[1]);
      uploaded.set(path, path);
      KNOWN.add(path);
      if (KNOWN.size > 5000) KNOWN.clear();
    }
    return `storage:${path}`;
  });
}

/** Volta as referências do Storage para data URLs (os templates só carregam imagens embutidas). */
export async function restoreImages(dados: Json): Promise<Json> {
  const cache = new Map<string, Promise<string>>();
  return mapStrings(dados, async (s) => {
    const match = REF.exec(s);
    if (!match) return s;
    if (!cache.has(match[1])) {
      cache.set(
        match[1],
        downloadObject(match[1])
          .then(({ bytes, contentType }) => `data:${contentType.split(";")[0]};base64,${bytes.toString("base64")}`)
          .catch((error) => {
            console.error("[pecas] imagem não encontrada:", match[1], error);
            return "";
          }),
      );
    }
    return cache.get(match[1])!;
  });
}

export type { Json };
