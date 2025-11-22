'use client';

import React from 'react';
import { 
  ChartPieIcon, 
  BanknotesIcon, 
  ArrowsRightLeftIcon, 
  DocumentTextIcon,
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <SparklesIcon className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Welcome to Expense Tracker
          </h1>
          <p className="text-xl text-gray-600">
            Take control of your finances with powerful tracking and insights
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <BanknotesIcon className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Track Everything
            </h3>
            <p className="text-gray-600">
              Record expenses, income, investments, transfers, and refunds. Categorize transactions across multiple bank accounts.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <ChartPieIcon className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Visual Insights
            </h3>
            <p className="text-gray-600">
              View spending patterns with interactive charts. Analyze your financial data by category, date range, and account.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <ArrowsRightLeftIcon className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Powerful Features
            </h3>
            <p className="text-gray-600">
              Convert transactions to refunds, update transaction types, manage categories, and perform bulk operations with ease.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <DocumentTextIcon className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Bulk Import
            </h3>
            <p className="text-gray-600">
              Import multiple transactions at once with JSON. Set default categories and bank accounts for quick data entry.
            </p>
          </div>
        </div>

        {/* Quick Start Tips */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-white mb-8">
          <h3 className="text-2xl font-bold mb-4">Getting Started</h3>
          <ul className="space-y-3">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3 mt-0.5">
                1
              </span>
              <span>Set up your bank accounts and categories</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3 mt-0.5">
                2
              </span>
              <span>Start adding transactions manually or use bulk import</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3 mt-0.5">
                3
              </span>
              <span>View insights and analytics on your dashboard</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3 mt-0.5">
                4
              </span>
              <span>Manage refunds and update transaction types as needed</span>
            </li>
          </ul>
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <button
            onClick={onGetStarted}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all"
          >
            Get Started
            <ArrowRightIcon className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
