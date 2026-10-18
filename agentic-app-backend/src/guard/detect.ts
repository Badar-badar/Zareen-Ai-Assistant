import { securityLog } from "./log.js";

export type Risk = "none" | "low" | "high";
export interface Detection {
  risk: Risk;
  matches: string[];
}

const HIDDEN_ONE = /[\u200B-\u200F\u2060\uFEFF\u202A-\u202E]/;
const HIDDEN_ALL = /[\u200B-\u200F\u2060\uFEFF\u202A-\u202E]/g;

const HIGH: [string, RegExp][] = [
  ["ignore_instructions", /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+|your\s+|these\s+|previous\s+|prior\s+|above\s+|earlier\s+)+(instructions?|rules?|prompts?|guidelines?)/i],
  ["reveal_prompt", /\b(reveal|show|print|repeat|output|tell|display)\s+(me\s+)?(your|the)\s+(system|hidden|initial|secret)\s+(prompt|instructions?|message)/i],
  ["role_override", /^\s*(system|assistant|developer)\s*:/im],
  ["new_identity", /\byou are now\b/i],
  ["new_instructions", /\bnew instructions?\s*:/i],
  ["fake_tag", /<\/?\s*(system|tool_result|instructions?)\b/i],
  ["tool_command", /\bpropose(CreateOrder|CreateCustomer|UpdateOrderStatus)\b/],
  ["conceal", /\b(do not|don't|never)\s+(tell|inform|mention|show)\s+(this to\s+)?the user\b/i],
  ["active_html", /<\s*(script|iframe|style)\b/i],
];

const LOW: [string, RegExp][] = [["markdown_image", /!\[[^\]]*\]\(/]];

// Pattern matching is easy to evade. This is for flagging and logging, not the only defence.
export function detectInjection(raw: string): Detection {
  const matches: string[] = [];
  const hasHidden = HIDDEN_ONE.test(raw);
  if (hasHidden) matches.push("hidden_characters");
  const text = raw.replace(HIDDEN_ALL, ""); // "ig<zero-width>nore" is still caught

  let high = false;
  for (const [name, rx] of HIGH) {
    if (rx.test(text)) {
      matches.push(name);
      high = true;
    }
  }
  for (const [name, rx] of LOW) if (rx.test(text)) matches.push(name);

  return { risk: high ? "high" : matches.length ? "low" : "none", matches };
}

// Used by ingestion: high-risk chunks are not indexed
export function screenChunks<T extends { text: string; section: string }>(chunks: T[], file: string) {
  const clean: T[] = [];
  const quarantined: T[] = [];
  for (const c of chunks) {
    const d = detectInjection(c.text);
    if (d.risk === "high") {
      quarantined.push(c);
      securityLog("chunk_quarantined", { file, section: c.section, matches: d.matches });
    } else {
      if (d.risk === "low") securityLog("injection_detected", { file, section: c.section, risk: "low", matches: d.matches });
      clean.push(c);
    }
  }
  return { clean, quarantined };
}