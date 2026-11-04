import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../render/browser", () => ({ getBrowser: vi.fn() }));

const { isMetaImageUrl } = await import("./identity");

describe("isMetaImageUrl", () => {
  it("aceita só HTTPS dos domínios da Meta", () => {
    expect(isMetaImageUrl("https://scontent-gru2-1.cdninstagram.com/v/t51/abc.jpg?x=1")).toBe(true);
    expect(isMetaImageUrl("https://scontent-gru2-1.xx.fbcdn.net/v/t51/abc.jpg")).toBe(true);
    expect(isMetaImageUrl("http://scontent.cdninstagram.com/a.jpg")).toBe(false);
    expect(isMetaImageUrl("https://cdninstagram.com.evil.com/a.jpg")).toBe(false);
    expect(isMetaImageUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isMetaImageUrl("não é url")).toBe(false);
  });
});
