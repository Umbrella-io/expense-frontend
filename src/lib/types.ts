export interface Transaction {
  id: number;
  transaction_id: string;
  amount: number;
  type: 'expense' | 'income' | 'investment' | 'transfer' | 'refund';
  bank_account_id: number;
  category_id?: number;
  category?: Category;
  parent_transaction_id?: number | null;
  description?: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'expense' | 'income' | 'investment';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface TransactionAggregate {
  categories: Record<string, number>;
  total_income: number;
  total_expenses: number;
  total_investments: number;
  net_amount: number;
}

export interface CreateTransactionRequest {
  transaction_id?: string;
  amount: number;
  type: 'expense' | 'income' | 'investment' | 'transfer' | 'refund';
  category_id?: number;
  bank_account_id: number;
  description: string;
  date?: string;
  parent_transaction_id?: number;
}

export interface UpdateTransactionRequest {
  transaction_id?: string;
  amount?: number;
  type?: 'expense' | 'income' | 'investment' | 'transfer' | 'refund';
  category_id?: number;
  bank_account_id?: number;
  description?: string;
  date?: string;
  parent_transaction_id?: number | null;
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
  type?: 'expense' | 'income' | 'investment' | 'transfer' | 'refund';
}

export interface CreateCategoryRequest {
  name: string;
  type: 'expense' | 'income' | 'investment';
}

export interface UpdateCategoryRequest {
  name?: string;
  type?: 'expense' | 'income' | 'investment';
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
    total_investments: number;
  };
  investments: {
    categories: AggregateTableCategoryData[];
    total_amount: number;
    total_transactions: number;
  };
}

export interface HealthData {
  status?: string;
  timestamp?: string;
  uptime?: number;
  version?: string;
  [key: string]: unknown;
}

// Refund-specific types
/**
 * Identifier for an expense category.
 * Note: This is currently an alias for `number`. The business rule requires that
 * only EXPENSE category IDs are used. This is NOT enforced by the type system.
 * If you want stricter checks, consider introducing runtime validators or a branded type
 * and factory functions to construct `ExpenseCategoryId` values only from expense categories.
 */
export type ExpenseCategoryId = number;

/**
 * Input for a refund child transaction.
 * @property category_id - Must be the ID of an expense category. This constraint is not enforced at
 * the type level; ensure only expense category IDs are used.
 */
export interface RefundChildInput {
  transaction_id?: string;
  amount: number;
  /** Must be the ID of an expense category. */
  category_id: ExpenseCategoryId;
  description?: string;
  date?: string; // ISO string
}

export interface RefundCreateRequest {
  transaction_id?: string;
  amount: number; // parent total amount
  bank_account_id: number;
  description?: string;
  date?: string; // ISO string
  children: RefundChildInput[]; // sum(children.amount) must equal amount; see validateRefundCreateRequestAmounts()
}

export interface RefundUpdateRequest extends Partial<Omit<RefundCreateRequest, 'children'>> {
  children: RefundChildInput[]; // replace entire children set atomically
}

export interface RefundGroupResponse {
  parent: Transaction; // type=refund, parent_transaction_id=null, no category
  children: Transaction[]; // type=refund, parent_transaction_id=parent.id
  total_amount: number;
  children_sum: number;
}