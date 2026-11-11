import { describe, expect, it } from "vitest";
import { UndoStack } from "./undo-stack";

describe("UndoStack", () => {
  const make = () => new UndoStack<string>((a, b) => a === b);

  it("junta mudanças rápidas num passo só e desfaz/refaz", () => {
    const s = make();
    s.record("A", 0);
    expect(s.canUndo).toBe(false);
    s.record("B", 1000);
    s.record("B2", 1100);
    s.record("B3", 1200);
    s.record("C", 5000);
    expect(s.undo()).toBe("B3");
    expect(s.undo()).toBe("A");
    expect(s.undo()).toBeUndefined();
    expect(s.redo()).toBe("B3");
  });

  it("mudança nova apaga o refazer", () => {
    const s = make();
    s.record("A", 0);
    s.record("B", 1000);
    s.undo();
    s.record("A", 1500);
    expect(s.canRedo).toBe(true);
    s.record("C", 3000);
    expect(s.canRedo).toBe(false);
  });

  it("silent não vira passo e reset começa do zero", () => {
    const s = make();
    s.record("A", 0);
    s.record("B", 1000);
    s.silent();
    s.record("B+imagem", 2000);
    expect(s.undo()).toBe("A");
    s.reset();
    s.record("novo", 3000);
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
  });
});
