import mongoose from "mongoose";

const JobRunSchema = new mongoose.Schema({
  job: { type: String, required: true },
  slot: { type: String, required: true }, // which scheduled time this run belongs to
  status: { type: String, enum: ["started", "done", "failed"], default: "started" },
  workflowId: String,
  startedAt: { type: Date, required: true },
  finishedAt: Date,
  error: String,
  expiresAt: { type: Date, required: true },
});
// The unique pair is the atomic claim: only one server can start a given job for a given slot
JobRunSchema.index({ job: 1, slot: 1 }, { unique: true });
JobRunSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("JobRun", JobRunSchema);