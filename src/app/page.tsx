'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getTransactionAggregate, getTransactions } from '@/lib/api';
import type { TransactionAggregate, Transaction } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B'];

export default function Dashboard() {
  const [data, setData] = useState<TransactionAggregate | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const aggregate = await getTransactionAggregate();
        setData(aggregate);
        const txs = await getTransactions();
        setTransactions(txs);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data || !data.categories) {
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
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <div className="text-gray-500">No transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{tx.description || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{tx.category?.name || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 capitalize">{tx.type}</td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount)}</td>
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
