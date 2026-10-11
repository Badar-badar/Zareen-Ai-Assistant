const positive = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const price = (name: string) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

export const AGENT = {
  maxSteps: positive("AGENT_MAX_STEPS", 6),
  totalTimeoutMs: positive("AGENT_TIMEOUT_MS", 30_000),
  toolTimeoutMs: positive("AGENT_TOOL_TIMEOUT_MS", 10_000),
  tokenBudget: positive("AGENT_TOKEN_BUDGET", 20_000),
  maxToolCallsPerStep: positive("AGENT_MAX_TOOL_CALLS_PER_STEP", 4),
  maxToolResultChars: positive("AGENT_MAX_TOOL_RESULT_CHARS", 6_000),
  priceInputPerMTok: price("PRICE_INPUT_PER_MTOK"),
  priceOutputPerMTok: price("PRICE_OUTPUT_PER_MTOK"),
};

// Least privilege: only these tools are ever shown to the model, even if the MCP server registers more later
export const ALLOWED_TOOLS = new Set([
  "getCustomers",
  "getCustomerById",
  "getLatestOrders",
  "getOrderWithCustomerDetails",
  "getOrderById",
  "fetchWeather",
  "ragSearch",
]);