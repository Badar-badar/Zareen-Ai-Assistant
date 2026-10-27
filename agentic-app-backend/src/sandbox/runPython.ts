import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

export const IMAGE = process.env.SANDBOX_IMAGE || "python:3.12-alpine";
const MAX_CODE = 4_000;
const MAX_OUT = 10_000;
const MAX_CONCURRENT = 2;
let running = 0;

export interface SandboxResult {
  ok: boolean; // false = the sandbox itself failed or timed out (not the same as the code raising an error)
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
  error?: string;
}

// Every lock is here, in one place. No volumes, no env vars, no network.
export function buildDockerArgs(name: string): string[] {
  return [
    "run", "--rm", "-i", "--name", name,
    "--network", "none", // no internet, no other containers
    "--read-only", // the container's filesystem cannot be changed
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m", // the only writable place, in memory
    "--memory", "128m", "--memory-swap", "128m", // memory cap, no swap
    "--cpus", "0.5",
    "--pids-limit", "64", // stops fork bombs
    "--cap-drop", "ALL", // no Linux special powers
    "--security-opt", "no-new-privileges",
    "--user", "65534:65534", // not root
    "-e", "HOME=/tmp",
    "-w", "/tmp",
    IMAGE,
    "python", "-I", "-B", "-", // isolated mode, no bytecode files, program read from stdin
  ];
}

export async function runPython(code: string, opts: { timeoutMs?: number } = {}): Promise<SandboxResult> {
  const started = Date.now();
  const fail = (error: string): SandboxResult => ({
    ok: false, stdout: "", stderr: "", exitCode: null, timedOut: false, truncated: false, durationMs: Date.now() - started, error,
  });

  if (!code.trim()) return fail("no code given");
  if (code.length > MAX_CODE) return fail(`code is longer than ${MAX_CODE} characters`);
  if (running >= MAX_CONCURRENT) return fail("the sandbox is busy, try again shortly");

  running++;
  const timeoutMs = opts.timeoutMs ?? Number(process.env.SANDBOX_TIMEOUT_MS || 10_000);
  const name = `sbx-${randomUUID().slice(0, 12)}`;

  try {
    return await new Promise<SandboxResult>((resolve) => {
      let stdout = "";
      let stderr = "";
      let truncated = false;
      let timedOut = false;
      let done = false;

      const child = spawn("docker", buildDockerArgs(name), { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });

      const kill = () => {
        spawn("docker", ["kill", name], { stdio: "ignore", windowsHide: true }).on("error", () => {});
        child.kill();
      };
      const finish = (r: Partial<SandboxResult>) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({
          ok: !timedOut && !r.error, stdout, stderr, exitCode: null, timedOut, truncated,
          durationMs: Date.now() - started, ...r,
        });
      };

      const timer = setTimeout(() => {
        timedOut = true;
        kill();
      }, timeoutMs);

      const collect = (which: "out" | "err") => (d: Buffer) => {
        const room = MAX_OUT - (stdout.length + stderr.length);
        if (room <= 0) {
          if (!truncated) {
            truncated = true;
            kill(); // someone is flooding the output
          }
          return;
        }
        const text = d.toString("utf8").slice(0, room);
        if (which === "out") stdout += text;
        else stderr += text;
        if (d.length > room) truncated = true;
      };
      child.stdout.on("data", collect("out"));
      child.stderr.on("data", collect("err"));
      child.on("error", (e) => finish({ error: `docker is not available: ${e.message}` }));
      child.on("close", (exitCode) => finish({ exitCode }));

      child.stdin.on("error", () => {});
      child.stdin.end(code);
    });
  } finally {
    running--;
  }
}