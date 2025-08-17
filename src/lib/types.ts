export interface Transaction {
  id: number;
  transaction_id: string;
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
  transaction_id?: string;
  amount: number;
  type: 'expense' | 'income';
  category_id: number;
  description: string;
  date?: string;
}

export interface UpdateTransactionRequest {
  transaction_id?: string;
  amount?: number;
  type?: 'expense' | 'income';
  category_id?: number;
  description?: string;
  date?: string;
}

export interface BulkTransactionRequest {
  transactions: CreateTransactionRequest[];
}

export interface BulkTransactionResponse {
  success: Transaction[];
  failed: BulkTransactionError[];
  total_count: number;
  success_count: number;
  failed_count: number;
}

export interface BulkTransactionError {
  index: number;
  transaction: CreateTransactionRequest;
  error: string;
}

export interface DateRangeParams {
  start_date: string;
  end_date: string;
  type?: 'expense' | 'income';
}

export interface CreateCategoryRequest {
  name: string;
  type: 'expense' | 'income';
}

export interface UpdateCategoryRequest {
  name?: string;
  type?: 'expense' | 'income';
}

export interface BulkDeleteRequest {
  transaction_ids: number[];
}

export interface BulkDeleteResponse {
  deleted: number[];
  failed: number[] | null;
  total_count: number;
  deleted_count: number;
  failed_count: number;
}

export interface AggregateTableCategoryData {
  category_id: number;
  category_name: string;
  total_amount: number;
  transaction_count: number;
}

export interface AggregateTableResponse {
  date_range: {
    start_date: string;
    end_date: string;
  };
  income: {
    categories: AggregateTableCategoryData[];
    total_amount: number;
    total_transactions: number;
  };
  expenses: {
    categories: AggregateTableCategoryData[];
    total_amount: number;
    total_transactions: number;
  };
  summary: {
    net_amount: number;
    total_income: number;
    total_expenses: number;
  };
}

export interface HealthData {
  status?: string;
  timestamp?: string;
  uptime?: number;
  version?: string;
  [key: string]: unknown;
}