export interface OrderItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
}

export interface Order {
    id: string;
    customerId: string;
    items: OrderItem[];
    totalAmount: number;
    status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
    paymentStatus: "paid" | "unpaid" | "refunded";
    createdAt: string;
}

export const orders: Order[] = [
    {
        id: "ord-1001",
        customerId: "cust-001",
        items: [
            {
                id: "item-01",
                name: "Wireless Noise-Canceling Headphones",
                quantity: 1,
                price: 199.99
            },
            {
                id: "item-02",
                name: "USB-C Fast Charger",
                quantity: 2,
                price: 24.99
            }
        ],
        totalAmount: 249.97,
        status: "delivered",
        paymentStatus: "paid",
        createdAt: "2026-02-10T10:15:00Z"
    },
    {
        id: "ord-1002",
        customerId: "cust-001",
        items: [
            {
                id: "item-03",
                name: "Ergonomic Mechanical Keyboard",
                quantity: 1,
                price: 129.50
            }
        ],
        totalAmount: 129.50,
        status: "shipped",
        paymentStatus: "paid",
        createdAt: "2026-02-20T14:40:00Z"
    },
    {
        id: "ord-1003",
        customerId: "cust-002",
        items: [
            {
                id: "item-04",
                name: "27-inch 4K Monitor",
                quantity: 2,
                price: 349.99
            },
            {
                id: "item-05",
                name: "Monitor Desk Mount Arm",
                quantity: 1,
                price: 59.99
            }
        ],
        totalAmount: 759.97,
        status: "processing",
        paymentStatus: "paid",
        createdAt: "2026-02-22T09:00:00Z"
    },
    {
        id: "ord-1004",
        customerId: "cust-003",
        items: [
            {
                id: "item-06",
                name: "Smart Watch Series 5",
                quantity: 1,
                price: 299.00
            }
        ],
        totalAmount: 299.00,
        status: "pending",
        paymentStatus: "unpaid",
        createdAt: "2026-02-25T17:30:00Z"
    }
];
