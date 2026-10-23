import { randomUUID } from "node:crypto";

export interface SpanRecord {
  id: string;
  parent: string | null;
  name: string;
  startMs: number; // offset from trace start
  durationMs: number;
  attrs: Record<string, string | number | boolean>;
  error?: string;
}

export interface TraceRecord {
  traceId: string;
  userId: string;
  startedAt: Date;
  durationMs: number;
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  spans: SpanRecord[];
}

// Only ids, names, sizes and numbers go into attributes. Never prompts, replies or customer data.
export class Trace {
  readonly traceId = randomUUID();
  readonly startedAt = new Date();
  private t0 = Date.now();
  private spans: SpanRecord[] = [];

  constructor(readonly userId: string) {}

  async span<T>(name: string, attrs: SpanRecord["attrs"], fn: (set: (a: SpanRecord["attrs"]) => void) => Promise<T>, parent: string | null = null): Promise<T> {
    const rec: SpanRecord = { id: randomUUID().slice(0, 8), parent, name, startMs: Date.now() - this.t0, durationMs: 0, attrs: { ...attrs } };
    const start = Date.now();
    try {
      return await fn((a) => Object.assign(rec.attrs, a));
    } catch (e) {
      rec.error = (e as Error).message.slice(0, 200);
      throw e;
    } finally {
      rec.durationMs = Date.now() - start;
      this.spans.push(rec);
    }
  }

  finish(r: { stopReason: string; inputTokens: number; outputTokens: number; costUsd: number }): TraceRecord {
    return { traceId: this.traceId, userId: this.userId, startedAt: this.startedAt, durationMs: Date.now() - this.t0, ...r, spans: this.spans.sort((a, b) => a.startMs - b.startMs) };
  }
}

// Readable timeline for the console: shows where the time went
export function timeline(t: TraceRecord): string {
  const lines = [`trace ${t.traceId.slice(0, 8)}  ${t.durationMs}ms  ${t.stopReason}  $${t.costUsd}`];
  for (const s of t.spans) {
    const pct = t.durationMs ? Math.round((s.durationMs / t.durationMs) * 100) : 0;
    const extra = Object.entries(s.attrs).map(([k, v]) => `${k}=${v}`).join(" ");
    lines.push(`  +${String(s.startMs).padStart(5)}ms ${s.name.padEnd(22)} ${String(s.durationMs).padStart(6)}ms ${String(pct).padStart(3)}%  ${extra}${s.error ? "  ERROR " + s.error : ""}`);
  }
  return lines.join("\n");
}