import mongoose from "mongoose";

const StepSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: { type: String, enum: ["pending", "running", "done", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    output: mongoose.Schema.Types.Mixed,
    error: String,
    startedAt: Date,
    finishedAt: Date,
  },
  { _id: false }
);

const WorkflowSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    params: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ["pending", "running", "done", "failed"], default: "pending", index: true },
    steps: [StepSchema],
    runner: String, // which server instance holds the lease
    leaseUntil: Date, // after this time another runner may take over
    result: mongoose.Schema.Types.Mixed,
    error: String,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
WorkflowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Workflow", WorkflowSchema);