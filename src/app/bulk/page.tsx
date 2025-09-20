'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { createBulkTransactions, getCategories } from '@/lib/api';
import type { CreateTransactionRequest, Category, BulkTransactionRequest } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function BulkTransactions() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<BulkTransactionRequest>({
    defaultValues: {
      transactions: [
        {
          transaction_id: '',
          amount: 0,
          type: 'expense',
          category_id: 0,
          description: '',
          date: new Date().toISOString().split('T')[0],
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'transactions',
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Failed to load categories');
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const onSubmit = async (data: BulkTransactionRequest) => {
    setLoading(true);
    try {
      // Check for investment transactions
      const investmentTransactions = data.transactions.filter(tx => tx.type === 'investment');
      if (investmentTransactions.length > 0) {
        toast.error(`${investmentTransactions.length} investment transaction(s) detected. Investment transactions are not yet supported by the backend.`);
        return;
      }

      const payload = {
        transactions: data.transactions.map(tx => ({
          transaction_id: tx.transaction_id || undefined,
          amount: Number(tx.amount),
          type: tx.type,
          category_id: Number(tx.category_id),
          bank_account_id: Number(tx.bank_account_id),
          description: tx.description,
          date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
        })),
      };

      const result = await createBulkTransactions(payload);
      
      if (result.failed_count > 0) {
        toast.error(`${result.success_count} transactions created, ${result.failed_count} failed`);
        console.log('Failed transactions:', result.failed);
      } else {
        toast.success(`All ${result.success_count} transactions created successfully!`);
        router.push('/');
      }
    } catch (error) {
      console.error('Error creating bulk transactions:', error);
      toast.error('Failed to create transactions');
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = () => {
    append({
      transaction_id: '',
      amount: 0,
      type: 'expense',
      category_id: 0,
      bank_account_id: 1,
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  if (categoriesLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Add Transactions</h1>
        <p className="text-gray-600">Add multiple income, expense, or investment transactions at once</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {fields.map((field, index) => {
            const watchType = watch(`transactions.${index}.type`);
            const filteredCategories = categories.filter(cat => cat.type === watchType);

            return (
              <div key={field.id} className="border rounded-lg p-4 relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Transaction {index + 1}</h3>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Transaction ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction ID
                    </label>
                    <input
                      type="text"
                      {...register(`transactions.${index}.transaction_id`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-gray-900"
                      placeholder="Optional"
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`transactions.${index}.amount`, {
                        required: 'Amount is required',
                        min: { value: 0.01, message: 'Amount must be greater than 0' }
                      })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                        errors.transactions?.[index]?.amount ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0.00"
                    />
                    {errors.transactions?.[index]?.amount && (
                      <p className="mt-1 text-sm text-red-600">{errors.transactions[index]?.amount?.message}</p>
                    )}
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type *
                    </label>
                    <select
                      {...register(`transactions.${index}.type`, { required: 'Type is required' })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                        errors.transactions?.[index]?.type ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="investment">Investment</option>
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      {...register(`transactions.${index}.category_id`, { required: 'Category is required' })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                        errors.transactions?.[index]?.category_id ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select category</option>
                      {filteredCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {errors.transactions?.[index]?.category_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.transactions[index]?.category_id?.message}</p>
                    )}
                  </div>

                  {/* Bank Account */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Account *
                    </label>
                    <select
                      {...register(`transactions.${index}.bank_account_id`, { required: 'Bank account is required' })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                        errors.transactions?.[index]?.bank_account_id ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select bank account</option>
                      <option value="1">Default Account</option>
                    </select>
                    {errors.transactions?.[index]?.bank_account_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.transactions[index]?.bank_account_id?.message}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <input
                      type="text"
                      {...register(`transactions.${index}.description`, { required: 'Description is required' })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                        errors.transactions?.[index]?.description ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Transaction description"
                    />
                    {errors.transactions?.[index]?.description && (
                      <p className="mt-1 text-sm text-red-600">{errors.transactions[index]?.description?.message}</p>
                    )}
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      {...register(`transactions.${index}.date`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={addTransaction}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add Another Transaction
            </button>
          </div>

          {/* Submit Buttons */}
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
              {loading ? <LoadingSpinner /> : `Create ${fields.length} Transaction${fields.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
