'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getTransactionAggregate, getTransactions, getTransactionsByDateRange, deleteTransaction, updateTransactionCategory, getCategories } from '@/lib/api';
import type { TransactionAggregate, Transaction, Category } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B'];

export default function Dashboard() {
  const [data, setData] = useState<TransactionAggregate | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingCategory, setUpdatingCategory] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateFiltering, setIsDateFiltering] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aggregate, categoriesData] = await Promise.all([
        getTransactionAggregate(),
        getCategories()
      ]);
      
      console.log('Fetched aggregate:', aggregate);
      // Defensive: ensure categories is an object
      if (!aggregate || typeof aggregate.categories !== 'object' || aggregate.categories === null) {
        aggregate.categories = {};
      }
      setData(aggregate);
      setCategories(categoriesData);

      let txs: Transaction[];
      if (isDateFiltering && startDate && endDate) {
        txs = await getTransactionsByDateRange({
          start_date: startDate,
          end_date: endDate,
          type: filterType === 'all' ? undefined : filterType
        });
      } else {
        txs = await getTransactions(filterType === 'all' ? undefined : filterType);
      }
      
      console.log('Fetched transactions:', txs);
      // Defensive: ensure txs is an array
      setTransactions(Array.isArray(txs) ? txs : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterType, isDateFiltering, startDate, endDate]);

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      await deleteTransaction(id);
      toast.success('Transaction deleted successfully');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    }
  };

  const handleCategoryChange = async (transactionId: number, newCategoryId: number, transactionType: 'expense' | 'income') => {
    // Validate that the category type matches the transaction type
    const selectedCategory = categories.find(cat => cat.id === newCategoryId);
    if (!selectedCategory) {
      toast.error('Invalid category selected');
      return;
    }

    if (selectedCategory.type !== transactionType) {
      toast.error(`Cannot assign ${selectedCategory.type} category to ${transactionType} transaction`);
      return;
    }

    // Preserve scroll position
    const scrollPosition = window.scrollY;

    setUpdatingCategory(transactionId);
    try {
      await updateTransactionCategory(transactionId, newCategoryId);
      
      // Update the transaction in the local state instead of refetching all data
      setTransactions(prevTransactions => 
        prevTransactions.map(tx => 
          tx.id === transactionId 
            ? { ...tx, category_id: newCategoryId, category: selectedCategory }
            : tx
        )
      );
      
      // Restore scroll position after state update
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
      
      toast.success('Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
      // Restore scroll position even on error
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    } finally {
      setUpdatingCategory(null);
    }
  };

  const applyDateFilter = () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    setIsDateFiltering(true);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setIsDateFiltering(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data || typeof data.categories !== 'object' || data.categories === null) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">No Data Available</h2>
        <p className="text-gray-600">Start by adding some transactions to see your financial overview.</p>
      </div>
    );
  }

  const chartData = Object.entries(data.categories).map(([name, value]) => ({
    name,
    value,
  }));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Financial Dashboard</h1>
        <p className="text-gray-600">Track your income, expenses, and savings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Income</h3>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(data.total_income)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Expenses</h3>
          <p className="text-3xl font-bold text-red-600">{formatCurrency(data.total_expenses)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Net Amount</h3>
          <p className="text-3xl font-bold text-blue-600">{formatCurrency(data.net_amount)}</p>
        </div>
      </div>

      {/* Category Breakdown Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              fill="#8884d8"
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(value as number)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Transaction List */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 md:mb-0">Transactions</h3>
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'expense' | 'income')}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-sm font-medium text-gray-700">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={applyDateFilter}
                disabled={!startDate || !endDate}
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
              {isDateFiltering && (
                <button
                  onClick={clearDateFilter}
                  className="px-3 py-1 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="text-gray-500">No transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 font-mono">{tx.transaction_id || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{tx.description || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      <select
                        value={tx.category_id}
                        onChange={(e) => handleCategoryChange(tx.id, Number(e.target.value), tx.type)}
                        disabled={updatingCategory === tx.id}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {categories
                          .filter(cat => cat.type === tx.type)
                          .map(category => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                      {updatingCategory === tx.id && (
                        <div className="flex items-center justify-center mt-1">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 capitalize">{tx.type}</td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                        title="Delete transaction"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
