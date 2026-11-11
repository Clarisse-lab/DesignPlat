/**
 * Histórico de desfazer/refazer, sem React (testável).
 *
 * Mudanças seguidas e rápidas (arrastar um texto, digitar) viram um passo só: um novo passo
 * começa quando a mudança chega depois de `burstMs` sem mexer.
 */
export class UndoStack<T> {
  private past: T[] = [];
  private future: T[] = [];
  private last: T | undefined;
  private lastAt = Number.NEGATIVE_INFINITY;
  /** "reset": a próxima mudança zera o histórico; "silent": entra sem virar passo. */
  private mode: "normal" | "silent" | "reset" = "reset";

  constructor(
    private readonly equals: (a: T, b: T) => boolean,
    private readonly limit = 60,
    private readonly burstMs = 700,
  ) {}

  /** Registra o valor atual do editor. */
  record(value: T, now: number): void {
    if (this.last === undefined || this.mode === "reset") {
      this.past = [];
      this.future = [];
      this.accept(value);
      return;
    }
    if (this.equals(value, this.last)) return;
    if (this.mode === "silent") {
      this.accept(value);
      return;
    }
    if (now - this.lastAt > this.burstMs) {
      this.past.push(this.last);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future = [];
    this.last = value;
    this.lastAt = now;
  }

  private accept(value: T) {
    this.last = value;
    this.lastAt = Number.NEGATIVE_INFINITY;
    this.mode = "normal";
  }

  /** A próxima mudança começa um histórico novo (carrossel gerado, peça aberta, outro cliente). */
  reset(): void {
    this.mode = "reset";
  }

  /** A próxima mudança não vira passo (ex.: imagem da IA chegando sozinha). */
  silent(): void {
    if (this.mode === "normal") this.mode = "silent";
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Volta um passo: devolve o valor a aplicar no editor (ou undefined se não há o que desfazer). */
  undo(): T | undefined {
    const previous = this.past.pop();
    if (previous === undefined || this.last === undefined) return undefined;
    this.future.push(this.last);
    this.accept(previous);
    return previous;
  }

  redo(): T | undefined {
    const next = this.future.pop();
    if (next === undefined || this.last === undefined) return undefined;
    this.past.push(this.last);
    this.accept(next);
    return next;
  }
}
