export type SaleStatus = "completed" | "pending" | "cancelled";
export type SalePaymentMethod = "pix" | "dinheiro" | "cartao" | "fiado" | "parcelado";
export type InstallmentStatus = "pendente" | "pago" | "vencido" | "parcial";
export type MovementType = "entrada" | "saida" | "ajuste" | "venda" | "devolucao";
export type CollaboratorRole = "vendedor" | "cobrador";
export type CollaboratorViewPermission = "inicio" | "vender" | "clientes" | "fichas" | "cobrancas";

export interface Profile {
  id: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Collaborator {
  id: string;
  owner_id: string;
  auth_user_id: string | null;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: CollaboratorRole;
  is_active: boolean;
  accepted_at: string | null;
  view_permissions: CollaboratorViewPermission[];
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  ficha_number: number;
  assigned_collaborator_id: string | null;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  cpf: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  credit_limit: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  sku: string | null;
  cost_price: number;
  sale_price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  user_id: string;
  product_id: string;
  variant_name: string;
  attributes: Record<string, string>;
  sku: string | null;
  stock_quantity: number;
  min_stock: number;
  cost_price: number | null;
  sale_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  user_id: string;
  customer_id: string | null;
  created_by_collaborator_id: string | null;
  sale_number: number;
  status: SaleStatus;
  payment_method: SalePaymentMethod;
  subtotal: number;
  total: number;
  down_payment: number;
  is_paid: boolean;
  is_opening_balance: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  user_id: string;
  sale_id: string;
  product_variant_id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  quantity: number;
  unit_cost_snapshot: number;
  unit_price_snapshot: number;
  subtotal: number;
  created_at: string;
}

export interface Installment {
  id: string;
  user_id: string;
  sale_id: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: InstallmentStatus;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  description: string;
  category: string;
  amount: number;
  expense_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type Database = any;
