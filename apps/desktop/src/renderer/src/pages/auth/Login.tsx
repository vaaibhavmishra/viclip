import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setResetMessage('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    try {
      await window.api.loginUser(email, password);
    } catch (err: unknown) {
      console.error('Login error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Invalid email or password. Please try again.';

      if (errorMessage.includes('invalid-credential')) {
        setError('Invalid email or password.');
      } else {
        setError(errorMessage || 'Invalid email or password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (!email.trim()) {
      setError('Please enter your email address in the field above to reset your password.');
      return;
    }
    setError('');
    setResetMessage('');
    setIsLoading(true);
    try {
      await window.api.resetPassword(email.trim());
      setResetMessage(
        'Check your email to reset your password. Note: Upon resetting and logging in, your existing clips, devices, and encryption data will be securely deleted.'
      );
    } catch (err: unknown) {
      console.error('Forgot password error:', err);
      setError('Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-center">Welcome Back</h1>
      <p className="text-sm text-center text-muted-foreground mb-6">
        Sign in to your account to continue
      </p>
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        <div className="space-y-4">
          {/* Email Field */}
          <Label htmlFor="email">Email Address</Label>
          <div className="relative">
            <MailIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@example.com"
              className="pl-10"
            />
          </div>

          {/* Password Field */}
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <LockIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your secure password"
              className="pl-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Forgot password link */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isLoading}
            className="text-xs text-muted-foreground hover:text-primary transition-colors focus:outline-none"
          >
            Forgot password?
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-red-500 dark:text-red-400 text-xs text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
            {error}
          </div>
        )}

        {/* Reset message */}
        {resetMessage && (
          <div className="text-green-600 dark:text-green-400 text-xs text-center bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
            {resetMessage}
          </div>
        )}

        {/* Login button */}
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span className="text-sm">Signing in...</span>
            </div>
          ) : (
            <span className="text-sm">Sign In</span>
          )}
        </Button>
      </form>

      <div className="flex flex-col justify-center text-xs text-center mt-10 text-muted-foreground gap-1">
        By signing in, you agree to our{' '}
        <div>
          <span
            className="underline cursor-pointer hover:text-primary"
            onClick={() => window.api.openURL('https://viclip.com/terms')}
          >
            Terms of Service
          </span>{' '}
          and{' '}
          <span
            className="underline cursor-pointer hover:text-primary"
            onClick={() => window.api.openURL('https://viclip.com/privacy')}
          >
            Privacy Policy
          </span>
        </div>
      </div>
    </>
  );
};
