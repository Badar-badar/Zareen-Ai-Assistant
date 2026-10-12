import { proposeOrder, proposeCustomer, type PendingView } from "../services/pendingAction.service.js";

// The agent can ONLY propose. These tools never touch the customers or orders collections.
export const PROPOSE_TOOL_NAMES = new Set(["proposeCreateOrder", "proposeCreateCustomer"]);

export const PROPOSE_DECLARATIONS = [
  {
    name: "proposeCreateOrder",
    description:
      "Propose creating a new order. This does NOT create it: it shows the user a Confirm/Cancel card, and nothing is created until the user confirms. " +
      "You need the customer's id, so look the customer up first with getCustomerById or getCustomers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "The customer's 24-character id from a customer lookup" },
        totalAmount: { type: "number", description: "Order total, between 0.01 and 1000000" },
      },
      required: ["customerId", "totalAmount"],
    },
  },
  {
    name: "proposeCreateCustomer",
    description:
      "Propose creating a new customer. This does NOT create it: it shows the user a Confirm/Cancel card, and nothing is created until the user confirms.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Customer name" },
        email: { type: "string", description: "Customer email address" },
        phone: { type: "string", description: "Optional phone number" },
      },
      required: ["name", "email"],
    },
  },
];

export async function runProposeTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<{ output: string; isError: boolean; pending?: PendingView }> {
  const result = name === "proposeCreateOrder" ? await proposeOrder(userId, args) : await proposeCustomer(userId, args);

  if (!result.ok) return { output: result.error, isError: true };
  return {
    output:
      "Saved as a PENDING proposal and shown to the user with Confirm/Cancel buttons. NOTHING has been created yet. " +
      "Tell the user it is waiting for their confirmation. Do not say it was created or placed.",
    isError: false,
    pending: result.view,
  };
}