export type SecurityEvent =
  | "injection_detected"
  | "chunk_quarantined"
  | "tool_result_flagged"
  | "tool_call_blocked"
  | "user_input_flagged"
  | "output_stripped";

// One JSON line per event. Never log the full prompt or document, only what matched.
export function securityLog(event: SecurityEvent, data: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ at: new Date().toISOString(), type: "security", event, ...data }));
}