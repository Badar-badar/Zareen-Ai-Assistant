import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import WorkflowModel from "../../src/models/workflow.model.js";
import JobRunModel from "../../src/models/jobRun.model.js";
import AlertModel from "../../src/models/alert.model.js";
import SettingModel from "../../src/models/setting.model.js";
import { tick, reconcile, checkMissed, setPaused } from "../../src/services/scheduler.service.js";
import { hasDb, useTestDb } from "./dbHelper.js";

process.env.WORKFLOW_BACKOFF_MS = "5";

async function waitFor(fn: () => Promise<boolean>, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timed out waiting");
}

describe.skipIf(!hasDb)("Day 14: scheduled agent (real database)", () => {
  useTestDb();
  beforeAll(async () => {
    await Promise.all([JobRunModel.init(), AlertModel.init(), SettingModel.init()]);
  });
  beforeEach(async () => {
    process.env.SCHEDULER_ENABLED = "true";
    process.env.SCHEDULE_EVERY_MINUTES = "1";
    process.env.ATTENTION_DAYS = "0";
    await Promise.all([WorkflowModel.deleteMany({}), JobRunModel.deleteMany({}), AlertModel.deleteMany({}), SettingModel.deleteMany({})]);
  });
  afterEach(() => {
    delete process.env.SCHEDULER_FORCE_FAIL;
  });

  it("two ticks in the same slot start only one run, and it finishes", async () => {
    const now = new Date();
    await Promise.all([tick(now), tick(now)]);
    expect(await JobRunModel.countDocuments()).toBe(1);
    await waitFor(async () => (await WorkflowModel.findOne().lean<any>())?.status === "done");
    await tick(now);
    expect((await JobRunModel.findOne().lean<any>()).status).toBe("done");
    expect(await AlertModel.countDocuments()).toBe(0);
  });

  it("DONE-WHEN: a forced failure raises one alert, and only one", async () => {
    process.env.SCHEDULER_FORCE_FAIL = "true";
    const now = new Date();
    await tick(now);
    await waitFor(async () => (await WorkflowModel.findOne().lean<any>())?.status === "failed");
    await tick(now);
    await tick(now);
    const alerts = await AlertModel.find({ kind: "job_failed" }).lean();
    expect(alerts).toHaveLength(1);
    expect((await JobRunModel.findOne().lean<any>()).status).toBe("failed");
  });

  it("DONE-WHEN: the kill switch stops new runs", async () => {
    await setPaused(true, "admin");
    await tick(new Date());
    expect(await JobRunModel.countDocuments()).toBe(0);
    await setPaused(false, "admin");
    await tick(new Date());
    expect(await JobRunModel.countDocuments()).toBe(1);
  });

  it("SCHEDULER_ENABLED=false stops everything", async () => {
    process.env.SCHEDULER_ENABLED = "false";
    await tick(new Date());
    expect(await JobRunModel.countDocuments()).toBe(0);
  });

  it("a run that never finishes is reported as stuck", async () => {
    const started = new Date(Date.now() - 60 * 60_000);
    const wf = await WorkflowModel.create({ userId: "service:scheduler", type: "dailyAttentionReport", steps: [], status: "running", expiresAt: new Date(Date.now() + 1e6) });
    await JobRunModel.create({ job: "attentionReport", slot: "old", startedAt: started, workflowId: String(wf._id), expiresAt: new Date(Date.now() + 1e6) });
    await reconcile(new Date());
    expect(await AlertModel.countDocuments({ kind: "job_failed" })).toBe(1);
  });

  it("a job that stopped running raises a missed-run alert", async () => {
    await checkMissed(new Date(Date.now() + 10 * 60_000)); // 10 minutes later, no successful run
    expect(await AlertModel.countDocuments({ kind: "missed_run" })).toBe(1);
  });
});