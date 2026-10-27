import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import CustomerModel from "../models/customer.model.js";
import { proposeOrder, proposeCustomer, proposeOrderStatus } from "../services/pendingAction.service.js";
import { registerCustomerTools } from "./server/tools/customer.tool.js";
import { registerOrderTools } from "./server/tools/order.tool.js";
import { registerWeatherTools } from "./server/tools/weather.tool.js";
import { registerRagTools } from "./server/tools/rag.tool.js";
import { can, TOOL_PERMISSIONS, type UserContext } from "./permissions.js";
import { runPython } from "../sandbox/runPython.js";
const text = (t: string, extra: object = {}): CallToolResult => ({
  content: [{ type: "text", text: t }],
  ...extra,
});
const fail = (t: string): CallToolResult => ({
  content: [{ type: "text", text: t }],
  isError: true,
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Wraps the server so every registerTool call goes through the permission check.
function guard(server: McpServer, ctx: UserContext): McpServer {
  const wrapper = { registerTool(name: string, config: any, handler: any) {
      const needed = TOOL_PERMISSIONS[name];
      if (!needed || !can(ctx.role, needed)) return undefined; // hidden from the tool list

      return server.registerTool(
        name,
        config,
        (async (...args: any[]): Promise<CallToolResult> => {
          // Real defense: checked again when the tool is called
          if (!can(ctx.role, needed)) return fail("You don't have permission to do this. Do not retry.");
          try {
            return await handler(...args);
          } catch (err) {
            console.error(`tool ${name} failed`, err);
            return fail("The tool failed unexpectedly. Tell the user it did not work; do not retry.");
          }
        }) as any
      );
    },
  };
  return wrapper as unknown as McpServer;
}

export function buildServer(ctx: UserContext): McpServer {
  const server = new McpServer({ name: "Zareena's ERP", version: "1.0.0" });
  const g = guard(server, ctx);

  // Your existing tools, unchanged
  registerCustomerTools(g);
  registerOrderTools(g);
  registerWeatherTools(g);
  registerRagTools(g);

  // New tool 1: search customers (read)
  g.registerTool(
    "findCustomers",
    {
      title: "Find Customers",
      description:
        "Search customers by part of their name or email. Use this to get a customer's id before proposing an order. " +
        "Returns at most 10 matches. Not for listing all customers.",
      inputSchema: z.object({ query: z.string().trim().min(2).max(100) }),
    },
    async ({ query }: { query: string }) => {
      const rx = new RegExp(escapeRegex(query), "i");
      const rows = await CustomerModel.find({ $or: [{ name: rx }, { email: rx }] }).limit(10).lean();
      if (rows.length === 0) return text("No customers match. Try a shorter or different search term.");
      return text(JSON.stringify(rows.map((c: any) => ({ id: String(c._id), name: c.name, email: c.email }))));
    }
  );

  // Write tools: they only save a pending proposal, the user must press Confirm
  g.registerTool(
    "proposeCreateOrder",
    {
      title: "Propose Create Order",
      description: "Propose a new order. Does NOT create it: the user must press Confirm. Get customerId from findCustomers first.",
      inputSchema: z.object({ customerId: z.string(), totalAmount: z.number() }),
    },
    async (args: unknown) => {
      const r = await proposeOrder(ctx.userId, args);
      if (!r.ok) return fail(r.error);
      return text("Saved as PENDING. Nothing is created yet. Tell the user it awaits their confirmation.", {
        structuredContent: { pending: r.view },
      });
    }
  );

  g.registerTool(
    "proposeCreateCustomer",
    {
      title: "Propose Create Customer",
      description: "Propose a new customer. Does NOT create it: the user must press Confirm.",
      inputSchema: z.object({ name: z.string(), email: z.string(), phone: z.string().optional() }),
    },
    async (args: unknown) => {
      const r = await proposeCustomer(ctx.userId, args);
      if (!r.ok) return fail(r.error);
      return text("Saved as PENDING. Nothing is created yet. Tell the user it awaits their confirmation.", {
        structuredContent: { pending: r.view },
      });
    }
  );

  g.registerTool(
    "proposeUpdateOrderStatus",
    {
      title: "Propose Update Order Status",
      description: "Propose changing an order's status. Does NOT update it until the user confirms. Get orderId from getOrderById first.",
      inputSchema: z.object({
        orderId: z.string(),
        status: z.enum(["pending", "completed", "cancelled"]),
      }),
    },
    async (args: unknown) => {
      const r = await proposeOrderStatus(ctx.userId, args);
      if (!r.ok) return fail(r.error);
      return text("Saved as PENDING. Nothing is changed yet. Tell the user it awaits their confirmation.", {
        structuredContent: { pending: r.view },
      });
    }
  );


    // Only registered when the sandbox is switched on, and only visible to roles with code:run
  if (process.env.SANDBOX_ENABLED === "true") {
    g.registerTool(
      "runPython",
      {
        title: "Run Python",
        description:
          "Run a short Python 3 program in an isolated sandbox and return its printed output. " +
          "Use it for exact calculations, counting, sorting or data processing. " +
          "The sandbox has NO internet, NO files and NO access to store data, so put any numbers you need directly in the code. " +
          "Use print() to show results. Standard library only. Runs at most 10 seconds.",
        inputSchema: z.object({ code: z.string().min(1).max(4000) }),
      },
      async ({ code }: { code: string }) => {
        const r = await runPython(code);
        console.log(JSON.stringify({ type: "sandbox", userId: ctx.userId, codeChars: code.length, ok: r.ok, exitCode: r.exitCode, timedOut: r.timedOut, ms: r.durationMs }));
        if (r.error) return fail(`The sandbox could not run: ${r.error}`);
        if (r.timedOut) return fail("The program ran too long and was stopped. Make it faster or simpler.");
        const body = `exit code: ${r.exitCode}\nstdout:\n${r.stdout || "(empty)"}\nstderr:\n${r.stderr || "(empty)"}${r.truncated ? "\n[output truncated]" : ""}`;
        return text(body);
      }
    );
  }
  return server;
}