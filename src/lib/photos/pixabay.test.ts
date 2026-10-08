import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { isPixabayImageUrl } = await import("./pixabay");

describe("isPixabayImageUrl", () => {
  it("aceita só imagens https do Pixabay", () => {
    expect(isPixabayImageUrl("https://pixabay.com/get/abc123.jpg")).toBe(true);
    expect(isPixabayImageUrl("https://cdn.pixabay.com/photo/2024/01/01/foto.jpg")).toBe(true);
    expect(isPixabayImageUrl("http://pixabay.com/get/abc.jpg")).toBe(false);
    expect(isPixabayImageUrl("https://pixabay.com.evil.example/x.jpg")).toBe(false);
    expect(isPixabayImageUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isPixabayImageUrl("não é url")).toBe(false);
  });
});
