'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getTransactionAggregate, getTransactionAggregateTable, getTransactions, getTransactionsByDateRange, deleteTransaction, deleteBulkTransactions, updateTransactionCategory, deleteTransactionCascade, updateTransactionType, getBankAccounts, updateTransactionBankAccounts, updateTransaction, convertTransactionToRefund } from '@/lib/api';
import type { TransactionAggregate, AggregateTableResponse, Transaction, BankAccount, UpdateTransactionRequest, RefundChildInput } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';
import { useCategories } from '@/contexts/CategoriesContext';
import { useRouter } from 'next/navigation';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B'];

export default function Dashboard() {
  const router = useRouter();
  const { categories, getFirstCategoryByType } = useCategories();
  const [data, setData] = useState<TransactionAggregate | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingCategory, setUpdatingCategory] = useState<number | null>(null);
  const [updatingType, setUpdatingType] = useState<number | null>(null);
  const [updatingBankAccount, setUpdatingBankAccount] = useState<number | null>(null);
  const [convertingToRefund, setConvertingToRefund] = useState<number | null>(null);
  const [convertingFromRefund, setConvertingFromRefund] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'investment' | 'transfer' | 'refund'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateFiltering, setIsDateFiltering] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [aggregateTableData, setAggregateTableData] = useState<AggregateTableResponse | null>(null);
  const [aggregateTableStartDate, setAggregateTableStartDate] = useState('');
  const [aggregateTableEndDate, setAggregateTableEndDate] = useState('');

  // Grouping for refund parent/children
  const visibleTransactions = useMemo(() =>
    transactions.filter(tx => !(tx.type === 'refund' && tx.parent_transaction_id != null)),
    [transactions]
  );

  const refundChildrenByParent = useMemo(() => {
    const map = new Map<number, Transaction[]>();
    transactions.forEach(tx => {
      if (tx.type === 'refund' && tx.parent_transaction_id != null) {
        const arr = map.get(tx.parent_transaction_id) || [];
        arr.push(tx);
        map.set(tx.parent_transaction_id, arr);
      }
    });
    return map;
  }, [transactions]);

  const [expandedRefundParents, setExpandedRefundParents] = useState<Set<number>>(new Set());
  const toggleRefundExpanded = (parentId: number) => {
    setExpandedRefundParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId); else next.add(parentId);
      return next;
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aggregate, bankAccountsData] = await Promise.all([
        getTransactionAggregate(),
        getBankAccounts()
      ]);
      
      console.log('Fetched aggregate:', aggregate);
      // Defensive: ensure categories is an object
      if (!aggregate || typeof aggregate.categories !== 'object' || aggregate.categories === null) {
        aggregate.categories = {};
      }
      setData(aggregate);
      setBankAccounts(bankAccountsData);

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

  const handleDeleteTransaction = async (tx: Transaction) => {
    // For refund parent (type=refund and no parent_transaction_id), ask cascade confirmation
    const isRefundParent = tx.type === 'refund' && (tx.parent_transaction_id == null);
    const message = isRefundParent
      ? 'This is a refund parent. Delete it and all its children?'
      : 'Are you sure you want to delete this transaction?';
    if (!confirm(message)) {
      return;
    }

    try {
      if (isRefundParent) {
        await deleteTransactionCascade(tx.id);
      } else {
        await deleteTransaction(tx.id);
      }
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
      // Only visible top-level transactions
      const allIds = new Set(visibleTransactions.map(tx => tx.id));
      setSelectedTransactions(allIds);
    } else {
      setSelectedTransactions(new Set());
    }
  };

  const handleCategoryChange = async (transactionId: number, newCategoryId: number, transactionType: 'expense' | 'income' | 'investment' | 'refund' | 'transfer') => {
    // Validate that the category type matches the transaction type
    const selectedCategory = categories.find(cat => cat.id === newCategoryId);
    if (!selectedCategory) {
      toast.error('Invalid category selected');
      return;
    }

    if (transactionType === 'refund') {
      // Refund child categories must be expense
      if (selectedCategory.type !== 'expense') {
        toast.error('Refund children must use an expense category');
        return;
      }
    } else {
      if (selectedCategory.type !== transactionType) {
        toast.error(`Cannot assign ${selectedCategory.type} category to ${transactionType} transaction`);
        return;
      }
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

  const handleTypeChange = async (transactionId: number, newType: 'expense' | 'income' | 'investment' | 'transfer' | 'refund') => {
    // Can't change TO transfer or refund via dropdown
    if (newType === 'transfer' || newType === 'refund') {
      toast.error('Cannot change type to transfer or refund using this dropdown');
      return;
    }

    // Get the first category of the new type
    const firstCategory = getFirstCategoryByType(newType);
    if (!firstCategory) {
      toast.error(`No ${newType} categories available`);
      return;
    }

    // Preserve scroll position
    const scrollPosition = window.scrollY;

    setUpdatingType(transactionId);
    try {
      // Update type and category - don't send destination_bank_account_id at all
      const payload: UpdateTransactionRequest = {
        type: newType,
        category_id: firstCategory.id
      };
      
      const updatedTx = await updateTransaction(transactionId, payload);
      
      // Update the transaction in the local state
      setTransactions(prevTransactions => 
        prevTransactions.map(tx => 
          tx.id === transactionId ? updatedTx : tx
        )
      );
      
      // Restore scroll position after state update
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
      
      toast.success(`Transaction type updated to ${newType}`);
    } catch (error) {
      console.error('Error updating type:', error);
      toast.error('Failed to update transaction type');
      // Restore scroll position even on error
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    } finally {
      setUpdatingType(null);
    }
  };

  const handleBankAccountChange = async (
    transactionId: number,
    field: 'source' | 'destination',
    newBankAccountId: number | null
  ) => {
    const transaction = transactions.find(tx => tx.id === transactionId);
    if (!transaction) return;

    let sourceBankId = transaction.bank_account_id;
    let destBankId = transaction.destination_bank_account_id ?? null;

    if (field === 'source') {
      if (newBankAccountId === null) {
        toast.error('Source bank account is required');
        return;
      }
      sourceBankId = newBankAccountId;
    } else {
      destBankId = newBankAccountId;
    }

    // Validation: source and destination can't be the same
    if (destBankId !== null && sourceBankId === destBankId) {
      toast.error('Source and destination bank accounts cannot be the same');
      return;
    }

    // Preserve scroll position
    const scrollPosition = window.scrollY;

    setUpdatingBankAccount(transactionId);
    try {
      const updatedTx = await updateTransactionBankAccounts(transactionId, sourceBankId, destBankId);
      
      // Update the transaction in the local state
      setTransactions(prevTransactions => 
        prevTransactions.map(tx => 
          tx.id === transactionId ? updatedTx : tx
        )
      );
      
      // Restore scroll position after state update
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
      
      if (updatedTx.type === 'transfer') {
        toast.success('Updated to transfer transaction');
      } else {
        toast.success('Bank accounts updated successfully');
      }
    } catch (error) {
      console.error('Error updating bank accounts:', error);
      toast.error('Failed to update bank accounts');
      // Restore scroll position even on error
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    } finally {
      setUpdatingBankAccount(null);
    }
  };

  const handleConvertToRefund = async (transaction: Transaction) => {
    // Can only convert transactions without a parent
    if (transaction.type === 'refund') {
      toast.error('Cannot convert refunds to refunds');
      return;
    }
    
    if (transaction.parent_transaction_id != null) {
      toast.error('Cannot convert transactions with a parent (child transactions)');
      return;
    }

    // Get first expense category for the breakdown
    const expenseCategories = categories.filter(cat => cat.type === 'expense');
    if (expenseCategories.length === 0) {
      toast.error('No expense categories available');
      return;
    }

    const firstExpenseCategory = expenseCategories.sort((a, b) => a.id - b.id)[0];

    setConvertingToRefund(transaction.id);
    try {
      const refundGroup = await convertTransactionToRefund(transaction.id, {
        children: [
          {
            amount: transaction.amount,
            category_id: firstExpenseCategory.id,
            description: transaction.description || 'Refund item'
          }
        ]
      });
      
      toast.success('Transaction converted to refund! Redirecting to edit...');
      // Redirect to refunds page with edit parameter
      router.push(`/refunds?edit=${refundGroup.parent.id}`);
    } catch (error) {
      console.error('Error converting to refund:', error);
      toast.error('Failed to convert transaction to refund');
      setConvertingToRefund(null);
    }
  };

  const handleConvertFromRefund = async (transaction: Transaction, targetType: 'expense' | 'income' | 'investment' | 'transfer') => {
    // Can only convert refund parents
    if (transaction.type !== 'refund') {
      toast.error('Can only convert refund parents');
      return;
    }
    
    if (transaction.parent_transaction_id != null) {
      toast.error('Cannot convert refund children');
      return;
    }

    // Preserve scroll position
    const scrollPosition = window.scrollY;

    setConvertingFromRefund(transaction.id);
    try {
      let payload: UpdateTransactionRequest;
      
      if (targetType === 'transfer') {
        // For transfer, need destination bank account
        const otherBank = bankAccounts.find(acc => acc.id !== transaction.bank_account_id);
        if (!otherBank) {
          toast.error('Need at least 2 bank accounts for transfer');
          setConvertingFromRefund(null);
          return;
        }
        payload = {
          type: 'transfer',
          destination_bank_account_id: otherBank.id
        };
      } else {
        // For expense/income/investment, need matching category
        const firstCategory = getFirstCategoryByType(targetType);
        if (!firstCategory) {
          toast.error(`No ${targetType} categories available`);
          setConvertingFromRefund(null);
          return;
        }
        payload = {
          type: targetType,
          category_id: firstCategory.id
        };
      }
      
      const updatedTx = await updateTransaction(transaction.id, payload);
      
      // Update the transaction in the local state
      setTransactions(prevTransactions => 
        prevTransactions.map(tx => 
          tx.id === transaction.id ? updatedTx : tx
        )
      );
      
      // Restore scroll position after state update
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
      
      toast.success(`Refund converted to ${targetType}! Children deleted.`);
      fetchData(); // Refresh to remove deleted children
    } catch (error) {
      console.error('Error converting from refund:', error);
      toast.error('Failed to convert refund');
      // Restore scroll position even on error
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    } finally {
      setConvertingFromRefund(null);
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
        <p className="text-gray-600">Track your income, expenses, investments, and savings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Income</h3>
          <p className="text-2xl md:text-3xl font-bold text-green-600">{formatCurrency(data.total_income)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Expenses</h3>
          <p className="text-2xl md:text-3xl font-bold text-red-600">{formatCurrency(data.total_expenses)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Investments</h3>
          <p className="text-2xl md:text-3xl font-bold text-purple-600">{formatCurrency(data.total_investments || 0)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
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
            <div className="bg-purple-50 p-3 md:p-4 rounded-lg border border-purple-200">
              <h4 className="text-sm font-medium text-purple-800 mb-1">Total Investments</h4>
              <p className="text-xl md:text-2xl font-bold text-purple-600">{formatCurrency(aggregateTableData.summary.total_investments || 0)}</p>
              <p className="text-sm text-purple-700">{aggregateTableData.investments?.total_transactions || 0} transactions</p>
            </div>
            <div className={`p-3 md:p-4 rounded-lg border ${
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
          <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">
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

            {/* Investment Categories */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                Investment Categories
              </h4>
              {aggregateTableData.investments?.categories && aggregateTableData.investments.categories.length > 0 ? (
                <div className="space-y-2">
                  {/* Mobile Card View */}
                  <div className="block sm:hidden space-y-2">
                    {aggregateTableData.investments.categories.map(category => (
                      <div key={category.category_id} className="bg-white p-3 rounded border">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-900 text-sm">{category.category_name}</span>
                          <span className="font-semibold text-purple-600 text-sm">{formatCurrency(category.total_amount)}</span>
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
                        {aggregateTableData.investments.categories.map(category => (
                          <tr key={category.category_id}>
                            <td className="px-3 py-2 text-sm text-gray-900">{category.category_name}</td>
                            <td className="px-3 py-2 text-sm text-right font-semibold text-purple-600">
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
                <div className="text-gray-500 text-sm py-4 bg-white rounded border text-center">No investment transactions in this period</div>
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
                onChange={(e) => setFilterType(e.target.value as 'all' | 'expense' | 'income' | 'investment' | 'transfer' | 'refund')}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:flex-initial"
              >
                <option value="all">All</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="investment">Investment</option>
                <option value="transfer">Transfer</option>
                <option value="refund">Refund</option>
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
        {visibleTransactions.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No transactions found.</div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleTransactions.length > 0 && selectedTransactions.size === visibleTransactions.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">Select All</span>
                </div>
                <span className="text-sm text-gray-600">{visibleTransactions.length} transactions</span>
              </div>
              {visibleTransactions.map((tx: Transaction) => (
                <div
                  key={tx.id}
                  onClick={() => {
                    if (tx.type === 'refund' && (tx.parent_transaction_id == null)) toggleRefundExpanded(tx.id);
                  }}
                  className={`border rounded-lg p-4 space-y-3 ${selectedTransactions.has(tx.id) ? 'bg-blue-50 border-blue-200' : 'bg-white'} ${
                    tx.type === 'refund' && (tx.parent_transaction_id == null) ? 'bg-gray-50 hover:bg-gray-100 cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        onClick={(e) => e.stopPropagation()}
                        type="checkbox"
                        checked={selectedTransactions.has(tx.id)}
                        onChange={(e) => handleSelectTransaction(tx.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          <span>{tx.description || 'No description'}</span>
                        </div>
                        <div className="text-sm text-gray-500 font-mono">{tx.transaction_id || 'No ID'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${
                        tx.type === 'income' ? 'text-green-600' : 
                        tx.type === 'investment' ? 'text-purple-600' : 
                        tx.type === 'refund' ? 'text-teal-600' :
                        'text-red-600'
                      }`}>
                        {formatCurrency(tx.amount)}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">{tx.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{new Date(tx.date).toLocaleDateString()}</span>
                    <div className="flex items-center gap-3">
                      {/* Convert to Refund button - all types except refunds and child transactions */}
                      {tx.type !== 'refund' && tx.parent_transaction_id == null && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConvertToRefund(tx); }}
                          disabled={convertingToRefund === tx.id}
                          className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                        >
                          {convertingToRefund === tx.id ? '...' : 'Convert'}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx); }}
                        className={`text-red-600 hover:text-red-800 font-medium ${
                          tx.type === 'refund' ? 'text-teal-600' : ''
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Type:</label>
                    <select
                      onClick={(e) => e.stopPropagation()}
                      value={tx.type}
                      onChange={(e) => handleTypeChange(tx.id, e.target.value as 'expense' | 'income' | 'investment' | 'transfer' | 'refund')}
                      disabled={updatingType === tx.id || tx.type === 'refund'}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="investment">Investment</option>
                      <option value="transfer" disabled>Transfer</option>
                      <option value="refund" disabled>Refund</option>
                    </select>
                    {updatingType === tx.id && (
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>
                  
                  {/* Convert From Refund - only for refund parents */}
                  {tx.type === 'refund' && tx.parent_transaction_id == null && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Convert to:</label>
                      <select
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value) {
                            handleConvertFromRefund(tx, value as 'expense' | 'income' | 'investment' | 'transfer');
                            e.target.value = '';  // Reset selection
                          }
                        }}
                        disabled={convertingFromRefund === tx.id}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="">Select type...</option>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="investment">Investment</option>
                        <option value="transfer">Transfer</option>
                      </select>
                      {convertingFromRefund === tx.id && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Category:</label>
                    <select
                      onClick={(e) => e.stopPropagation()}
                      value={tx.category_id || ''}
                      onChange={(e) => handleCategoryChange(tx.id, Number(e.target.value), tx.type)}
                      disabled={updatingCategory === tx.id || (tx.type === 'refund' && (tx.parent_transaction_id == null))}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {(tx.type === 'refund'
                        ? categories.filter(cat => cat.type === 'expense')
                        : categories.filter(cat => cat.type === tx.type)
                      ).map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {updatingCategory === tx.id && (
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>
                  
                  {/* Source Bank Account */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Source:</label>
                    <select
                      onClick={(e) => e.stopPropagation()}
                      value={tx.bank_account_id}
                      onChange={(e) => handleBankAccountChange(tx.id, 'source', Number(e.target.value))}
                      disabled={updatingBankAccount === tx.id}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {bankAccounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                    {updatingBankAccount === tx.id && (
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>

                  {/* Destination Bank Account - only show if dest exists or show option to add */}
                  {(tx.destination_bank_account_id !== null && tx.destination_bank_account_id !== undefined) || tx.type === 'transfer' ? (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Destination:</label>
                      <select
                        onClick={(e) => e.stopPropagation()}
                        value={tx.destination_bank_account_id || ''}
                        onChange={(e) => handleBankAccountChange(tx.id, 'destination', e.target.value ? Number(e.target.value) : null)}
                        disabled={updatingBankAccount === tx.id}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="">None</option>
                        {bankAccounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Show dropdown by triggering a change
                          const firstAvailable = bankAccounts.find(acc => acc.id !== tx.bank_account_id);
                          if (firstAvailable) {
                            handleBankAccountChange(tx.id, 'destination', firstAvailable.id);
                          }
                        }}
                        disabled={updatingBankAccount === tx.id}
                        className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      >
                        + Add destination bank
                      </button>
                    </div>
                  )}

                  {/* Refund children expanded list (mobile) */}
                  {tx.type === 'refund' && expandedRefundParents.has(tx.id) && (
                    <div className="mt-2 border-t pt-2 space-y-2">
                      {(refundChildrenByParent.get(tx.id) || []).map((child: Transaction) => (
                        <div key={child.id} className="bg-gray-50 border rounded p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm text-gray-900 font-medium">{child.category?.name || '-'}</div>
                              <div className="text-xs text-gray-600 font-mono">{child.transaction_id || '-'}</div>
                            </div>
                            <div className="text-sm font-semibold text-teal-700">{formatCurrency(child.amount)}</div>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                            <span>{new Date(child.date).toLocaleDateString()}</span>
                            <button
                              onClick={() => handleDeleteTransaction(child)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                      {(refundChildrenByParent.get(tx.id) || []).length === 0 && (
                        <div className="text-xs text-gray-500">No refund items</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto mt-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  <input
                    type="checkbox"
                    checked={visibleTransactions.length > 0 && selectedTransactions.size === visibleTransactions.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source Bank</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dest Bank</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {visibleTransactions.map((tx: Transaction) => (
                <Fragment key={tx.id}>
                <tr
                  onClick={() => {
                    if (tx.type === 'refund' && (tx.parent_transaction_id == null)) toggleRefundExpanded(tx.id);
                  }}
                  className={`${selectedTransactions.has(tx.id) ? 'bg-blue-50' : ''} ${
                    tx.type === 'refund' && (tx.parent_transaction_id == null) ? 'bg-gray-50 hover:bg-gray-100 cursor-pointer' : ''
                  }`}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                    <input
                      onClick={(e) => e.stopPropagation()}
                      type="checkbox"
                      checked={selectedTransactions.has(tx.id)}
                      onChange={(e) => handleSelectTransaction(tx.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 font-mono">{tx.transaction_id || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 max-w-xs truncate">{tx.description || '-'}</td>
                  
                  {/* Source Bank */}
                  <td className="px-3 py-2 text-sm text-gray-700">
                    <select
                      onClick={(e) => e.stopPropagation()}
                      value={tx.bank_account_id}
                      onChange={(e) => handleBankAccountChange(tx.id, 'source', Number(e.target.value))}
                      disabled={updatingBankAccount === tx.id}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bankAccounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                    {updatingBankAccount === tx.id && (
                      <div className="flex items-center justify-center mt-1">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </td>

                  {/* Destination Bank */}
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {(tx.destination_bank_account_id !== null && tx.destination_bank_account_id !== undefined) || tx.type === 'transfer' ? (
                      <select
                        onClick={(e) => e.stopPropagation()}
                        value={tx.destination_bank_account_id || ''}
                        onChange={(e) => handleBankAccountChange(tx.id, 'destination', e.target.value ? Number(e.target.value) : null)}
                        disabled={updatingBankAccount === tx.id}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">None</option>
                        {bankAccounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const firstAvailable = bankAccounts.find(acc => acc.id !== tx.bank_account_id);
                          if (firstAvailable) {
                            handleBankAccountChange(tx.id, 'destination', firstAvailable.id);
                          }
                        }}
                        disabled={updatingBankAccount === tx.id}
                        className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      >
                        + Add
                      </button>
                    )}
                  </td>

                  <td className="px-3 py-2 text-sm text-gray-700">
                    <select
                      onClick={(e) => e.stopPropagation()}
                      value={tx.category_id || ''}
                      onChange={(e) => handleCategoryChange(tx.id, Number(e.target.value), tx.type)}
                      disabled={updatingCategory === tx.id || (tx.type === 'refund' && (tx.parent_transaction_id == null))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(tx.type === 'refund'
                        ? categories.filter(cat => cat.type === 'expense')
                        : categories.filter(cat => cat.type === tx.type)
                      ).map(category => (
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
                  <td className="px-3 py-2 text-sm text-gray-700">
                    <select
                      onClick={(e) => e.stopPropagation()}
                      value={tx.type}
                      onChange={(e) => handleTypeChange(tx.id, e.target.value as 'expense' | 'income' | 'investment' | 'transfer' | 'refund')}
                      disabled={updatingType === tx.id || tx.type === 'refund'}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed capitalize"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="investment">Investment</option>
                      <option value="transfer" disabled>Transfer</option>
                      <option value="refund" disabled>Refund</option>
                    </select>
                    {updatingType === tx.id && (
                      <div className="flex items-center justify-center mt-1">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {/* Convert From Refund - only for refund parents */}
                    {tx.type === 'refund' && tx.parent_transaction_id == null && (
                      <>
                        <div className="text-xs text-gray-500 mt-2 mb-1">Convert to:</div>
                        <select
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) {
                              handleConvertFromRefund(tx, value as 'expense' | 'income' | 'investment' | 'transfer');
                              e.target.value = '';  // Reset selection
                            }
                          }}
                          disabled={convertingFromRefund === tx.id}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select...</option>
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="investment">Investment</option>
                          <option value="transfer">Transfer</option>
                        </select>
                        {convertingFromRefund === tx.id && (
                          <div className="flex items-center justify-center mt-1">
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-semibold ${
                    tx.type === 'income' ? 'text-green-600' : 
                    tx.type === 'investment' ? 'text-purple-600' :
                    tx.type === 'refund' ? 'text-teal-600' :
                    'text-red-600'
                  }`}>{formatCurrency(tx.amount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                    <div className="inline-flex items-center gap-2">
                      {/* Convert to Refund button - all types except refunds and child transactions */}
                      {tx.type !== 'refund' && tx.parent_transaction_id == null && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConvertToRefund(tx); }}
                          disabled={convertingToRefund === tx.id}
                          className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                          title="Convert to refund"
                        >
                          {convertingToRefund === tx.id ? '...' : 'Convert'}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx); }}
                        className="text-red-600 hover:text-red-800 font-medium"
                        title="Delete transaction"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {tx.type === 'refund' && expandedRefundParents.has(tx.id) && (
                  <tr className="bg-gray-50">
                    <td colSpan={10} className="px-3 py-3">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Child ID</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                              <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                              <th className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {(refundChildrenByParent.get(tx.id) || []).map((child: Transaction) => (
                              <tr key={child.id}>
                                <td className="px-2 py-1 text-sm font-mono text-gray-700">{child.transaction_id || '-'}</td>
                                <td className="px-2 py-1 text-sm text-gray-700">{new Date(child.date).toLocaleDateString()}</td>
                                <td className="px-2 py-1 text-sm text-gray-700">{child.category?.name || '-'}</td>
                                <td className="px-2 py-1 text-sm text-right font-semibold text-teal-700">{formatCurrency(child.amount)}</td>
                                <td className="px-2 py-1 text-sm text-center">
                                  <button
                                    onClick={() => handleDeleteTransaction(child)}
                                    className="text-red-600 hover:text-red-800 font-medium"
                                    title="Delete child"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {(refundChildrenByParent.get(tx.id) || []).length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-2 py-2 text-sm text-gray-500 text-center">No refund items</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
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
