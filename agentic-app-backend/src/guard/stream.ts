import { sanitizeReply } from "./output.js";

// Index up to which text is safe to release: ends at whitespace, and never inside an
// unfinished [link](url), ![image](url) or <tag>.
export function safeCut(raw: string): number {
  const ws = Math.max(raw.lastIndexOf(" "), raw.lastIndexOf("\n"));
  let cut = ws + 1;
  const head = raw.slice(0, cut);

  const lb = head.lastIndexOf("[");
  if (lb !== -1) {
    const rest = head.slice(lb);
    const rb = rest.indexOf("]");
    const paren = rest.indexOf("](");
    if (rb === -1 || (paren !== -1 && rest.indexOf(")", paren) === -1)) cut = Math.min(cut, lb);
  }
  const lt = head.lastIndexOf("<");
  if (lt !== -1 && head.indexOf(">", lt) === -1) cut = Math.min(cut, lt);
  return cut;
}

// Releases sanitized text as it arrives. The final text always equals sanitizeReply(fullText).
export class StreamSanitizer {
  private raw = "";
  private sent = "";

  push(delta: string): string {
    this.raw += delta;
    const clean = sanitizeReply(this.raw.slice(0, safeCut(this.raw))).text;
    if (!clean.startsWith(this.sent)) return ""; // wait; finish() corrects it
    const out = clean.slice(this.sent.length);
    this.sent = clean;
    return out;
  }

  finish(): { delta: string; replace?: string; text: string; removed: string[] } {
    const full = sanitizeReply(this.raw);
    if (full.text.startsWith(this.sent)) {
      const delta = full.text.slice(this.sent.length);
      this.sent = full.text;
      return { delta, text: full.text, removed: full.removed };
    }
    this.sent = full.text;
    return { delta: "", replace: full.text, text: full.text, removed: full.removed };
  }
}