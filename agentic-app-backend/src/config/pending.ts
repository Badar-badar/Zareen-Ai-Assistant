const positive = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const PENDING = {
  ttlMs: positive("PENDING_ACTION_TTL_MINUTES", 15) * 60_000, // how long a proposal can be confirmed
  maxOpenPerUser: positive("PENDING_MAX_OPEN_PER_USER", 5),    // stops a looping agent from flooding the queue
  keepAuditMs: 7 * 24 * 60 * 60_000,                           // records are deleted a week after expiry
};