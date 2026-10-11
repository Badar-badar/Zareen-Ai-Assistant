import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAllCustomers, getCustomerById } from "../../../services/customer.service.js";

const customerSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    address: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string(),
        country: z.string()
    }),
    createdAt: z.string(),
    status: z.string()
});

export function registerCustomerTools(mcpServer: McpServer) {
    mcpServer.registerTool(
        "getCustomers",
        {
            title: "Get Customers",
            description: "Get the list of customers from the database. Can optionally specify a limit.",
            inputSchema: z.object({
                limit: z.number().int().min(1).max(100).optional().describe("Number of customers to get")
            }),
            outputSchema: z.object({
                customers: z.array(customerSchema)
            })
        },
        async ({ limit }) => {
            const customers = await getAllCustomers(limit);
            return {
                content: [{ type: "text", text: JSON.stringify(customers, null, 2) }],
                structuredContent: { customers },
            };
        }
    );

    mcpServer.registerTool(
        "getCustomerById",
        {
            title: "Get Customer By ID",
            description: "Get customer details from the database based on customer ID or email",
            inputSchema: z.object({
                id: z.string().trim().min(1).max(254).describe("Customer ID or Email")
            }),
            outputSchema: z.object({
                customer: customerSchema.optional()
            })
        },
        async ({ id }) => {
            const customer = await getCustomerById(id);
            return {
                content: [{ type: "text", text: JSON.stringify(customer, null, 2) }],
                structuredContent: { customer },
            };
        }
    );
}