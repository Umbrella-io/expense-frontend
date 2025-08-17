import type { Transaction, Category, TransactionAggregate, CreateTransactionRequest, CreateCategoryRequest, UpdateTransactionRequest, UpdateCategoryRequest, BulkTransactionRequest, BulkTransactionResponse, BulkDeleteRequest, BulkDeleteResponse, DateRangeParams, HealthData } from './types';

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
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
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
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
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
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
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
export async function getTransactions(type?: 'expense' | 'income') {
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

export async function deleteTransaction(id: number) {
  return apiDelete<{ message: string }>(`/api/transactions/${id}`);
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
