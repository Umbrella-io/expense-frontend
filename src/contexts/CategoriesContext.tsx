'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCategories } from '@/lib/api';
import type { Category } from '@/lib/types';

interface CategoriesContextType {
  categories: Category[];
  loading: boolean;
  refreshCategories: () => Promise<void>;
  getCategoriesByType: (type: 'expense' | 'income' | 'investment') => Category[];
  getFirstCategoryByType: (type: 'expense' | 'income' | 'investment') => Category | undefined;
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const refreshCategories = async () => {
    await fetchCategories();
  };

  const getCategoriesByType = (type: 'expense' | 'income' | 'investment') => {
    return categories.filter(cat => cat.type === type).sort((a, b) => a.id - b.id);
  };

  const getFirstCategoryByType = (type: 'expense' | 'income' | 'investment') => {
    const filtered = getCategoriesByType(type);
    return filtered.length > 0 ? filtered[0] : undefined;
  };

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        loading,
        refreshCategories,
        getCategoriesByType,
        getFirstCategoryByType
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoriesProvider');
  }
  return context;
}
