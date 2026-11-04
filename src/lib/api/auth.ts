// Autenticação das rotas de integração (/api/v1/*), usadas por outros sistemas da Mantora
// (ex.: o Escritório virtual). O editor no navegador não passa por aqui.
//
// A chave fica só na variável DESIGN_API_KEY (Railway). Quem chama envia
// "Authorization: Bearer <chave>". Sem a variável, a API fica desligada.

import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_API_KEY_LENGTH = 32;

export type ApiAuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string };

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compara a chave enviada com a configurada, em tempo constante. */
export function checkApiKey(authorization: string | null, configuredKey: string | undefined): ApiAuthResult {
  const expected = configuredKey?.trim();
  if (!expected || expected.length < MIN_API_KEY_LENGTH) {
    return { ok: false, status: 503, error: "API de integração desligada: configure DESIGN_API_KEY (mínimo de 32 caracteres)." };
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
  if (!match || !timingSafeEqual(digest(match[1].trim()), digest(expected))) {
    return { ok: false, status: 401, error: "Chave de acesso inválida." };
  }
  return { ok: true };
}

export function authorizeRequest(request: Request): ApiAuthResult {
  return checkApiKey(request.headers.get("authorization"), process.env.DESIGN_API_KEY);
}
