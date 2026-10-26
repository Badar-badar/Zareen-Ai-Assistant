import { describe, it, expect, beforeEach } from "vitest";
import WorkflowModel from "../../src/models/workflow.model.js";
import { WORKFLOWS, createWorkflow, runWorkflow, PermanentError, type StepCtx } from "../../src/services/workflow.service.js";
import { hasDb, useTestDb } from "./dbHelper.js";

process.env.WORKFLOW_BACKOFF_MS = "5"; // fast retries in tests

let ran: string[] = [];
const step = (name: string, fn?: (ctx: StepCtx) => unknown) => ({
  name,
  run: async (ctx: StepCtx) => {
    ran.push(name);
    return fn ? fn(ctx) : `${name}-out`;
  },
});
const get = (id: string) => WorkflowModel.findById(id).lean<any>();

describe.skipIf(!hasDb)("Day 12: workflows, retries and resume (real database)", () => {
  useTestDb();
  beforeEach(async () => {
    ran = [];
    await WorkflowModel.deleteMany({});
  });

  it("runs every step in order and passes outputs forward", async () => {
    WORKFLOWS.t = { steps: [step("a"), step("b"), step("c", (ctx) => `got ${ctx.outputs.b}`)] };
    const id = await createWorkflow("u1", "t", {});
    expect(await runWorkflow(id)).toBe(true);
    const wf = await get(id);
    expect(wf.status).toBe("done");
    expect(ran).toEqual(["a", "b", "c"]);
    expect(wf.result).toBe("got b-out");
  });

  it("DONE-WHEN: resume skips finished steps and re-runs the interrupted one", async () => {
    WORKFLOWS.t = { steps: [step("a"), step("b", (ctx) => `b saw ${ctx.outputs.a}`), step("c")] };
    const id = await createWorkflow("u1", "t", {});
    // the server died during step b: a is done, b was running, the lease has expired
    await WorkflowModel.updateOne(
      { _id: id },
      { $set: { "steps.0.status": "done", "steps.0.output": "a-out", "steps.1.status": "running", status: "running", runner: "dead", leaseUntil: new Date(Date.now() - 1000) } }
    );
    expect(await runWorkflow(id)).toBe(true);
    expect(ran).toEqual(["b", "c"]); // a was NOT repeated
    expect((await get(id)).steps[1].output).toBe("b saw a-out"); // a's saved output was reused
  });

  it("does not take a workflow whose lease is still live", async () => {
    WORKFLOWS.t = { steps: [step("a")] };
    const id = await createWorkflow("u1", "t", {});
    await WorkflowModel.updateOne({ _id: id }, { $set: { status: "running", runner: "other", leaseUntil: new Date(Date.now() + 60_000) } });
    expect(await runWorkflow(id)).toBe(false);
    expect(ran).toEqual([]);
  });

  it("two runners at the same moment run each step only once", async () => {
    WORKFLOWS.t = { steps: [step("a"), step("b")] };
    const id = await createWorkflow("u1", "t", {});
    await Promise.all([runWorkflow(id), runWorkflow(id)]);
    expect(ran).toEqual(["a", "b"]);
  });

  it("retries a failing step with backoff, then succeeds", async () => {
    let n = 0;
    WORKFLOWS.t = {
      steps: [step("flaky", () => { if (++n < 3) throw new Error("temporary"); return "ok"; })],
    };
    const id = await createWorkflow("u1", "t", {});
    expect(await runWorkflow(id)).toBe(true);
    const wf = await get(id);
    expect(wf.steps[0].attempts).toBe(3);
    expect(wf.status).toBe("done");
  });

  it("gives up after the maximum attempts and does not run later steps", async () => {
    WORKFLOWS.t = { steps: [step("bad", () => { throw new Error("always"); }), step("never")] };
    const id = await createWorkflow("u1", "t", {});
    expect(await runWorkflow(id)).toBe(false);
    const wf = await get(id);
    expect(wf.status).toBe("failed");
    expect(wf.steps[0].attempts).toBe(3);
    expect(ran).not.toContain("never");
  });

  it("does not retry a permanent error", async () => {
    WORKFLOWS.t = { steps: [step("bad", () => { throw new PermanentError("no point retrying"); })] };
    const id = await createWorkflow("u1", "t", {});
    await runWorkflow(id);
    expect((await get(id)).steps[0].attempts).toBe(1);
  });
});