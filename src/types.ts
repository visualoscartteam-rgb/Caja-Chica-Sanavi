export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
  created_at: string;
}

export interface TransactionFormData {
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
}

export interface InventoryMovement {
  id: number;
  type: 'in' | 'out';
  subtype?: 'venta' | 'regalia';
  units: number;
  description: string;
  invoice_number?: string;
  date: string;
  created_at: string;
}

export interface InventoryFormData {
  type: 'in' | 'out';
  subtype?: 'venta' | 'regalia';
  units: number;
  description: string;
  invoice_number: string;
  date: string;
}
