import { Order, orders } from "../data/order.data.ts";
import { customers } from "../data/customer.data.ts";

export async function getLatestOrders(limit: number | string = 4): Promise<Order[]> {
    try {
        const limitNum = typeof limit === "number" ? limit : parseInt(limit as any, 10);
        const sorted = [...orders].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return sorted.slice(0, isNaN(limitNum) ? 4 : limitNum);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function getOrdersWithCustomerDetails(limit: number | string = 4) {
    try {
        const latestOrders = await getLatestOrders(limit);
        return latestOrders.map((order) => {
            const customer = customers.find((c) => c.id === order.customerId);
            return {
                ...order,
                customer: customer
                    ? { name: customer.name, email: customer.email, phone: customer.phone }
                    : null
            };
        });
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function getOrderById(id: string): Promise<Order | undefined> {
    try {
        const order = orders.find((o) => o.id === id);
        return order;
    } catch (error) {
        console.log(error);
        throw error;
    }
}