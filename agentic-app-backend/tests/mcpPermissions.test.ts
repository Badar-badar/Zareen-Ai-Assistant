import { describe, it, expect } from "vitest";
import { openSession } from "../src/mcp/session.js";
import { toRole, type Role } from "../src/mcp/permissions.js";

async function toolNames(role: Role) {
  const s = await openSession({ userId: "u1", role });
  try {
    return (await s.client.listTools()).tools.map((t) => t.name);
  } finally {
    await s.close();
  }
}

describe("Day 6: permissions are enforced inside the server", () => {
  it("a viewer sees read tools and no propose tools", async () => {
    const names = await toolNames("viewer");
    expect(names).toContain("getLatestOrders");
    expect(names).toContain("findCustomers");
    expect(names).not.toContain("proposeCreateOrder");
    expect(names).not.toContain("proposeCreateCustomer");
    expect(names).not.toContain("proposeUpdateOrderStatus");
  });

  it("staff and admin see the propose tools", async () => {
    for (const role of ["staff", "admin"] as Role[]) {
      const names = await toolNames(role);
      expect(names).toContain("proposeCreateOrder");
      expect(names).toContain("proposeCreateCustomer");
      expect(names).toContain("proposeUpdateOrderStatus");
    }
  });

  it("a viewer who calls a propose tool anyway cannot trigger it", async () => {
    const s = await openSession({ userId: "u1", role: "viewer" });
    try {
      let refused = false;
      try {
        const r: any = await s.client.callTool({
          name: "proposeCreateOrder",
          arguments: { customerId: "a".repeat(24), totalAmount: 5 },
        });
        refused = r.isError === true;
      } catch {
        refused = true; // older SDKs throw for an unknown tool
      }
      expect(refused).toBe(true);
    } finally {
      await s.close();
    }
  });

  it("unknown or legacy roles become viewer", () => {
    expect(toRole("user")).toBe("viewer");
    expect(toRole(undefined)).toBe("viewer");
    expect(toRole("admin")).toBe("admin");
  });
});