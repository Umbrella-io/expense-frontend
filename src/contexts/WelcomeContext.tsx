'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface WelcomeContextType {
  showWelcome: boolean;
  dismissWelcome: () => void;
  resetWelcome: () => void;
}

const WelcomeContext = createContext<WelcomeContextType | undefined>(undefined);

export const useWelcome = () => {
  const context = useContext(WelcomeContext);
  if (context === undefined) {
    throw new Error('useWelcome must be used within a WelcomeProvider');
  }
  return context;
};

export const WelcomeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if user has seen the welcome screen before
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    if (hasSeenWelcome !== 'true') {
      setShowWelcome(true);
    }
    setIsInitialized(true);
  }, []);

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('hasSeenWelcome', 'true');
  };

  const resetWelcome = () => {
    setShowWelcome(true);
  };

  // Don't render children until we've checked localStorage
  if (!isInitialized) {
    return null;
  }

  return (
    <WelcomeContext.Provider value={{ showWelcome, dismissWelcome, resetWelcome }}>
      {children}
    </WelcomeContext.Provider>
  );
};
