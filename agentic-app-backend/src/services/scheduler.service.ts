import SettingModel from "../models/setting.model.js";
import JobRunModel from "../models/jobRun.model.js";
import AlertModel from "../models/alert.model.js";
import WorkflowModel from "../models/workflow.model.js";
import { createWorkflow, runWorkflow } from "./workflow.service.js";
import "../workflows/attentionReport.js"; // registers the job's workflow type

// The robot's identity. No human can log in as it, and the workflow API never shows it to a user.
export const SERVICE_USER_ID = "service:scheduler";

const STARTED_AT = Date.now();
const KEEP_MS = 30 * 86_400_000;
const STUCK_MS = 30 * 60_000;

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), type: "scheduler", event, ...data }));

export const envEnabled = () => process.env.SCHEDULER_ENABLED === "true";

export function schedule() {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(process.env.SCHEDULE_DAILY_AT_UTC ?? "");
  return {
    everyMinutes: process.env.SCHEDULE_EVERY_MINUTES ? num("SCHEDULE_EVERY_MINUTES", 0) : 0,
    dailyAt: m ? m[0] : "08:00",
  };
}

// Which scheduled time is "now" in? null = today's time has not arrived yet.
export function currentSlot(now: Date, opts: { everyMinutes?: number; dailyAt: string }): string | null {
  if (opts.everyMinutes) {
    const ms = opts.everyMinutes * 60_000;
    return `every${opts.everyMinutes}:${Math.floor(now.getTime() / ms)}`;
  }
  const [h, m] = opts.dailyAt.split(":").map(Number);
  const due = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m);
  return now.getTime() < due ? null : new Date(due).toISOString().slice(0, 16);
}

// ---- kill switch (second layer: a database flag an admin can flip at runtime) ----
export async function isPaused(): Promise<boolean> {
  const s = await SettingModel.findOne({ key: "scheduler.paused" }).lean<any>();
  return s?.value === true;
}
export async function setPaused(value: boolean, by: string) {
  await SettingModel.updateOne({ key: "scheduler.paused" }, { $set: { value, updatedBy: by } }, { upsert: true });
  log(value ? "paused" : "resumed", { by });
}

// ---- alerts: log + stored record + optional webhook. The same problem alerts once. ----
export async function raiseAlert(kind: string, job: string, message: string, key: string): Promise<boolean> {
  try {
    await AlertModel.create({ key, kind, job, message, expiresAt: new Date(Date.now() + KEEP_MS) });
  } catch (e: any) {
    if (e?.code === 11000) return false; // already raised
    throw e;
  }
  console.error(JSON.stringify({ at: new Date().toISOString(), type: "alert", kind, job, message }));
  const url = process.env.ALERT_WEBHOOK_URL;
  if (url) {
    try {
      // "text" is for Slack, "content" is for Discord
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `[${kind}] ${job}: ${message}`, content: `[${kind}] ${job}: ${message}` }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (e) {
      console.error("alert webhook failed", (e as Error).message); // an alert must never crash the scheduler
    }
  }
  return true;
}

interface JobDef {
  name: string;
  workflow: string;
  params: () => Record<string, unknown>;
}
const JOBS: JobDef[] = [
  {
    name: "attentionReport",
    workflow: "dailyAttentionReport",
    params: () => ({ forceFail: process.env.SCHEDULER_FORCE_FAIL === "true" }),
  },
];

async function failRun(run: any, message: string) {
  const r = await JobRunModel.updateOne(
    { _id: run._id, status: "started" },
    { $set: { status: "failed", error: message.slice(0, 300), finishedAt: new Date() } }
  );
  if (r.modifiedCount === 1) await raiseAlert("job_failed", run.job, message, `fail:${run._id}`);
}

