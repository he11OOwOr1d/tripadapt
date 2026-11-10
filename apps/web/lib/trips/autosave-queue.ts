/** Coalesces edits while a write is in flight; a stale write never runs in parallel. */
export class AutosaveQueue<T, R> {
  private pending: T | undefined;
  private running: Promise<void> | undefined;
  private stopped = false;
  private failed = false;
  constructor(
    private write: (value: T) => Promise<R>,
    private events: {
      start: () => void;
      saved: (value: T, result: R) => void;
      error: (error: unknown) => void;
    },
  ) {}
  enqueue(value: T) {
    this.pending = value;
    return this.run();
  }
  retry() {
    this.failed = false;
    return this.run();
  }
  private run(): Promise<void> {
    if (this.running) return this.running;
    if (this.stopped || this.failed || this.pending === undefined)
      return Promise.resolve();
    this.running = (async () => {
      while (!this.stopped && this.pending !== undefined) {
        const value = this.pending;
        this.pending = undefined;
        this.events.start();
        try {
          const result = await this.write(value);
          if (!this.stopped) this.events.saved(value, result);
        } catch (error) {
          this.failed = true;
          this.pending ??= value;
          if (!this.stopped) this.events.error(error);
          break;
        }
      }
    })().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  async flush() {
    await this.run();
    if (this.failed)
      throw new Error(
        "Automatic saving needs attention. Your local copy is kept.",
      );
  }
  dispose() {
    this.stopped = true;
    this.pending = undefined;
  }
}
