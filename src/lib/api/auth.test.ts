import { describe, expect, it } from "vitest";
import { checkApiKey } from "./auth";

const KEY = "k".repeat(40);

describe("checkApiKey", () => {
  it("desliga a API quando a chave não está configurada ou é curta", () => {
    expect(checkApiKey(`Bearer ${KEY}`, undefined)).toMatchObject({ ok: false, status: 503 });
    expect(checkApiKey("Bearer curta", "curta")).toMatchObject({ ok: false, status: 503 });
  });

  it("recusa chave ausente, errada ou sem Bearer", () => {
    expect(checkApiKey(null, KEY)).toMatchObject({ ok: false, status: 401 });
    expect(checkApiKey(`Bearer ${KEY}x`, KEY)).toMatchObject({ ok: false, status: 401 });
    expect(checkApiKey(KEY, KEY)).toMatchObject({ ok: false, status: 401 });
  });

  it("aceita a chave certa", () => {
    expect(checkApiKey(`Bearer ${KEY}`, KEY)).toEqual({ ok: true });
    expect(checkApiKey(`bearer  ${KEY} `, `${KEY}\n`)).toEqual({ ok: true });
  });
});
