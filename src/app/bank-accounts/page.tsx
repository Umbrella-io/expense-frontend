"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "@/lib/api";
import type { BankAccount } from "@/lib/types";

type FormValues = {
  name: string;
  account_number?: string;
  bank_name: string;
  account_type: BankAccount["account_type"];
  balance?: number;
  is_active?: boolean;
};

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await getBankAccounts(true);
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load bank accounts");
      setAccounts([]); // Ensure accounts is always an array even on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const onSubmit = async (form: FormValues) => {
    setSubmitting(true);
    try {
      if (editing) {
        const payload = {
          name: form.name,
          account_number: form.account_number || undefined,
          bank_name: form.bank_name,
          account_type: form.account_type,
          balance: form.balance !== undefined && form.balance !== null ? Number(form.balance) : undefined,
          is_active: form.is_active ?? true,
        };
        await updateBankAccount(editing.id, payload);
        toast.success("Bank account updated");
      } else {
        const payload: Omit<BankAccount, 'id' | 'created_at' | 'updated_at'> = {
          name: form.name,
          account_number: form.account_number || undefined,
          bank_name: form.bank_name,
          account_type: form.account_type,
          balance: form.balance !== undefined && form.balance !== null ? Number(form.balance) : 0,
          is_active: form.is_active ?? true,
        };
        await createBankAccount(payload);
        toast.success("Bank account created");
      }
      setEditing(null);
      reset({ name: "", account_number: "", bank_name: "", account_type: "checking", balance: undefined, is_active: true });
      await loadAccounts();
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit bank account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (acc: BankAccount) => {
    setEditing(acc);
    reset({
      name: acc.name,
      account_number: acc.account_number || "",
      bank_name: acc.bank_name,
      account_type: acc.account_type,
      balance: acc.balance,
      is_active: acc.is_active ?? true,
    });
  };

  const handleDelete = async (acc: BankAccount) => {
    if (!confirm(`Delete bank account "${acc.name}"?`)) return;
    try {
      await deleteBankAccount(acc.id);
      toast.success("Bank account deleted");
      await loadAccounts();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete bank account");
    }
  };

  // const activeAccounts = useMemo(() => accounts.filter(a => a.is_active !== false), [accounts]);

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bank Accounts</h1>
        <p className="text-gray-600">Create and manage your bank accounts</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{editing ? "Edit Bank Account" : "Add Bank Account"}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              {...register("name", { required: "Name is required" })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'} text-gray-900`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message as string}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name *</label>
            <input
              type="text"
              {...register("bank_name", { required: "Bank name is required" })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.bank_name ? 'border-red-500' : 'border-gray-300'} text-gray-900`}
            />
            {errors.bank_name && <p className="mt-1 text-sm text-red-600">{errors.bank_name.message as string}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
            <input
              type="text"
              {...register("account_number")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type *</label>
            <select
              {...register("account_type", { required: "Account type is required" })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.account_type ? 'border-red-500' : 'border-gray-300'} text-gray-900`}
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit</option>
              <option value="investment">Investment</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Balance</label>
            <input
              type="number"
              step="0.01"
              {...register("balance")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...register("is_active")} defaultChecked />
            <label className="text-sm text-gray-700">Active</label>
          </div>
          <div className="sm:col-span-2 flex gap-3 pt-2">
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(null); reset({ name: "", account_number: "", bank_name: "", account_type: "checking", balance: undefined, is_active: true }); }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel Edit
              </button>
            )}
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {submitting ? <LoadingSpinner /> : editing ? "Update Account" : "Add Account"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Existing Accounts</h2>
        </div>
        {accounts.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No bank accounts yet.</div>
        ) : (
          <div className="space-y-3">
            {accounts.map(acc => (
              <div key={acc.id} className={`border rounded-lg p-4 ${acc.is_active !== false ? 'bg-gray-50' : 'bg-white'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{acc.name} <span className="text-gray-600 font-normal">{acc.account_number ? `(${acc.account_number})` : ''}</span></div>
                    <div className="text-sm text-gray-600 flex gap-3 flex-wrap">
                      <span>{acc.bank_name}</span>
                      <span className="capitalize">{acc.account_type}</span>
                      {typeof acc.balance === 'number' && (
                        <span className="font-mono">Balance: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(acc.balance)}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs ${acc.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                        {acc.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(acc)} className="px-3 py-1 text-sm border rounded hover:bg-white">Edit</button>
                    <button onClick={() => handleDelete(acc)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
