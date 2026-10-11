import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLatestOrders, getOrderById, getOrdersWithCustomerDetails } from "../../../services/order.service.js";
import { z } from "zod";

const orderSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    orderNumber: z.string(),
    orderDate: z.string(),
    totalAmount: z.number(),
    status: z.string(),
    createdAt: z.string()
});

export function registerOrderTools(mcpServer: McpServer) {
    mcpServer.registerTool(
        "getLatestOrders",
        {
            title: "Get Latest Orders",
            description: "Get the latest orders list from the database. Can optionally specify a limit.",
            inputSchema: z.object({
                limit: z.number().int().min(1).max(100).optional().describe("Number of orders to retrieve")
            }),
            outputSchema: z.object({
                orders: z.array(orderSchema)
            })
        },
        async ({ limit }) => {
            const orders = await getLatestOrders(limit);
            return {
                content: [{ type: "text", text: JSON.stringify(orders, null, 2) }],
                structuredContent: { orders },
            };
        }
    );

    mcpServer.registerTool(
        "getOrderWithCustomerDetails",
        {
            title: "Get Orders With Customer Details",
            description: "Get list of orders along with customer name, email, and phone contact info from the database.",
            inputSchema: z.object({
                limit: z.number().int().min(1).max(100).optional().describe("Number of orders to retrieve")
            }),
            outputSchema: z.object({
                ordersDetails: z.array(
                    orderSchema.extend({
                        customer: z.object({
                            id: z.string(),
                            name: z.string(),
                            email: z.string(),
                            phone: z.string().optional()
                        }).nullable()
                    })
                )
            })
        },
        async ({ limit }) => {
            const ordersDetails = await getOrdersWithCustomerDetails(limit);
            return {
                content: [{ type: "text", text: JSON.stringify(ordersDetails, null, 2) }],
                structuredContent: { ordersDetails }
            };
        }
    );

    mcpServer.registerTool(
        "getOrderById",
        {
            title: "Get Order By ID",
            description: "Get order details by order ID (MongoDB _id or order number like ORD-1001)",
            inputSchema: z.object({
                id: z.string().trim().min(1).max(254).describe("Order ID or Order Number")
            }),
            outputSchema: z.object({
                order: orderSchema.optional()
            })
        },
        async ({ id }) => {
            const order = await getOrderById(id);
            return {
                content: [{ type: "text", text: JSON.stringify(order, null, 2) }],
                structuredContent: { order },
            };
        }
    );
}