import React, { useState } from 'react';
import { CircleDot, LogIn, UserPlus, Sparkles } from 'lucide-react';
import ScreenContainer from './ScreenContainer';
import './AuthScreen.css';

interface AuthScreenProps {
  onAuth: (username: string) => void;
  isLoading: boolean;
  error: string;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuth, isLoading, error }) => {
  const [authMode, setAuthMode] = useState('register');
  const [username, setUsername] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setLocalError('Please enter a username');
      return;
    }
    setLocalError('');
    onAuth(username);
  };

  return (
    <ScreenContainer className="auth-screen-wrapper">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 to-purple-600 rounded-3xl blur opacity-30"></div>
        <div className="relative bg-linear-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl p-6 md:p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="auth-icon">
              <CircleDot className="icon-circle" />
            </div>
            
            <h1 className="auth-title">
              Word Rush ⚡
            </h1>
            <p className="auth-subtitle">
              {authMode === 'register' 
                ? 'Create your account to start playing' 
                : 'Welcome back! Sign in to continue'}
            </p>
          </div>

          {/* Form */}
          <div className="auth-form-container">
            {/* Mode Toggle */}
            <div className="auth-toggle">
              <button
                onClick={() => {
                  setAuthMode('register');
                  setLocalError('');
                }}
                className={`toggle-btn ${authMode === 'register' ? 'toggle-btn-active' : ''}`}
              >
                <UserPlus className="icon-small" />
                Register
              </button>
              <button
                onClick={() => {
                  setAuthMode('login');
                  setLocalError('');
                }}
                className={`toggle-btn ${authMode === 'login' ? 'toggle-btn-active' : ''}`}
              >
                <LogIn className="icon-small" />
                Sign In
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-inputs">
              {/* Username Input */}
              <div className="input-group">
                <label className="input-label">
                  Username
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''));
                      setLocalError('');
                    }}
                    placeholder="Enter your username"
                    maxLength={24}
                    disabled={isLoading}
                    className="auth-input"
                  />
                  <Sparkles className="input-icon" />
                </div>
                <p className="input-help">
                  {authMode === 'register' 
                    ? 'Choose a unique username (letters and numbers only)'
                    : 'Enter your existing username'}
                </p>
              </div>

              {/* Error Message */}
              {(localError || error) && (
                <div className="error-message">
                  <span>⚠️</span>
                  <span>{localError || error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !username.trim()}
                className="submit-btn"
              >
                {isLoading ? (
                  <>
                    <div className="spinner"></div>
                    <span>Processing...</span>
                  </>
                ) : authMode === 'register' ? (
                  <>
                    <UserPlus className="icon-small" />
                    <span>Create Account & Play</span>
                  </>
                ) : (
                  <>
                    <LogIn className="icon-small" />
                    <span>Sign In & Play</span>
                  </>
                )}
              </button>
            </form>

            {/* Info Section */}
            <div className="info-section">
              <p>
                <span className="info-label">🎮 Quick Start:</span> Form words from the circle of letters. 
                Score points based on letter values. Best of 3 rounds wins!
              </p>
            </div>
          </div>

          {/* Footer decoration */}
          <div className="mt-6 h-1 bg-linear-to-r from-blue-500 via-purple-500 to-transparent rounded-full opacity-30"></div>
        </div>
      </div>
    </ScreenContainer>
  );
};

export default AuthScreen;
