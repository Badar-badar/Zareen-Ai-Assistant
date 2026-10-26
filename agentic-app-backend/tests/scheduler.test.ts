import { describe, it, expect } from "vitest";
import { currentSlot } from "../src/services/scheduler.service.js";
import { can, toRole, type Permission } from "../src/mcp/permissions.js";
import { openSession } from "../src/mcp/session.js";

describe("Day 14: schedule slots", () => {
  it("daily: nothing before the time, one stable slot after it", () => {
    const opts = { dailyAt: "08:00" };
    expect(currentSlot(new Date("2026-10-27T07:59:00Z"), opts)).toBeNull();
    const a = currentSlot(new Date("2026-10-27T08:00:00Z"), opts);
    const b = currentSlot(new Date("2026-10-27T21:30:00Z"), opts);
    expect(a).toBe("2026-10-27T08:00");
    expect(b).toBe(a); // the same day is the same slot, so the job runs once
    expect(currentSlot(new Date("2026-10-28T08:00:00Z"), opts)).toBe("2026-10-28T08:00");
  });
  it("every N minutes: ticks inside one window share a slot", () => {
    const opts = { everyMinutes: 5, dailyAt: "08:00" };
    const a = currentSlot(new Date("2026-10-27T10:00:10Z"), opts);
    expect(currentSlot(new Date("2026-10-27T10:04:59Z"), opts)).toBe(a);
    expect(currentSlot(new Date("2026-10-27T10:05:00Z"), opts)).not.toBe(a);
  });
});

describe("Day 14: the service identity is read-only", () => {
  const writes: Permission[] = ["customers:propose", "orders:propose", "orders:write", "admin:manage"];
  it("the service role has no write or admin permission", () => {
    for (const p of writes) expect(can("service", p)).toBe(false);
    expect(can("service", "orders:read")).toBe(true);
  });
  it("only admin can use the kill switch", () => {
    expect(can("admin", "admin:manage")).toBe(true);
    expect(can("staff", "admin:manage")).toBe(false);
    expect(can("viewer", "admin:manage")).toBe(false);
  });
  it("a service session sees no propose tools", async () => {
    const s = await openSession({ userId: "service:scheduler", role: "service" });
    try {
      const names = (await s.client.listTools()).tools.map((t) => t.name);
      expect(names).toContain("getLatestOrders");
      expect(names.some((n) => n.startsWith("propose"))).toBe(false);
    } finally {
      await s.close();
    }
  });
  it("an unknown role still falls back to viewer", () => {
    expect(toRole("service")).toBe("service");
    expect(toRole("root")).toBe("viewer");
  });
});