// Compares each started run with its workflow. This also covers runs finished by Day 12's resume after a restart.
export async function reconcile(now = new Date()) {
  const runs = await JobRunModel.find({ status: "started" }).limit(20).lean<any[]>();
  for (const r of runs) {
    const age = now.getTime() - new Date(r.startedAt).getTime();
    if (!r.workflowId) {
      if (age > 5 * 60_000) await failRun(r, "the workflow was never created");
      continue;
    }
    const wf = await WorkflowModel.findById(r.workflowId).select("status error").lean<any>();
    if (!wf) await failRun(r, "the workflow record is missing");
    else if (wf.status === "done") {
      await JobRunModel.updateOne({ _id: r._id, status: "started" }, { $set: { status: "done", finishedAt: now } });
      log("run_done", { job: r.job, slot: r.slot });
    } else if (wf.status === "failed") await failRun(r, wf.error ?? "the workflow failed");
    else if (age > STUCK_MS) await failRun(r, "the run is taking too long (stuck?)");
  }
}

// A job that silently stopped running is a failure too
export async function checkMissed(now = new Date()) {
  const { everyMinutes } = schedule();
  const limitMs = everyMinutes ? Math.max(everyMinutes * 3, 5) * 60_000 : 26 * 3_600_000;
  for (const job of JOBS) {
    const last = await JobRunModel.findOne({ job: job.name, status: "done" }).sort({ finishedAt: -1 }).lean<any>();
    const base = Math.max(last?.finishedAt ? new Date(last.finishedAt).getTime() : 0, STARTED_AT);
    if (now.getTime() - base > limitMs) {
      await raiseAlert("missed_run", job.name, "no successful run within the expected time", `missed:${job.name}:${now.toISOString().slice(0, 10)}`);
    }
  }
}

async function startIfDue(job: JobDef, slot: string, now: Date) {
  // Budget for a robot: a maximum number of runs per 24 hours
  const cap = num("SCHEDULER_MAX_RUNS_PER_DAY", 48);
  const recent = await JobRunModel.countDocuments({ job: job.name, startedAt: { $gte: new Date(now.getTime() - 86_400_000) } });
  if (recent >= cap) {
    await raiseAlert("run_cap", job.name, `reached ${cap} runs in 24 hours, not starting more`, `cap:${job.name}:${now.toISOString().slice(0, 10)}`);
    return;
  }

  let run: any;
  try {
    run = await JobRunModel.create({ job: job.name, slot, startedAt: now, expiresAt: new Date(now.getTime() + KEEP_MS) });
  } catch (e: any) {
    if (e?.code === 11000) return; // another copy (or an earlier tick) already claimed this slot
    throw e;
  }

  try {
    const workflowId = await createWorkflow(SERVICE_USER_ID, job.workflow, job.params());
    await JobRunModel.updateOne({ _id: run._id }, { $set: { workflowId } });
    log("run_started", { job: job.name, slot, workflowId });
    void runWorkflow(workflowId).catch((e) => console.error("scheduled run crashed", e?.message));
  } catch (e) {
    await failRun(run, `could not start: ${(e as Error).message}`);
  }
}

export async function tick(now = new Date()) {
  if (!envEnabled()) return; // kill switch, layer 1
  await reconcile(now); // runs already in flight are still watched while paused
  if (await isPaused()) return; // kill switch, layer 2: no new runs, no missed-run alerts
  const slot = currentSlot(now, schedule());
  if (slot) for (const job of JOBS) await startIfDue(job, slot, now);
  await checkMissed(now);
}

export function startScheduler() {
  if (!envEnabled()) {
    log("disabled", { reason: "SCHEDULER_ENABLED is not true" });
    return;
  }
  const every = num("SCHEDULER_TICK_MS", 60_000);
  log("started", { tickMs: every, ...schedule() });
  const run = () => void tick().catch((e) => console.error("scheduler tick failed", e?.message));
  run();
  setInterval(run, every).unref();
}

export async function status() {
  const [runs, alerts] = await Promise.all([
    JobRunModel.find().sort({ startedAt: -1 }).limit(5).select("-_id job slot status startedAt finishedAt error").lean(),
    AlertModel.find().sort({ createdAt: -1 }).limit(5).select("-_id kind job message createdAt").lean(),
  ]);
  return { enabledByEnv: envEnabled(), paused: await isPaused(), schedule: schedule(), lastRuns: runs, lastAlerts: alerts };
}