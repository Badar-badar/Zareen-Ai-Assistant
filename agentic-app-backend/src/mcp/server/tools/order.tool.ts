import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLatestOrders, getOrderById, getOrdersWithCustomerDetails, createOrder } from "../../../services/order.service.js";
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
                limit: z.union([z.number(), z.string()]).optional().describe("Number of orders to retrieve")
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
                limit: z.union([z.number(), z.string()]).optional().describe("Number of orders to retrieve")
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
                id: z.string().describe("Order ID or Order Number")
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

    mcpServer.registerTool(
        "createOrder",
        {
            title: "Create Order",
            description: "Create a new order in the database",
            inputSchema: z.object({
                customerId: z.string().describe("Customer ID who placed the order"),
                totalAmount: z.number().describe("Total amount of the order"),
                orderNumber: z.string().optional().describe("Optional order number/code"),
                orderDate: z.string().optional().describe("Optional order date (ISO string)"),
                status: z.enum(["pending", "completed", "cancelled"]).optional().describe("Order status ('pending', 'completed', or 'cancelled')")
            }),
            outputSchema: z.object({
                order: orderSchema.optional()
            })
        },
        async (args) => {
            const order = await createOrder(args);
            return {
                content: [{ type: "text", text: JSON.stringify(order, null, 2) }],
                structuredContent: { order },
            };
        }
    );
}