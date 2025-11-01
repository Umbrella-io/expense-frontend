'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  getCategories,
  getRefunds,
  createRefund,
  updateRefund,
  deleteTransactionCascade,
  getBankAccounts,
} from '@/lib/api';
import type { Category, RefundChildInput, RefundCreateRequest, RefundGroupResponse, BankAccount } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function RefundsPage() {
  const searchParams = useSearchParams();
  const editParam = searchParams.get('edit');
  type RefundDraft = {
    transaction_id?: string;
    amount: number;
    bank_account_id: number;
    description?: string;
    date?: string;
    children: RefundChildInput[];
  };

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refunds, setRefunds] = useState<RefundGroupResponse[] | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [refundDrafts, setRefundDrafts] = useState<Record<number, RefundDraft>>({});
  const [savingRefundIds, setSavingRefundIds] = useState<Record<number, boolean>>({});
  const [highlightId, setHighlightId] = useState<number | null>(null);

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

  function getGroupDraft(group: RefundGroupResponse): RefundDraft {
    return {
      transaction_id: group.parent.transaction_id || undefined,
      amount: group.total_amount,
      bank_account_id: Number(group.parent.bank_account_id),
      description: group.parent.description || '',
      date: group.parent.date?.split('T')[0],
      children: (group.children ?? []).map((c) => ({
        transaction_id: c.transaction_id || undefined,
        amount: c.amount,
        category_id: c.category_id || 0,
        description: c.description || '',
        date: c.date?.split('T')[0],
      })),
    };
  }

  function getDraftForGroup(group: RefundGroupResponse): RefundDraft {
    return refundDrafts[group.parent.id] ?? getGroupDraft(group);
  }

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
      const [cats, list, accounts] = await Promise.all([
        getCategories(),
        getRefunds({}),
        getBankAccounts(false),
      ]);
      setCategories(cats);
      const normalizedRefunds = Array.isArray(list)
        ? list.map((group) => ({
            ...group,
            children: Array.isArray(group.children) ? group.children : [],
          }))
        : [];
      setRefunds(normalizedRefunds);
      setBankAccounts(Array.isArray(accounts) ? accounts.filter(a => a.is_active !== false) : []);
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

  useEffect(() => {
    if (!refunds) return;
    setRefundDrafts((prev) => {
      const next: Record<number, RefundDraft> = {};
      refunds.forEach((group) => {
        next[group.parent.id] = prev[group.parent.id] ?? getGroupDraft(group);
      });
      return next;
    });
  }, [refunds]);

  // Auto-highlight refund via edit param
  useEffect(() => {
    if (editParam) {
      const refundId = Number(editParam);
      if (!Number.isNaN(refundId)) {
        setHighlightId(refundId);
        setTimeout(() => setHighlightId(null), 4000);
      }
    }
  }, [editParam]);

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
      await createRefund(payload);
      toast.success('Refund created');
      // reset form
      reset({ transaction_id: '', amount: 0, bank_account_id: 1, description: '', date: new Date().toISOString().split('T')[0] });
      setChildren([{ amount: 0, category_id: 0, description: '' }]);
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit refund');
    } finally {
      setSubmitting(false);
    }
  };

  const updateGroupDraft = (group: RefundGroupResponse, patch: Partial<RefundDraft>) => {
    setRefundDrafts((prev) => {
      const base = prev[group.parent.id] ?? getGroupDraft(group);
      return {
        ...prev,
        [group.parent.id]: {
          ...base,
          ...patch,
        },
      };
    });
  };

  const updateDraftChild = (group: RefundGroupResponse, index: number, patch: Partial<RefundChildInput>) => {
    setRefundDrafts((prev) => {
      const base = prev[group.parent.id] ?? getGroupDraft(group);
      const nextChildren = base.children.map((child, idx) => (idx === index ? { ...child, ...patch } : child));
      return {
        ...prev,
        [group.parent.id]: {
          ...base,
          children: nextChildren,
        },
      };
    });
  };

  const addDraftChild = (group: RefundGroupResponse) => {
    setRefundDrafts((prev) => {
      const base = prev[group.parent.id] ?? getGroupDraft(group);
      return {
        ...prev,
        [group.parent.id]: {
          ...base,
          children: [...base.children, { amount: 0, category_id: 0, description: '' }],
        },
      };
    });
  };

  const removeDraftChild = (group: RefundGroupResponse, index: number) => {
    setRefundDrafts((prev) => {
      const base = prev[group.parent.id] ?? getGroupDraft(group);
      const nextChildren = base.children.filter((_, idx) => idx !== index);
      return {
        ...prev,
        [group.parent.id]: {
          ...base,
          children: nextChildren.length > 0 ? nextChildren : [{ amount: 0, category_id: 0, description: '' }],
        },
      };
    });
  };

  const getDraftChildrenSum = (group: RefundGroupResponse) => {
    const draft = refundDrafts[group.parent.id] ?? getGroupDraft(group);
    return draft.children.reduce((sum, child) => sum + Number(child.amount || 0), 0);
  };

  const getDraftRemaining = (group: RefundGroupResponse) => {
    const draft = refundDrafts[group.parent.id] ?? getGroupDraft(group);
    return Number(draft.amount || 0) - getDraftChildrenSum(group);
  };

  const resetDraftForGroup = (group: RefundGroupResponse) => {
    setRefundDrafts((prev) => ({
      ...prev,
      [group.parent.id]: getGroupDraft(group),
    }));
  };

  const handleSaveGroup = async (group: RefundGroupResponse) => {
    const draft = refundDrafts[group.parent.id] ?? getGroupDraft(group);
    const remaining = Number(draft.amount || 0) - draft.children.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    if (draft.children.length === 0) {
      toast.error('Add at least one refund item');
      return;
    }
    if (remaining !== 0) {
      toast.error('Children sum must equal the parent amount');
      return;
    }
    const payload: RefundCreateRequest = {
      transaction_id: draft.transaction_id,
      amount: Number(draft.amount),
      bank_account_id: Number(draft.bank_account_id),
      description: draft.description,
      date: draft.date ? new Date(draft.date).toISOString() : undefined,
      children: draft.children.map((child) => ({
        transaction_id: child.transaction_id,
        amount: Number(child.amount),
        category_id: Number(child.category_id),
        description: child.description,
        date: child.date ? new Date(child.date).toISOString() : undefined,
      })),
    };

    setSavingRefundIds((prev) => ({ ...prev, [group.parent.id]: true }));
    try {
      await updateRefund(group.parent.id, payload);
      toast.success('Refund updated');
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update refund');
    } finally {
      setSavingRefundIds((prev) => ({ ...prev, [group.parent.id]: false }));
    }
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

      {/* Create Refund */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Refund</h2>
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
                {...register('bank_account_id', { required: 'Bank account is required', valueAsNumber: true })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.bank_account_id ? 'border-red-500' : 'border-gray-300'} text-gray-900`}
              >
                <option value="">Select bank account</option>
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.account_number ? `(${acc.account_number})` : ''}
                  </option>
                ))}
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

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Refund'}
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
          <div className="space-y-6">
            {refunds.map((group) => {
              const draft = getDraftForGroup(group);
              const childrenSum = getDraftChildrenSum(group);
              const remaining = getDraftRemaining(group);
              const isSaving = Boolean(savingRefundIds[group.parent.id]);
              const isHighlighted = highlightId === group.parent.id;

              return (
                <div
                  key={group.parent.id}
                  className={`border rounded-lg bg-gray-50 p-4 sm:p-6 transition-shadow ${
                    isHighlighted ? 'ring-2 ring-blue-300 border-blue-400 shadow-md' : 'shadow-sm'
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Parent Amount *</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={draft.amount ?? 0}
                            onChange={(e) => updateGroupDraft(group, { amount: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account *</label>
                          <select
                            value={draft.bank_account_id ?? ''}
                            onChange={(e) => updateGroupDraft(group, { bank_account_id: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          >
                            <option value="">Select bank account</option>
                            {bankAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} {acc.account_number ? `(${acc.account_number})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                          <input
                            type="date"
                            value={draft.date || ''}
                            onChange={(e) => updateGroupDraft(group, { date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
                          <input
                            type="text"
                            value={draft.transaction_id || ''}
                            onChange={(e) => updateGroupDraft(group, { transaction_id: e.target.value || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-gray-900"
                          />
                          <p className="mt-1 text-xs text-gray-500">Optional. Leave empty to auto-generate.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <input
                            type="text"
                            value={draft.description || ''}
                            onChange={(e) => updateGroupDraft(group, { description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex gap-3 flex-wrap">
                            <span className="font-semibold text-gray-900">Current children: {draft.children.length}</span>
                            <span className="text-teal-700">Children sum: {childrenSum.toFixed(2)}</span>
                            <span className="text-teal-700">Parent amount: {Number(draft.amount || 0).toFixed(2)}</span>
                          </div>
                          <div
                            className={
                              remaining === 0
                                ? 'text-green-600 font-semibold'
                                : remaining > 0
                                ? 'text-orange-600 font-semibold'
                                : 'text-red-600 font-semibold'
                            }
                          >
                            {remaining === 0 ? 'Balanced' : remaining > 0 ? `Remaining ${remaining.toFixed(2)}` : `Over by ${Math.abs(remaining).toFixed(2)}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-md bg-white">
                      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-100 rounded-t-md">
                        <h3 className="text-sm font-semibold text-gray-900">Refund Items</h3>
                        <button
                          type="button"
                          onClick={() => addDraftChild(group)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          + Add Item
                        </button>
                      </div>

                      {draft.children.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-500">No refund items yet.</div>
                      ) : (
                        <div className="divide-y">
                          {draft.children.map((child, index) => (
                            <div key={child.transaction_id || index} className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                              <div className="sm:col-span-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={child.amount ?? 0}
                                  onChange={(e) => updateDraftChild(group, index, { amount: Number(e.target.value) })}
                                  className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                />
                              </div>
                              <div className="sm:col-span-4">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Category (Expense) *</label>
                                <select
                                  value={child.category_id || 0}
                                  onChange={(e) => updateDraftChild(group, index, { category_id: Number(e.target.value) })}
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
                                  onChange={(e) => updateDraftChild(group, index, { description: e.target.value })}
                                  className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                />
                                {child.transaction_id && (
                                  <p className="mt-1 text-[11px] text-gray-500">Child transaction: {child.transaction_id}</p>
                                )}
                              </div>
                              <div className="sm:col-span-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeDraftChild(group, index)}
                                  className="px-2 py-2 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => resetDraftForGroup(group)}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-white"
                        disabled={isSaving}
                      >
                        Reset Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveGroup(group)}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group)}
                        className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                        disabled={isSaving}
                      >
                        Delete Refund
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
