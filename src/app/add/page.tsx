'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { createTransaction, getCategories, getBankAccounts } from '@/lib/api';
import type { CreateTransactionRequest, Category, BankAccount } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AddTransaction() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTransactionRequest>();

  const watchType = watch('type');

  useEffect(() => {
    const fetchData = async () => {
      setCategoriesLoading(true);
      setBankAccountsLoading(true);
      try {
        const [fetchedCategories, fetchedAccounts] = await Promise.all([
          getCategories(),
          getBankAccounts(false),
        ]);
        setCategories(fetchedCategories);
        setBankAccounts(Array.isArray(fetchedAccounts) ? fetchedAccounts.filter(a => a.is_active !== false) : []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load form data');
      } finally {
        setCategoriesLoading(false);
        setBankAccountsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    // Set default date to today
    setValue('date', new Date().toISOString().split('T')[0]);
  }, [setValue]);

  const onSubmit = async (data: CreateTransactionRequest) => {
    setLoading(true);
    try {
      // Check if trying to create investment transaction
      if (data.type === 'investment') {
        toast.error('Investment transactions are not yet supported by the backend. Please update the backend API to support investment type.');
        return;
      }

      // Build payload with exact backend format
      const payload = {
        transaction_id: data.transaction_id || undefined,
        amount: Number(data.amount),
        type: data.type,
        category_id: Number(data.category_id),
        bank_account_id: Number(data.bank_account_id),
        description: data.description,
        date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
      };
      await createTransaction(payload);
      toast.success('Transaction added successfully!');
      router.push('/');
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error('Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(cat => cat.type === watchType);

  if (categoriesLoading || bankAccountsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Add Transaction</h1>
        <p className="text-gray-600">Record your income, expense, or investment</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Transaction ID */}
          <div>
            <label htmlFor="transaction_id" className="block text-sm font-medium text-gray-700 mb-2">
              Transaction ID
            </label>
            <input
              type="text"
              id="transaction_id"
              {...register('transaction_id')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-gray-900"
              placeholder="Optional custom transaction ID"
            />
            <p className="mt-1 text-sm text-gray-500">Leave empty to auto-generate</p>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Amount *
            </label>
            <input
              type="number"
              id="amount"
              step="0.01"
              min="0"
              {...register('amount', { 
                required: 'Amount is required',
                min: { value: 0.01, message: 'Amount must be greater than 0' }
              })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                errors.amount ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
              Type *
            </label>
            <select
              id="type"
              {...register('type', { required: 'Type is required' })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                errors.type ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select type</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="investment">Investment</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              id="category_id"
              {...register('category_id', { required: 'Category is required' })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                errors.category_id ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={!watchType}
            >
              <option value="">Select category</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.category_id && (
              <p className="mt-1 text-sm text-red-600">{errors.category_id.message}</p>
            )}
            {!watchType && (
              <p className="mt-1 text-sm text-gray-500">Please select a type first</p>
            )}
          </div>

          {/* Bank Account */}
          <div>
            <label htmlFor="bank_account_id" className="block text-sm font-medium text-gray-700 mb-2">
              Bank Account *
            </label>
            <select
              id="bank_account_id"
              {...register('bank_account_id', { required: 'Bank account is required', valueAsNumber: true })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                errors.bank_account_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select bank account</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} {acc.account_number ? `(${acc.account_number})` : ''}
                </option>
              ))}
            </select>
            {errors.bank_account_id && (
              <p className="mt-1 text-sm text-red-600">{errors.bank_account_id.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              id="description"
              {...register('description')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="Optional description"
            />
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <input
              type="date"
              id="date"
              {...register('date', { required: 'Date is required' })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                errors.date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <LoadingSpinner /> : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 