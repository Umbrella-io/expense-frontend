"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import toast from "react-hot-toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  createBulkTransactionsWithDefaults,
  getBankAccounts,
  getCategories,
} from "@/lib/api";
import type { BankAccount, Category, BulkTransactionResponse } from "@/lib/types";
import { useEffect } from "react";

type FormValues = {
  bank_account_id: number;
  default_expense_category_id: number;
  default_income_category_id: number;
  default_investment_category_id: number;
  json_input: string;
};

export default function BulkImportPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BulkTransactionResponse | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>();

  const expenseCategories = (categories || []).filter((c) => c.type === "expense");
  const incomeCategories = (categories || []).filter((c) => c.type === "income");
  const investmentCategories = (categories || []).filter((c) => c.type === "investment");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [accounts, cats] = await Promise.all([
          getBankAccounts(false),
          getCategories(),
        ]);
        setBankAccounts(Array.isArray(accounts) ? accounts.filter(a => a.is_active !== false) : []);
        setCategories(cats);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load bank accounts and categories");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const onSubmit = async (form: FormValues) => {
    setSubmitting(true);
    setResults(null);

    try {
      // Parse JSON
      const parsedJson = JSON.parse(form.json_input);

      // Validate structure
      if (!parsedJson.transactions || !Array.isArray(parsedJson.transactions)) {
        toast.error('JSON must have a "transactions" array');
        setSubmitting(false);
        return;
      }

      // Build request
      const payload = {
        bank_account_id: Number(form.bank_account_id),
        default_expense_category_id: form.default_expense_category_id ? Number(form.default_expense_category_id) : undefined,
        default_income_category_id: form.default_income_category_id ? Number(form.default_income_category_id) : undefined,
        default_investment_category_id: form.default_investment_category_id ? Number(form.default_investment_category_id) : undefined,
        transactions: parsedJson.transactions,
      };

      const response = await createBulkTransactionsWithDefaults(payload);
      setResults(response);

      if (response.failed_count === 0) {
        toast.success(`Successfully imported ${response.success_count} transactions!`);
      } else if (response.success_count === 0) {
        toast.error(`All ${response.failed_count} transactions failed to import`);
      } else {
        toast.success(`Imported ${response.success_count} transactions, ${response.failed_count} failed`);
      }
    } catch (e: unknown) {
      console.error(e);
      if (e instanceof SyntaxError) {
        toast.error("Invalid JSON format");
      } else if (e instanceof Error) {
        toast.error(e.message || "Failed to import transactions");
      } else {
        toast.error("Failed to import transactions");
      }
    } finally {
      setSubmitting(false);
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
    <div className="max-w-6xl mx-auto px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Import Transactions</h1>
        <p className="text-gray-600">Import multiple transactions at once using JSON</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Settings</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Defaults */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Bank Account *</label>
              <select
                {...register("bank_account_id", { required: "Bank account is required", valueAsNumber: true })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.bank_account_id ? 'border-red-500' : 'border-gray-300'} text-gray-900`}
              >
                <option value="">Select bank account</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.account_number ? `(${acc.account_number})` : ''}
                  </option>
                ))}
              </select>
              {errors.bank_account_id && <p className="mt-1 text-sm text-red-600">{errors.bank_account_id.message as string}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Expense Category</label>
              <select
                {...register("default_expense_category_id", { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">None</option>
                {expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Income Category</label>
              <select
                {...register("default_income_category_id", { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">None</option>
                {incomeCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Investment Category</label>
              <select
                {...register("default_investment_category_id", { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">None</option>
                {investmentCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* JSON Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">JSON Input *</label>
            <textarea
              {...register("json_input", { required: "JSON input is required" })}
              rows={15}
              placeholder={`{\n  "transactions": [\n    {\n      "amount": 120.5,\n      "type": "expense",\n      "description": "Groceries",\n      "date": "2025-01-15"\n    },\n    {\n      "amount": 2500,\n      "type": "income",\n      "description": "Salary"\n    }\n  ]\n}`}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${errors.json_input ? 'border-red-500' : 'border-gray-300'} text-gray-900`}
            />
            {errors.json_input && <p className="mt-1 text-sm text-red-600">{errors.json_input.message as string}</p>}
            <p className="mt-2 text-sm text-gray-500">
              Paste your JSON with a &quot;transactions&quot; array. Each transaction needs: amount, type (expense/income/investment), and optional description, date, transaction_id, category_id, bank_account_id.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <LoadingSpinner />
                <span>Importing...</span>
              </>
            ) : (
              "Import Transactions"
            )}
          </button>
        </form>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Results</h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-2xl font-bold text-gray-900">{results.total_count}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600">Success</div>
              <div className="text-2xl font-bold text-green-700">{results.success_count}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-red-600">Failed</div>
              <div className="text-2xl font-bold text-red-700">{results.failed_count}</div>
            </div>
          </div>

          {results.failed_count > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-red-700 mb-3">Failed Transactions</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.failed.map((fail, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Index {fail.index}: {fail.transaction.description || 'No description'}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Amount: ${fail.transaction.amount} | Type: {fail.transaction.type}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-red-700 font-medium">
                      Error: {fail.error}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.success_count > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-green-700 mb-3">
                Successfully Imported ({results.success_count})
              </h3>
              <div className="text-sm text-gray-600">
                View imported transactions on the <Link href="/" className="text-blue-600 hover:underline">dashboard</Link>.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
