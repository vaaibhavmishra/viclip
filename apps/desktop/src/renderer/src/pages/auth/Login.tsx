import { Button } from "@renderer/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { LINKS } from "@viclip/constants";
import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LockIcon,
  MailIcon,
  ShieldAlertIcon,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Key mismatch recovery state
  const [keyMismatch, setKeyMismatch] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");
    setResetMessage("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);
    try {
      await window.api.loginUser(email, password);
    } catch (err: unknown) {
      console.error("Login error:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Invalid email or password. Please try again.";

      if (errorMessage.includes("ERR_KEY_DECRYPTION_FAILED")) {
        setKeyMismatch(true);
        setError("");
        setRecoveryError("");
        setShowWipeConfirm(false);
        setOldPassword("");
        return;
      }

      if (errorMessage.includes("invalid-credential")) {
        setError("Invalid email or password.");
      } else {
        setError(
          errorMessage || "Invalid email or password. Please try again.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverAccount = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!oldPassword) {
      setRecoveryError("Please enter your previous password.");
      return;
    }
    setIsRecovering(true);
    setRecoveryError("");
    try {
      await window.api.recoverAccount(email.trim(), password, oldPassword);
      setKeyMismatch(false);
      setOldPassword("");
    } catch (err: unknown) {
      console.error("Account recovery error:", err);
      const msg = err instanceof Error ? err.message : "Recovery failed.";
      if (msg.includes("ERR_OLD_PASSWORD_INVALID")) {
        setRecoveryError(
          "The previous password is incorrect. Please try again.",
        );
      } else {
        setRecoveryError(msg || "Failed to recover account.");
      }
    } finally {
      setIsRecovering(false);
    }
  };

  const handleResetAccountData = async (): Promise<void> => {
    setIsWiping(true);
    setRecoveryError("");
    try {
      await window.api.resetAccountData(email.trim(), password);
      setKeyMismatch(false);
      setShowWipeConfirm(false);
      setOldPassword("");
    } catch (err: unknown) {
      console.error("Account reset error:", err);
      setRecoveryError(
        err instanceof Error
          ? err.message
          : "Failed to reset account data. Please try again.",
      );
    } finally {
      setIsWiping(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (!email.trim()) {
      setError(
        "Please enter your email address in the field above to reset your password.",
      );
      return;
    }
    setError("");
    setResetMessage("");
    setIsLoading(true);
    try {
      await window.api.resetPassword(email.trim());
      setResetMessage(
        "Check your email to reset your password. Note: If your password is reset, you can unlock previous clips with your old password upon signing in, or choose to start fresh.",
      );
    } catch (err: unknown) {
      console.error("Forgot password error:", err);
      setError("Failed to send reset email. Please try again.");
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
              type={showPassword ? "text" : "password"}
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
              {showPassword ? (
                <EyeOffIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
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
        By signing in, you agree to our{" "}
        <div>
          <button
            type="button"
            className="underline cursor-pointer hover:text-primary focus:outline-none"
            onClick={() => window.api.openURL(LINKS.terms)}
          >
            Terms of Service
          </button>{" "}
          and{" "}
          <button
            type="button"
            className="underline cursor-pointer hover:text-primary focus:outline-none"
            onClick={() => window.api.openURL(LINKS.privacy)}
          >
            Privacy Policy
          </button>
        </div>
      </div>

      {/* Decryption Key Mismatch Recovery Dialog */}
      <Dialog open={keyMismatch} onOpenChange={setKeyMismatch}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <KeyRoundIcon className="h-5 w-5" />
              <DialogTitle>Encryption Key Mismatch</DialogTitle>
            </div>
            <DialogDescription>
              Your password is correct, but your clipboard history is encrypted
              with a previous password (likely after a password reset).
            </DialogDescription>
          </DialogHeader>

          {!showWipeConfirm ? (
            <form onSubmit={handleRecoverAccount} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="old-password">Previous Password</Label>
                <div className="relative">
                  <Input
                    id="old-password"
                    type={showOldPassword ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter previous password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                  >
                    {showOldPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your previous password to unlock your existing clips and
                  re-encrypt them with your new password.
                </p>
              </div>

              {recoveryError && (
                <div className="text-red-500 dark:text-red-400 text-xs text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                  {recoveryError}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={isRecovering}
                  className="w-full"
                >
                  {isRecovering
                    ? "Unlocking & Re-encrypting..."
                    : "Unlock & Recover Data"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isRecovering}
                  onClick={() => {
                    setShowWipeConfirm(true);
                    setRecoveryError("");
                  }}
                  className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Forgot Previous Password? Start Fresh
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400 text-xs">
                <ShieldAlertIcon className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">
                    Permanent Data Loss Warning
                  </p>
                  <p>
                    Without your previous password, old clips cannot be
                    decrypted. Wiping will permanently delete all existing clips
                    and registered devices from your account. Fresh encryption
                    keys will be created for future clips.
                  </p>
                </div>
              </div>

              {recoveryError && (
                <div className="text-red-500 dark:text-red-400 text-xs text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                  {recoveryError}
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowWipeConfirm(false);
                    setRecoveryError("");
                  }}
                  disabled={isWiping}
                  className="w-full sm:w-auto"
                >
                  Back to Recovery
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleResetAccountData}
                  disabled={isWiping}
                  className="w-full sm:w-auto"
                >
                  {isWiping
                    ? "Wiping & Starting Fresh..."
                    : "Confirm Wipe & Start Fresh"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
