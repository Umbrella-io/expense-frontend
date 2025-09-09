'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getTransactionAggregate, getTransactionAggregateTable, getTransactions, getTransactionsByDateRange, deleteTransaction, deleteBulkTransactions, updateTransactionCategory, getCategories } from '@/lib/api';
import type { TransactionAggregate, AggregateTableResponse, Transaction, Category } from '@/lib/types';
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
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [aggregateTableData, setAggregateTableData] = useState<AggregateTableResponse | null>(null);
  const [aggregateTableStartDate, setAggregateTableStartDate] = useState('');
  const [aggregateTableEndDate, setAggregateTableEndDate] = useState('');

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

  const fetchAggregateTable = async () => {
    if (aggregateTableStartDate && aggregateTableEndDate) {
      try {
        const aggregateTable = await getTransactionAggregateTable(aggregateTableStartDate, aggregateTableEndDate);
        setAggregateTableData(aggregateTable);
      } catch (error) {
        console.error('Error fetching aggregate table:', error);
        setAggregateTableData(null);
      }
    }
  };

  // Initialize aggregate table date range to current month
  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentDate = new Date();
    
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    setAggregateTableStartDate(formatDate(startOfMonth));
    setAggregateTableEndDate(formatDate(currentDate));
  }, []);

  useEffect(() => {
    fetchData();
  }, [filterType, isDateFiltering, startDate, endDate]);

  useEffect(() => {
    fetchAggregateTable();
  }, [aggregateTableStartDate, aggregateTableEndDate]);

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

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) {
      toast.error('Please select transactions to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedTransactions.size} transaction(s)?`)) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      const transactionIds = Array.from(selectedTransactions);
      const result = await deleteBulkTransactions({ transaction_ids: transactionIds });
      
      if (result.deleted_count > 0) {
        toast.success(`Successfully deleted ${result.deleted_count} transaction(s)`);
      }
      
      if (result.failed_count > 0) {
        toast.error(`Failed to delete ${result.failed_count} transaction(s)`);
      }
      
      setSelectedTransactions(new Set());
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting transactions:', error);
      toast.error('Failed to delete transactions');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleSelectTransaction = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedTransactions);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedTransactions(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(transactions.map(tx => tx.id));
      setSelectedTransactions(allIds);
    } else {
      setSelectedTransactions(new Set());
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

  const chartData = Object.entries(data.categories || {}).map(([name, value]) => ({
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
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Financial Dashboard</h1>
        <p className="text-gray-600">Track your income, expenses, and savings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Income</h3>
          <p className="text-2xl md:text-3xl font-bold text-green-600">{formatCurrency(data.total_income)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Expenses</h3>
          <p className="text-2xl md:text-3xl font-bold text-red-600">{formatCurrency(data.total_expenses)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border sm:col-span-2 lg:col-span-1">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Net Amount</h3>
          <p className="text-2xl md:text-3xl font-bold text-blue-600">{formatCurrency(data.net_amount)}</p>
        </div>
      </div>

      {/* Category Breakdown Chart */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Category</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
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
        ) : (
          <div className="flex items-center justify-center h-[250px] text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">No category data available</p>
              <p className="text-sm">Add some transactions to see the breakdown</p>
            </div>
          </div>
        )}
      </div>

      {/* Aggregate Table */}
      {aggregateTableData && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex flex-col space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Category Breakdown</h3>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">From:</label>
                  <input
                    type="date"
                    value={aggregateTableStartDate}
                    onChange={(e) => setAggregateTableStartDate(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">To:</label>
                  <input
                    type="date"
                    value={aggregateTableEndDate}
                    onChange={(e) => setAggregateTableEndDate(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {new Date(aggregateTableData.date_range.start_date).toLocaleDateString()} - {new Date(aggregateTableData.date_range.end_date).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
            <div className="bg-green-50 p-3 md:p-4 rounded-lg border border-green-200">
              <h4 className="text-sm font-medium text-green-800 mb-1">Total Income</h4>
              <p className="text-xl md:text-2xl font-bold text-green-600">{formatCurrency(aggregateTableData.summary.total_income)}</p>
              <p className="text-sm text-green-700">{aggregateTableData.income.total_transactions} transactions</p>
            </div>
            <div className="bg-red-50 p-3 md:p-4 rounded-lg border border-red-200">
              <h4 className="text-sm font-medium text-red-800 mb-1">Total Expenses</h4>
              <p className="text-xl md:text-2xl font-bold text-red-600">{formatCurrency(aggregateTableData.summary.total_expenses)}</p>
              <p className="text-sm text-red-700">{aggregateTableData.expenses.total_transactions} transactions</p>
            </div>
            <div className={`p-3 md:p-4 rounded-lg border sm:col-span-2 lg:col-span-1 ${
              aggregateTableData.summary.net_amount >= 0 
                ? 'bg-blue-50 border-blue-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <h4 className={`text-sm font-medium mb-1 ${
                aggregateTableData.summary.net_amount >= 0 
                  ? 'text-blue-800' 
                  : 'text-orange-800'
              }`}>Net Amount</h4>
              <p className={`text-xl md:text-2xl font-bold ${
                aggregateTableData.summary.net_amount >= 0 
                  ? 'text-blue-600' 
                  : 'text-orange-600'
              }`}>{formatCurrency(aggregateTableData.summary.net_amount)}</p>
              <p className={`text-sm ${
                aggregateTableData.summary.net_amount >= 0 
                  ? 'text-blue-700' 
                  : 'text-orange-700'
              }`}>{aggregateTableData.summary.net_amount >= 0 ? 'Surplus' : 'Deficit'}</p>
            </div>
          </div>

          {/* Category Tables */}
          <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
            {/* Income Categories */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                Income Categories
              </h4>
              {aggregateTableData.income.categories && aggregateTableData.income.categories.length > 0 ? (
                <div className="space-y-2">
                  {/* Mobile Card View */}
                  <div className="block sm:hidden space-y-2">
                    {aggregateTableData.income.categories.map(category => (
                      <div key={category.category_id} className="bg-white p-3 rounded border">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-900 text-sm">{category.category_name}</span>
                          <span className="font-semibold text-green-600 text-sm">{formatCurrency(category.total_amount)}</span>
                        </div>
                        <div className="text-xs text-gray-600">{category.transaction_count} transactions</div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {aggregateTableData.income.categories.map(category => (
                          <tr key={category.category_id}>
                            <td className="px-3 py-2 text-sm text-gray-900">{category.category_name}</td>
                            <td className="px-3 py-2 text-sm text-right font-semibold text-green-600">
                              {formatCurrency(category.total_amount)}
                            </td>
                            <td className="px-3 py-2 text-sm text-right text-gray-600">
                              {category.transaction_count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm py-4 bg-white rounded border text-center">No income transactions in this period</div>
              )}
            </div>

            {/* Expense Categories */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                Expense Categories
              </h4>
              {aggregateTableData.expenses.categories && aggregateTableData.expenses.categories.length > 0 ? (
                <div className="space-y-2">
                  {/* Mobile Card View */}
                  <div className="block sm:hidden space-y-2">
                    {aggregateTableData.expenses.categories.map(category => (
                      <div key={category.category_id} className="bg-white p-3 rounded border">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-900 text-sm">{category.category_name}</span>
                          <span className="font-semibold text-red-600 text-sm">{formatCurrency(category.total_amount)}</span>
                        </div>
                        <div className="text-xs text-gray-600">{category.transaction_count} transactions</div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {aggregateTableData.expenses.categories.map(category => (
                          <tr key={category.category_id}>
                            <td className="px-3 py-2 text-sm text-gray-900">{category.category_name}</td>
                            <td className="px-3 py-2 text-sm text-right font-semibold text-red-600">
                              {formatCurrency(category.total_amount)}
                            </td>
                            <td className="px-3 py-2 text-sm text-right text-gray-600">
                              {category.transaction_count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm py-4 bg-white rounded border text-center">No expense transactions in this period</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
            {selectedTransactions.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isDeletingBulk}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeletingBulk ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : null}
                Delete Selected ({selectedTransactions.size})
              </button>
            )}
          </div>
          
          {/* Filters */}
          <div className="flex flex-col space-y-3 md:space-y-0 md:flex-row md:gap-4">
            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'expense' | 'income')}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:flex-initial"
              >
                <option value="all">All</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyDateFilter}
                  disabled={!startDate || !endDate}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Apply
                </button>
                {isDateFiltering && (
                  <button
                    onClick={clearDateFilter}
                    className="px-3 py-1 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No transactions found.</div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={transactions.length > 0 && selectedTransactions.size === transactions.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">Select All</span>
                </div>
                <span className="text-sm text-gray-600">{transactions.length} transactions</span>
              </div>
              {transactions.map(tx => (
                <div key={tx.id} className={`border rounded-lg p-4 space-y-3 ${selectedTransactions.has(tx.id) ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(tx.id)}
                        onChange={(e) => handleSelectTransaction(tx.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{tx.description || 'No description'}</div>
                        <div className="text-sm text-gray-500 font-mono">{tx.transaction_id || 'No ID'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(tx.amount)}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">{tx.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{new Date(tx.date).toLocaleDateString()}</span>
                    <button
                      onClick={() => handleDeleteTransaction(tx.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Category:</label>
                    <select
                      value={tx.category_id || ''}
                      onChange={(e) => handleCategoryChange(tx.id, Number(e.target.value), tx.type)}
                      disabled={updatingCategory === tx.id}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      <input
                        type="checkbox"
                        checked={transactions.length > 0 && selectedTransactions.size === transactions.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {transactions.map(tx => (
                    <tr key={tx.id} className={selectedTransactions.has(tx.id) ? 'bg-blue-50' : ''}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(tx.id)}
                          onChange={(e) => handleSelectTransaction(tx.id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 font-mono">{tx.transaction_id || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 max-w-xs truncate">{tx.description || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        <select
                          value={tx.category_id || ''}
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
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 capitalize">{tx.type}</td>
                      <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
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
          </>
        )}
      </div>
    </div>
  );
}
