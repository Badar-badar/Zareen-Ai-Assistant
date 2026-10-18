const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2060\uFEFF\u202A-\u202E]/g;

const envDomains = () =>
  (process.env.ALLOWED_LINK_DOMAINS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

function isAllowed(url: string, domains: string[]) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return domains.some((d) => h === d || h.endsWith("." + d));
  } catch {
    return false;
  }
}

// Images auto-load, so they can leak data inside their URL. Links to unknown sites are removed too.
export function sanitizeReply(input: string, opts: { allowedDomains?: string[] } = {}) {
  const domains = opts.allowedDomains ?? envDomains();
  const removed: string[] = [];
  const note = (k: string) => {
    if (!removed.includes(k)) removed.push(k);
  };

  let t = input.replace(CONTROL, () => (note("hidden_chars"), ""));
  t = t.replace(/!\[[^\]]*\]\([^)]*\)|!\[[^\]]*\]\[[^\]]*\]/g, () => (note("image"), ""));
  t = t.replace(/<\/?[a-zA-Z][^>]*>/g, () => (note("html"), ""));
  t = t.replace(/\[([^\]]*)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)/g, (m, label, url) =>
    isAllowed(url, domains) ? m : (note("link"), label)
  );
  t = t.replace(/https?:\/\/[^\s)<>\]]+/gi, (u) => (isAllowed(u, domains) ? u : (note("link"), "[link removed]")));

  return { text: t.trim(), removed };
}