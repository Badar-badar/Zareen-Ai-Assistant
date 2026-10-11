const positive = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const SESSION = {
  ttlMs: positive("SESSION_TTL_HOURS", 24) * 60 * 60 * 1000,
  historyCharBudget: positive("HISTORY_CHAR_BUDGET", 8_000),
  maxMessages: positive("SESSION_MAX_MESSAGES", 100),
  maxStoredChars: 8_000,
};