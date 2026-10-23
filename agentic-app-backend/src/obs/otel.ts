import type { TraceRecord } from "./trace.js";

// OpenTelemetry export is switched off for now. Our own tracer (console + MongoDB) is the source of truth.
export function initOtel() {}
export function exportToOtel(_t: TraceRecord) {}