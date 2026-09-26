import { Customer, customers } from "../data/customer.data.ts";

export async function getAllCustomers(limit = 100): Promise<Customer[]> {
    try {
        const limitNum = typeof limit === "number" ? limit : parseInt(limit as any, 10);
        const sorted = [...customers].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return sorted.slice(0, isNaN(limitNum) ? 100 : limitNum);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
    try {
        const customer = customers.find((c) => c.id === id);
        return customer;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

