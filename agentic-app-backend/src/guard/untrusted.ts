// Marks tool output as data. Any fake <tool_result> tag inside it is defused, so it can't escape the wrapper.
export function wrapUntrusted(toolName: string, content: string): string {
  const safe = content.replace(/<\s*\/?\s*tool_result[^>]*>/gi, (m) => m.replace(/</g, "‹").replace(/>/g, "›"));
  const name = toolName.replace(/[^A-Za-z0-9_]/g, "");
  return `<tool_result name="${name}" trust="untrusted">\n${safe}\n</tool_result>`;
}

// For database text shown on cards or inside prompts: one line, no markup, no hidden characters, capped
export function sanitizeInline(s: string, max = 80): string {
  return String(s)
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2060\uFEFF\u202A-\u202E]/g, " ")
    .replace(/[<>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}