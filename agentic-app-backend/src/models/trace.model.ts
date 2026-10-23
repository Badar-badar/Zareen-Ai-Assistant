import mongoose from "mongoose";

const TraceSchema = new mongoose.Schema({
  traceId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  startedAt: { type: Date, required: true, index: true },
  durationMs: Number,
  stopReason: String,
  inputTokens: Number,
  outputTokens: Number,
  costUsd: Number,
  spans: [mongoose.Schema.Types.Mixed],
  expiresAt: { type: Date, required: true },
});
TraceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Trace", TraceSchema);