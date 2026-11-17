export type Module =
  | 'Overview'
  | 'AI Assistant'
  | 'Analytics'
  | 'Customers'
  | 'Sales'
  | 'Inventory'
  | 'Finance'
  | 'Alerts'
  | 'Automations'
  | 'Reports'
  | 'Settings';
export type Severity = 'Critical' | 'Warning' | 'Opportunity';
export interface Customer {
  version?: number;
  number?: string;
  id: string;
  name: string;
  contact: string;
  email: string;
  location: string;
  revenue: number;
  orders: number;
  lastOrder: string;
  status: 'Active' | 'Inactive';
}
export interface Product {
  version?: number;
  number?: string;
  id: string;
  name: string;
  category: string;
  sku: string;
  stock: number;
  reorder: number;
  price: number;
  sold: number;
  revenue: number;
  supplier: string;
  archived?: boolean;
}
export interface Order {
  version?: number;
  number?: string;
  id: string;
  customer: string;
  date: string;
  items: number;
  amount: number;
  status: 'Delivered' | 'Processing' | 'Shipped' | 'Cancelled';
  customerId?: string;
  lines?: { productId: string; description: string; quantity: number; unitPrice: number }[];
}
export interface Invoice {
  version?: number;
  number?: string;
  id: string;
  customer: string;
  issued: string;
  due: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Void';
  orderId?: string;
  outstanding?: number;
  paid?: number;
  payments?: { id: string; amount: number; reference: string; reversedAt: string | null }[];
}
export interface BusinessAlert {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: 'Inventory' | 'Finance' | 'Sales';
  time: string;
  action: string;
}
export interface Automation {
  id: string;
  title: string;
  description: string;
  category: string;
  lastRun: string;
  runs: number;
  enabled: boolean;
}
