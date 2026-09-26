export interface Customer {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    createdAt: string;
    status: "active" | "inactive";
}

export const customers: Customer[] = [
    {
        id: "cust-001",
        name: "Zareena Ahmed",
        email: "zareena.ahmed@example.com",
        phone: "+1-555-0147",
        address: {
            street: "123 Innovation Way",
            city: "San Francisco",
            state: "CA",
            zipCode: "94105",
            country: "USA"
        },
        createdAt: "2025-11-15T08:30:00Z",
        status: "active"
    },
    {
        id: "cust-002",
        name: "Alex Mercer",
        email: "alex.mercer@example.com",
        phone: "+1-555-0189",
        address: {
            street: "456 Market Street",
            city: "New York",
            state: "NY",
            zipCode: "10001",
            country: "USA"
        },
        createdAt: "2026-01-10T14:20:00Z",
        status: "active"
    },
    {
        id: "cust-003",
        name: "Sophia Chen",
        email: "sophia.chen@example.com",
        phone: "+1-555-0234",
        address: {
            street: "789 Tech Boulevard",
            city: "Austin",
            state: "TX",
            zipCode: "78701",
            country: "USA"
        },
        createdAt: "2026-02-01T11:45:00Z",
        status: "active"
    },
    {
        id: "cust-004",
        name: "Michael Brown",
        email: "michael.brown@example.com",
        phone: "+1-555-0312",
        address: {
            street: "321 Pine Avenue",
            city: "Seattle",
            state: "WA",
            zipCode: "98101",
            country: "USA"
        },
        createdAt: "2026-02-18T16:10:00Z",
        status: "inactive"
    }
];
