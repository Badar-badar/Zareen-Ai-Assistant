import { randomUUID } from "node:crypto";
import WorkflowModel from "../models/workflow.model.js";

// Throw this for errors that retrying cannot fix
export class PermanentError extends Error {}

export interface StepCtx {
  userId: string;
  params: any;
  outputs: Record<string, any>; // saved outputs of earlier steps, by step name
}
export interface StepDef {
  name: string;
  run: (ctx: StepCtx) => Promise<unknown>;
}
export interface WorkflowDef {
  steps: StepDef[];
}
export const WORKFLOWS: Record<string, WorkflowDef> = {};

const INSTANCE = randomUUID().slice(0, 8);
const LEASE_MS = 15_000;
const HEARTBEAT_MS = 5_000;
const KEEP_MS = 7 * 86_400_000;

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const maxAttempts = () => num("WORKFLOW_MAX_ATTEMPTS", 3);
const backoffMs = () => num("WORKFLOW_BACKOFF_MS", 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), type: "workflow", runner: INSTANCE, event, ...data }));

export async function createWorkflow(userId: string, type: string, params: unknown): Promise<string> {
  const def = WORKFLOWS[type];
  if (!def) throw new Error(`Unknown workflow type: ${type}`);
  const doc = await WorkflowModel.create({
    userId,
    type,
    params,
    steps: def.steps.map((s) => ({ name: s.name })),
    expiresAt: new Date(Date.now() + KEEP_MS),
  });
  return doc._id.toString();
}

// ONE atomic step: only one runner can take a workflow whose lease is free or expired
async function claim(id: string) {
  const now = new Date();
  return WorkflowModel.findOneAndUpdate(
    {
      _id: id,
      status: { $in: ["pending", "running"] },
      $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }],
    },
    { $set: { status: "running", runner: INSTANCE, leaseUntil: new Date(now.getTime() + LEASE_MS) } },
    { returnDocument: "after" }
  ).lean<any>();
}

async function failWorkflow(id: string, message: string) {
  await WorkflowModel.updateOne({ _id: id }, { $set: { status: "failed", error: message, leaseUntil: null } });
  log("workflow_failed", { id, message });
}

// Runs one step with retries. Returns true when the step is done.
async function runStep(id: string, i: number, def: StepDef, ctx: StepCtx): Promise<boolean> {
  const p = `steps.${i}`;
  for (;;) {
    const upd = await WorkflowModel.findOneAndUpdate(
      { _id: id, runner: INSTANCE },
      { $set: { [`${p}.status`]: "running", [`${p}.startedAt`]: new Date() }, $inc: { [`${p}.attempts`]: 1 } },
      { returnDocument: "after" }
    ).lean<any>();
    if (!upd) return false; // we lost the lease
    const attempts: number = upd.steps[i].attempts;
    log("step_start", { id, step: def.name, attempt: attempts });

    try {
      const out = await def.run(ctx);
      await WorkflowModel.updateOne(
        { _id: id, runner: INSTANCE },
        { $set: { [`${p}.status`]: "done", [`${p}.output`]: out ?? null, [`${p}.finishedAt`]: new Date(), [`${p}.error`]: null } }
      );
      ctx.outputs[def.name] = out ?? null;
      log("step_done", { id, step: def.name });
      return true;
    } catch (err) {
      const msg = ((err as Error).message ?? "error").slice(0, 300);
      const permanent = err instanceof PermanentError;
      if (permanent || attempts >= maxAttempts()) {
        await WorkflowModel.updateOne({ _id: id }, { $set: { [`${p}.status`]: "failed", [`${p}.error`]: msg } });
        await failWorkflow(id, `Step "${def.name}" failed: ${msg}`);
        return false;
      }
      const wait = backoffMs() * 2 ** (attempts - 1);
      await WorkflowModel.updateOne({ _id: id }, { $set: { [`${p}.error`]: msg } });
      log("step_retry", { id, step: def.name, attempt: attempts, waitMs: wait, message: msg });
      await sleep(wait);
    }
  }
}

// Returns true only if the workflow finished
export async function runWorkflow(id: string): Promise<boolean> {
  const wf = await claim(id);
  if (!wf) return false;

  const def = WORKFLOWS[wf.type];
  if (!def) {
    await failWorkflow(id, `Unknown workflow type: ${wf.type}`);
    return false;
  }

  let lost = false;
  const beat = setInterval(async () => {
    try {
      const r = await WorkflowModel.updateOne(
        { _id: id, runner: INSTANCE, status: "running" },
        { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } }
      );
      if (r.matchedCount === 0) lost = true;
    } catch {
      /* the next beat will try again */
    }
  }, HEARTBEAT_MS);

  try {
    log("workflow_run", { id, type: wf.type });
    const ctx: StepCtx = { userId: wf.userId, params: wf.params ?? {}, outputs: {} };

    for (let i = 0; i < def.steps.length; i++) {
      if (lost) return false;
      const fresh = await WorkflowModel.findById(id).lean<any>();
      const saved = fresh?.steps?.[i];
      if (!saved) return false;

      if (saved.status === "done") {
        ctx.outputs[def.steps[i].name] = saved.output; // reuse the saved result
        log("step_skipped", { id, step: def.steps[i].name });
        continue;
      }
      if (!(await runStep(id, i, def.steps[i], ctx))) return false;
    }

    const last = def.steps[def.steps.length - 1].name;
    await WorkflowModel.updateOne(
      { _id: id, runner: INSTANCE },
      { $set: { status: "done", result: ctx.outputs[last] ?? null, leaseUntil: null } }
    );
    log("workflow_done", { id });
    return true;
  } catch (err) {
    console.error("workflow crashed", (err as Error).message);
    return false; // the lease expires and a later sweep retries it
  } finally {
    clearInterval(beat);
  }
}

// Picks up workflows nobody is running (never started, or the server died)
export async function resumeWorkflows() {
  const rows = await WorkflowModel.find({
    status: { $in: ["pending", "running"] },
    $or: [{ leaseUntil: null }, { leaseUntil: { $lt: new Date() } }],
  })
    .select("_id")
    .limit(20)
    .lean<any[]>();
  for (const r of rows) {
    log("workflow_resume", { id: String(r._id) });
    void runWorkflow(String(r._id)).catch((e) => console.error("resume failed", e?.message));
  }
}

export function startResumeLoop() {
  void resumeWorkflows().catch((e) => console.error("resume failed", e?.message));
  const t = setInterval(() => void resumeWorkflows().catch(() => {}), HEARTBEAT_MS);
  t.unref();
}