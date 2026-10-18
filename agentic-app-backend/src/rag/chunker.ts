export interface Chunk {
  text: string;
  section: string;
  index: number;
}

function splitUnit(u: string, limit: number): string[] {
  if (u.length <= limit) return [u];
  const lines = u.split("\n");
  if (lines.length > 1) return lines.flatMap((l) => splitUnit(l, limit));
  const out: string[] = [];
  let cur = "";
  for (const w of u.split(/(?<=\s)/)) {
    if ((cur + w).length > limit && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += w;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.flatMap((p) => (p.length > limit ? p.match(new RegExp(`.{1,${limit}}`, "gs")) ?? [p] : [p]));
}

export function chunkMarkdown(raw: string, opts: { maxChars?: number; overlapChars?: number } = {}): Chunk[] {
  const maxChars = opts.maxChars ?? 900;
  const overlap = opts.overlapChars ?? 100;

  type Section = { path: string[]; body: string[] };
  const sections: Section[] = [];
  let stack: { level: number; title: string }[] = [];
  let cur: Section = { path: [], body: [] };
  const flush = () => {
    if (cur.body.join("\n").trim()) sections.push(cur);
  };

  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*-{3,}\s*$/.test(line)) continue; // horizontal rules carry no content
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      const level = m[1].length;
      stack = stack.filter((h) => h.level < level);
      stack.push({ level, title: m[2].trim() });
      cur = { path: stack.map((h) => h.title), body: [] };
    } else {
      cur.body.push(line);
    }
  }
  flush();

  const chunks: Chunk[] = [];
  for (const s of sections) {
    const section = s.path.join(" › ");
    const prefix = section ? section + "\n" : "";
    const budget = Math.max(200, maxChars - prefix.length);
    const units = s.body
      .join("\n")
      .split(/\n\s*\n/)
      .map((x) => x.trim())
      .filter(Boolean)
      .flatMap((u) => splitUnit(u, budget));

    const pieces: string[] = [];
    let group: string[] = [];
    let len = 0;
    for (const u of units) {
      if (group.length && len + u.length + 1 > budget) {
        pieces.push(group.join("\n"));
        const last = group[group.length - 1];
        group = last.length <= overlap && last.length + u.length + 1 <= budget ? [last] : [];
        len = group.reduce((n, g) => n + g.length + 1, 0);
      }
      group.push(u);
      len += u.length + 1;
    }
    if (group.length) pieces.push(group.join("\n"));

    for (const p of pieces) chunks.push({ text: prefix + p, section, index: chunks.length });
  }
  return chunks;
}