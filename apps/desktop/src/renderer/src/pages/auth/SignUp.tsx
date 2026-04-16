import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { EyeIcon, EyeOffIcon, InfoIcon, LockIcon, MailIcon, UserIcon } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

const validatePasswordStrength = (password: string): string | null => {
  if (password.length < 12) {
    return 'Password must be at least 12 characters long';
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const criteriaMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(
    Boolean
  ).length;

  if (criteriaMet < 4) {
    return 'Password must contain an uppercase letter, a lowercase letter, a number, and a special character';
  }

  return null;
};

export const SignUp: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // Call your signup API here
      await window.api.signUpUser(email, username, password);
      // Handle successful signup
      // Main process will handle window switch
    } catch (err: unknown) {
      console.error('Signup error:', err);
      const error = err as { message?: string };
      if (error?.message?.includes('already-in-use')) {
        setError('This email is already associated with an account.');
      } else {
        setError(error?.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-center">Create Account</h1>
      <p className="text-sm text-center text-muted-foreground mb-6">
        Sign up for a new account to continue
      </p>
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        <div className="space-y-4">
          {/* Email Field */}
          <div className="space-y-2">
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
                required
              />
            </div>
          </div>

          {/* Username Field */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                maxLength={30}
                minLength={3}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative group">
                <InfoIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-1/2 -translate-x-1/3 bottom-full mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-10 shadow-lg">
                  <div className="text-left space-y-1">
                    <p className="font-medium">Password requirements:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>At least 12 characters long</li>
                      <li>Must contain 3 of the following:</li>
                      <ul className="list-none ml-3 space-y-0.5">
                        <li>• Uppercase letter (A-Z)</li>
                        <li>• Lowercase letter (a-z)</li>
                        <li>• Number (0-9)</li>
                        <li>• Special character (!@#$%...)</li>
                      </ul>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <LockIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password (12+ characters)"
                minLength={12}
                className="pl-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="pl-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Signup button */}
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span className="text-sm">Creating account...</span>
            </div>
          ) : (
            <span className="text-sm">Create Account</span>
          )}
        </Button>

        {/* Error message */}
        {error && (
          <div className="text-red-500 dark:text-red-400 text-xs text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
            {error}
          </div>
        )}
      </form>
      <div className="flex flex-col justify-center text-xs text-center mt-6 text-muted-foreground gap-1">
        By creating an account, you agree to our{' '}
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
