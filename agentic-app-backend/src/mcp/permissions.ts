export type Role = "viewer" | "staff" | "admin";

export type Permission =
  | "customers:read"
  | "orders:read"
  | "weather:read"
  | "knowledge:read"
  | "customers:propose"
  | "orders:propose"
  | "orders:write";


const READ: Permission[] = ["customers:read", "orders:read", "weather:read", "knowledge:read"];
const WRITE: Permission[] = ["customers:propose", "orders:propose", "orders:write"];
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: READ,
  staff: [...READ, ...WRITE],
  admin: [...READ, ...WRITE],
};

export const can = (role: Role, p: Permission) => ROLE_PERMISSIONS[role]?.includes(p) ?? false;

// Every tool must be listed here. A tool that is not listed is never registered.
export const TOOL_PERMISSIONS: Record<string, Permission> = {
  getCustomers: "customers:read",
  getCustomerById: "customers:read",
  findCustomers: "customers:read",
  getLatestOrders: "orders:read",
  getOrderWithCustomerDetails: "orders:read",
  getOrderById: "orders:read",
  fetchWeather: "weather:read",
  ragSearch: "knowledge:read",
  proposeCreateOrder: "orders:propose",
  proposeCreateCustomer: "customers:propose",
  proposeUpdateOrderStatus: "orders:propose",

};

export interface UserContext {
  userId: string;
  role: Role;
}

// Unknown or legacy roles (like the old "user") become viewer: least privilege.
export const toRole = (r: unknown): Role =>
  r === "admin" || r === "staff" || r === "viewer" ? r : "viewer";