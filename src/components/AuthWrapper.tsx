'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWelcome } from '@/contexts/WelcomeContext';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';
import Navigation from './Navigation';
import WelcomeScreen from './WelcomeScreen';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { showWelcome, dismissWelcome } = useWelcome();
  const [isLogin, setIsLogin] = useState(true);

  if (!isAuthenticated) {
    return isLogin ? (
      <LoginPage onSwitchToSignup={() => setIsLogin(false)} />
    ) : (
      <SignupPage onSwitchToLogin={() => setIsLogin(true)} />
    );
  }

  if (showWelcome) {
    return <WelcomeScreen onGetStarted={dismissWelcome} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export default AuthWrapper;
