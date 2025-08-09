export interface Transaction {
  id: number;
  amount: number;
  type: 'expense' | 'income';
  category_id: number;
  category: Category;
  description?: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'expense' | 'income';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface TransactionAggregate {
  categories: Record<string, number>;
  total_income: number;
  total_expenses: number;
  net_amount: number;
}

export interface CreateTransactionRequest {
  amount: number;
  type: 'expense' | 'income';
  category_id: number;
  description?: string;
  date: string;
}

export interface CreateCategoryRequest {
  name: string;
  type: 'expense' | 'income';
}

export interface HealthData {
  status?: string;
  timestamp?: string;
  uptime?: number;
  version?: string;
  [key: string]: unknown;
}