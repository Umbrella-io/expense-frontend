'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, signup as apiSignup } from '@/lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is already authenticated (stored in sessionStorage)
    const token = sessionStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await apiLogin({ username, password });
      if (response.token) {
        sessionStorage.setItem('token', response.token);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const signup = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await apiSignup({ username, password });
      if (response.token) {
        sessionStorage.setItem('token', response.token);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Signup failed:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
