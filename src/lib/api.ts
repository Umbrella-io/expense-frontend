import type { Transaction, Category, TransactionAggregate, CreateTransactionRequest, CreateCategoryRequest, UpdateTransactionRequest, UpdateCategoryRequest, BulkTransactionRequest, BulkTransactionResponse, BulkDeleteRequest, BulkDeleteResponse, AggregateTableResponse, DateRangeParams, HealthData, RefundCreateRequest, RefundUpdateRequest, RefundGroupResponse, BankAccount } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;


// Only check in browser environment
if (typeof window !== 'undefined' && !API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is not set');
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API POST Error - ${response.status}:`, errorText);
    throw new Error(`API request failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
  }

  return response.json();
}


export async function apiPut<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API PUT Error - ${response.status}:`, errorText);
    throw new Error(`API request failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
  }

  return response.json();
}

export async function apiPatch<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API PATCH Error - ${response.status}:`, errorText);
    throw new Error(`API request failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
  }

  return response.json();
}

export async function apiDelete<T>(endpoint: string, data?: unknown): Promise<T> {
  const requestOptions: RequestInit = {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    requestOptions.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// API functions for specific endpoints
export async function getTransactions(type?: 'expense' | 'income' | 'investment' | 'transfer' | 'refund') {
  const queryParam = type ? `?type=${type}` : '';
  return apiGet<Transaction[]>(`/api/transactions${queryParam}`);
}

export async function getTransaction(id: number) {
  return apiGet<Transaction>(`/api/transactions/${id}`);
}

export async function createTransaction(data: CreateTransactionRequest) {
  return apiPost<Transaction>('/api/transactions', data);
}

export async function updateTransaction(id: number, data: UpdateTransactionRequest) {
  return apiPut<Transaction>(`/api/transactions/${id}`, data);
}

export async function updateTransactionCategory(id: number, categoryId: number) {
  return apiPatch<Transaction>(`/api/transactions/${id}/category`, { category_id: categoryId });
}

export async function updateTransactionType(id: number, type: 'expense' | 'income' | 'investment' | 'transfer' | 'refund', categoryId: number) {
  return apiPut<Transaction>(`/api/transactions/${id}`, { type, category_id: categoryId });
}

export async function deleteTransaction(id: number) {
  return apiDelete<{ message: string }>(`/api/transactions/${id}`);
}

export async function deleteTransactionCascade(id: number) {
  return apiDelete<{ message: string }>(`/api/transactions/${id}?cascade=true`);
}

export async function createBulkTransactions(data: BulkTransactionRequest) {
  return apiPost<BulkTransactionResponse>('/api/transactions/bulk', data);
}

export async function deleteBulkTransactions(data: BulkDeleteRequest) {
  return apiDelete<BulkDeleteResponse>('/api/transactions/bulk', data);
}

export async function getTransactionsByDateRange(params: DateRangeParams) {
  const queryParams = new URLSearchParams({
    start_date: params.start_date,
    end_date: params.end_date,
    ...(params.type && { type: params.type })
  });
  return apiGet<Transaction[]>(`/api/transactions/date-range?${queryParams}`);
}

export async function getTransactionAggregate() {
  return apiGet<TransactionAggregate>('/api/transactions/aggregate');
}

export async function getTransactionAggregateTable(startDate: string, endDate: string) {
  const queryParams = new URLSearchParams({
    start_date: startDate,
    end_date: endDate
  });
  return apiGet<AggregateTableResponse>(`/api/transactions/aggregate-table?${queryParams}`);
}

// Refunds endpoints
export async function createRefund(data: RefundCreateRequest) {
  return apiPost<RefundGroupResponse>('/api/refunds', data);
}

export async function updateRefund(id: number, data: RefundUpdateRequest) {
  return apiPut<RefundGroupResponse>(`/api/refunds/${id}`, data);
}

export interface RefundListParams {
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
  bank_account_id?: number;
}

export async function getRefunds(params?: RefundListParams) {
  const queryParams = new URLSearchParams();
  if (params?.start_date) queryParams.set('start_date', params.start_date);
  if (params?.end_date) queryParams.set('end_date', params.end_date);
  if (params?.bank_account_id !== undefined) queryParams.set('bank_account_id', String(params.bank_account_id));
  const suffix = queryParams.toString() ? `?${queryParams}` : '';
  return apiGet<RefundGroupResponse[]>(`/api/refunds${suffix}`);
}

export async function getCategories() {
  return apiGet<Category[]>('/api/categories');
}

export async function getCategory(id: number) {
  return apiGet<Category>(`/api/categories/${id}`);
}

export async function createCategory(data: CreateCategoryRequest) {
  return apiPost<Category>('/api/categories', data);
}

export async function updateCategory(id: number, data: UpdateCategoryRequest) {
  return apiPut<Category>(`/api/categories/${id}`, data);
}

export async function deleteCategory(id: number) {
  return apiDelete<{ message: string }>(`/api/categories/${id}`);
}

export async function getHealth() {
  return apiGet<HealthData>('/health');
}

// Bank Accounts
export async function getBankAccounts(includeInactive = false) {
  const qp = includeInactive ? '?include_inactive=true' : '';
  return apiGet<BankAccount[]>(`/api/bank-accounts${qp}`);
}

export async function createBankAccount(data: Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>) {
  return apiPost<BankAccount>('/api/bank-accounts', data);
}

export async function updateBankAccount(id: number, data: Partial<Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>>) {
  return apiPut<BankAccount>(`/api/bank-accounts/${id}`, data);
}

export async function deleteBankAccount(id: number) {
  return apiDelete<{ message: string }>(`/api/bank-accounts/${id}`);
}
