'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  getCategories,
  getRefunds,
  createRefund,
  updateRefund,
  deleteTransactionCascade,
} from '@/lib/api';
import type { Category, RefundChildInput, RefundCreateRequest, RefundGroupResponse } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function RefundsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refunds, setRefunds] = useState<RefundGroupResponse[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Parent form
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<{ transaction_id?: string; amount: number; bank_account_id: number; description?: string; date?: string }>();

  const parentAmount = Number(watch('amount') || 0);

  // Children state
  const [children, setChildren] = useState<RefundChildInput[]>([
    { amount: 0, category_id: 0, description: '' },
  ]);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  const childrenSum = useMemo(
    () => children.reduce((acc, c) => acc + Number(c.amount || 0), 0),
    [children]
  );

  const remaining = useMemo(() => Number(parentAmount) - Number(childrenSum), [parentAmount, childrenSum]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cats, list] = await Promise.all([
        getCategories(),
        getRefunds({})
      ]);
      setCategories(cats);
      setRefunds(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Default parent date to today
    reset((prev) => ({ ...prev, date: new Date().toISOString().split('T')[0], bank_account_id: 1 }));
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addChild = () => {
    setChildren((prev) => [...prev, { amount: 0, category_id: 0, description: '' }]);
  };

  const removeChild = (index: number) => {
    setChildren((prev) => prev.filter((_, i) => i !== index));
  };

  const updateChild = (index: number, patch: Partial<RefundChildInput>) => {
    setChildren((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const onSubmit = async (data: { transaction_id?: string; amount: number; bank_account_id: number; description?: string; date?: string }) => {
    if (children.length === 0) {
      toast.error('Add at least one refund item');
      return;
    }
    if (remaining !== 0) {
      toast.error('Children sum must equal the parent amount');
      return;
    }

    const payload: RefundCreateRequest = {
      transaction_id: data.transaction_id || undefined,
      amount: Number(data.amount),
      bank_account_id: Number(data.bank_account_id),
      description: data.description,
      date: data.date ? new Date(data.date).toISOString() : undefined,
      children: children.map((c) => ({
        transaction_id: c.transaction_id || undefined,
        amount: Number(c.amount),
        category_id: Number(c.category_id),
        description: c.description,
        date: c.date ? new Date(c.date).toISOString() : undefined,
      })),
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateRefund(editingId, { ...payload });
        toast.success('Refund updated');
      } else {
        await createRefund(payload);
        toast.success('Refund created');
      }
      // reset form
      reset({ transaction_id: '', amount: 0, bank_account_id: 1, description: '', date: new Date().toISOString().split('T')[0] });
      setChildren([{ amount: 0, category_id: 0, description: '' }]);
      setEditingId(null);
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit refund');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (group: RefundGroupResponse) => {
    setEditingId(group.parent.id);
    reset({
      transaction_id: group.parent.transaction_id,
      amount: group.total_amount,
      bank_account_id: Number(group.parent.bank_account_id),
      description: group.parent.description,
      date: group.parent.date?.split('T')[0],
    });
    setChildren(
      group.children.map((c) => ({
        transaction_id: c.transaction_id,
        amount: c.amount,
        category_id: c.category_id || 0,
        description: c.description,
        date: c.date?.split('T')[0],
      }))
    );
  };

  const handleDeleteGroup = async (group: RefundGroupResponse) => {
    if (!confirm('Delete refund parent and all its children?')) return;
    try {
      await deleteTransactionCascade(group.parent.id);
      toast.success('Refund group deleted');
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete refund group');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Refunds</h1>
        <p className="text-gray-600">Create and manage refunds that offset your expenses</p>
      </div>

      {/* Create / Edit Refund */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{editingId ? 'Edit Refund' : 'Create Refund'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Parent details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Amount *</label>
              <input
                type="number"
                step="0.01"
                min={0}
                {...register('amount', { required: 'Amount is required', min: { value: 0.01, message: 'Must be > 0' } })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.amount ? 'border-red-500' : 'border-gray-300'} text-gray-900`}
              />
              {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank Account *</label>
              <select
                {...register('bank_account_id', { required: 'Bank account is required' })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.bank_account_id ? 'border-red-500' : 'border-gray-300'} text-gray-900`}
              >
                <option value="">Select bank account</option>
                <option value="1">Default Account</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transaction ID</label>
              <input type="text" {...register('transaction_id')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-gray-900" />
              <p className="mt-1 text-sm text-gray-500">Optional. Leave empty to auto-generate.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input type="date" {...register('date', { required: 'Date is required' })} className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.date ? 'border-red-500' : 'border-gray-300'} text-gray-900`} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input type="text" {...register('description')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" />
            </div>
          </div>

          {/* Children */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Refund Items</h3>
              <button type="button" onClick={addChild} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Add Item</button>
            </div>
            <div className="bg-gray-50 rounded border divide-y">
              {children.map((child, index) => (
                <div key={index} className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={child.amount ?? 0}
                      onChange={(e) => updateChild(index, { amount: Number(e.target.value) })}
                      className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Category (Expense) *</label>
                    <select
                      value={child.category_id || 0}
                      onChange={(e) => updateChild(index, { category_id: Number(e.target.value) })}
                      className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value={0}>Select category</option>
                      {expenseCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={child.description || ''}
                      onChange={(e) => updateChild(index, { description: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div className="sm:col-span-1 flex gap-2 justify-end">
                    <button type="button" onClick={() => removeChild(index)} className="px-2 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100">Remove</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live validation bar */}
            <div className="mt-3 flex items-center justify-between text-sm">
              <div className="text-gray-700">
                Children sum: <span className="font-semibold">{childrenSum.toFixed(2)}</span> / Parent amount: <span className="font-semibold">{Number(parentAmount || 0).toFixed(2)}</span>
              </div>
              <div className={remaining === 0 ? 'text-green-600 font-semibold' : remaining > 0 ? 'text-orange-600 font-semibold' : 'text-red-600 font-semibold'}>
                {remaining === 0 ? 'Balanced' : remaining > 0 ? `Remaining ${remaining.toFixed(2)}` : `Over by ${Math.abs(remaining).toFixed(2)}`}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  reset({ transaction_id: '', amount: 0, bank_account_id: 1, description: '', date: new Date().toISOString().split('T')[0] });
                  setChildren([{ amount: 0, category_id: 0, description: '' }]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel Edit
              </button>
            )}
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {submitting ? <LoadingSpinner /> : editingId ? 'Update Refund' : 'Create Refund'}
            </button>
          </div>
        </form>
      </div>

      {/* Existing refund groups */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Existing Refunds</h2>
        </div>
        {!refunds || refunds.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No refunds found.</div>
        ) : (
          <div className="space-y-3">
            {refunds.map((g) => (
              <div key={g.parent.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{g.parent.description || 'No description'}</div>
                    <div className="text-sm text-gray-600 flex gap-3 flex-wrap">
                      <span className="font-mono">{g.parent.transaction_id || '-'}</span>
                      <span>{new Date(g.parent.date).toLocaleDateString()}</span>
                      <span className="text-teal-700">Amount: {g.total_amount}</span>
                      <span>Items: {g.children.length}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(g)} className="px-3 py-1 text-sm border rounded hover:bg-white">Edit</button>
                    <button onClick={() => handleDeleteGroup(g)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {g.children.map((c) => (
                    <div key={c.id} className="bg-white border rounded p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{c.category?.name || '-'}</span>
                        <span className="text-teal-700 font-semibold">{c.amount}</span>
                      </div>
                      <div className="text-gray-600 flex justify-between mt-1">
                        <span className="font-mono">{c.transaction_id || '-'}</span>
                        <span>{new Date(c.date).toLocaleDateString()}</span>
                      </div>
                      {c.description && <div className="text-gray-700 mt-1">{c.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
