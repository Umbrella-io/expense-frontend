import type { Transaction, Category, TransactionAggregate, CreateTransactionRequest, CreateCategoryRequest, HealthData } from './types';

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

// API functions for specific endpoints
export async function getTransactions() {
  return apiGet<Transaction[]>('/api/transactions');
}

export async function createTransaction(data: CreateTransactionRequest) {
  return apiPost<Transaction>('/api/transactions', data);
}

export async function getTransactionAggregate() {
  return apiGet<TransactionAggregate>('/api/transactions/aggregate');
}

export async function getCategories() {
  return apiGet<Category[]>('/api/categories');
}

export async function createCategory(data: CreateCategoryRequest) {
  return apiPost<Category>('/api/categories', data);
}

export async function getHealth() {
  return apiGet<HealthData>('/health');
}
