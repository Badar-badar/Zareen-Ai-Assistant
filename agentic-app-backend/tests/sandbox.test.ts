import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { buildDockerArgs, runPython, IMAGE } from "../src/sandbox/runPython.js";
import { openSession } from "../src/mcp/session.js";

// Docker tests run only when Docker works and the image is already pulled (docker pull python:3.12-alpine)
const hasImage = (() => {
  try {
    return spawnSync("docker", ["image", "inspect", IMAGE], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
})();
const gone = (name: string) =>
  spawnSync("docker", ["ps", "-a", "--filter", `name=${name}`, "--format", "{{.Names}}"]).stdout.toString().trim() === "";

describe("Day 15: the locks are in the command (no Docker needed)", () => {
  const args = buildDockerArgs("sbx-test").join(" ");
  it("has every lock", () => {
    for (const flag of ["--network none", "--read-only", "--cap-drop ALL", "--pids-limit 64", "--memory 128m", "--user 65534:65534", "no-new-privileges"]) {
      expect(args).toContain(flag);
    }
  });
  it("mounts nothing and passes no secrets", () => {
    expect(args).not.toMatch(/(^| )-v |--volume|--mount/);
    expect(args).not.toMatch(/KEY|SECRET|TOKEN|PASSWORD/i);
    expect(args).not.toContain("--env-file");
  });
});

describe("Day 15: the tool is only for roles with code:run", () => {
  it("a viewer never sees runPython, staff do", async () => {
    process.env.SANDBOX_ENABLED = "true";
    const names = async (role: "viewer" | "staff" | "service") => {
      const s = await openSession({ userId: "u1", role });
      try {
        return (await s.client.listTools()).tools.map((t) => t.name);
      } finally {
        await s.close();
      }
    };
    expect(await names("viewer")).not.toContain("runPython");
    expect(await names("service")).not.toContain("runPython");
    expect(await names("staff")).toContain("runPython");
  });
});

describe.skipIf(!hasImage)("Day 15: escape attempts fail (real Docker)", () => {
  it("runs normal code", async () => {
    const r = await runPython("p=[];n=2\nwhile len(p)<100:\n  if all(n%q for q in p):p.append(n)\n  n+=1\nprint(sum(p))");
    expect(r.ok).toBe(true);
    expect(r.stdout.trim()).toBe("24133");
  });

  it("ESCAPE: no network", async () => {
    const r = await runPython(
      "import socket\ntry:\n  socket.create_connection(('1.1.1.1',53),timeout=3)\n  print('CONNECTED')\nexcept Exception as e:\n  print('BLOCKED')"
    );
    expect(r.stdout).toContain("BLOCKED");
    expect(r.stdout).not.toContain("CONNECTED");
  });

  it("ESCAPE: no secrets in the environment or files", async () => {
    const r = await runPython(
      "import os\nprint('ENV', sorted(os.environ))\nfor p in ['/app/.env','.env','/mnt','/home','/proc/1/environ']:\n  print(p, os.path.exists(p) and (os.path.isdir(p) and os.listdir(p) or 'file'))"
    );
    expect(r.stdout).not.toMatch(/KEY|SECRET|TOKEN|PASSWORD|GEMINI|GOOGLE/i);
    expect(r.stdout).not.toContain("mern_projects");
  });

  it("ESCAPE: cannot write outside /tmp", async () => {
    const r = await runPython("try:\n  open('/etc/pwned','w').write('x')\n  print('WROTE')\nexcept Exception:\n  print('DENIED')");
    expect(r.stdout).toContain("DENIED");
  });

  it("runs as a normal user, not root", async () => {
    const r = await runPython("import os\nprint(os.getuid())");
    expect(r.stdout.trim()).toBe("65534");
  });

  it("an infinite loop is killed on time and the container is removed", async () => {
    const r = await runPython("while True: pass", { timeoutMs: 3000 });
    expect(r.timedOut).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.durationMs).toBeLessThan(8000);
    await new Promise((x) => setTimeout(x, 1500));
    expect(gone("sbx-")).toBe(true);
  });

  it("a memory bomb is killed", async () => {
    const r = await runPython("x = bytearray(1024*1024*1024)\nprint('SURVIVED')");
    expect(r.stdout).not.toContain("SURVIVED");
    expect(r.exitCode).not.toBe(0);
  });

  it("an output flood is cut off", async () => {
    const r = await runPython("print('x'*5_000_000)");
    expect(r.stdout.length).toBeLessThanOrEqual(10_000);
    expect(r.truncated).toBe(true);
  });
});