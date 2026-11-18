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
import { useEffect, useRef, useState } from "react";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Key mismatch recovery state
  const [keyMismatch, setKeyMismatch] = useState(false);
  const [missingEncryptionSetup, setMissingEncryptionSetup] = useState(false);
  const [recoveryCredentials, setRecoveryCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy.current) return;
    setError("");
    setResetMessage("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Email is required");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    busy.current = true;
    setIsLoading(true);
    try {
      await window.api.loginUser(cleanEmail, password);
    } catch (err: unknown) {
      if (!mounted.current) return;
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Invalid email or password. Please try again.";

      const missingSetup = errorMessage.includes(
        "ERR_ENCRYPTION_METADATA_MISSING",
      );
      if (errorMessage.includes("ERR_KEY_DECRYPTION_FAILED") || missingSetup) {
        setRecoveryCredentials({ email: cleanEmail, password });
        setMissingEncryptionSetup(missingSetup);
        setKeyMismatch(true);
        setError("");
        setRecoveryError("");
        setShowWipeConfirm(missingSetup);
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
      busy.current = false;
      if (mounted.current) setIsLoading(false);
    }
  };

  const handleRecoverAccount = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy.current || !recoveryCredentials) return;
    if (!oldPassword) {
      setRecoveryError("Please enter your previous password.");
      return;
    }
    busy.current = true;
    setIsRecovering(true);
    setRecoveryError("");
    try {
      await window.api.recoverAccount(
        recoveryCredentials.email,
        recoveryCredentials.password,
        oldPassword,
      );
      if (!mounted.current) return;
      setKeyMismatch(false);
      setRecoveryCredentials(null);
      setOldPassword("");
    } catch (err: unknown) {
      if (!mounted.current) return;
      const msg = err instanceof Error ? err.message : "Recovery failed.";
      if (msg.includes("ERR_OLD_PASSWORD_INVALID")) {
        setRecoveryError(
          "The previous password is incorrect. Please try again.",
        );
      } else {
        setRecoveryError(msg || "Failed to recover account.");
      }
    } finally {
      busy.current = false;
      if (mounted.current) setIsRecovering(false);
    }
  };

  const handleResetAccountData = async (): Promise<void> => {
    if (busy.current || !recoveryCredentials) return;
    busy.current = true;
    setIsWiping(true);
    setRecoveryError("");
    try {
      await window.api.resetAccountData(
        recoveryCredentials.email,
        recoveryCredentials.password,
      );
      if (!mounted.current) return;
      setKeyMismatch(false);
      setRecoveryCredentials(null);
      setShowWipeConfirm(false);
      setOldPassword("");
    } catch (err: unknown) {
      if (!mounted.current) return;
      setRecoveryError(
        err instanceof Error
          ? err.message
          : "Failed to reset account data. Please try again.",
      );
    } finally {
      busy.current = false;
      if (mounted.current) setIsWiping(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (busy.current) return;
    if (!email.trim()) {
      setError(
        "Please enter your email address in the field above to reset your password.",
      );
      return;
    }
    setError("");
    setResetMessage("");
    busy.current = true;
    setIsLoading(true);
    try {
      await window.api.resetPassword(email.trim());
      if (!mounted.current) return;
      setResetMessage(
        "Check your email to reset your password. Note: If your password is reset, you can unlock previous clips with your old password upon signing in, or choose to start fresh.",
      );
    } catch {
      if (!mounted.current) return;
      setError("Failed to send reset email. Please try again.");
    } finally {
      busy.current = false;
      if (mounted.current) setIsLoading(false);
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
      <Dialog
        open={keyMismatch}
        onOpenChange={(open) => {
          setKeyMismatch(open);
          if (!open) {
            setRecoveryCredentials(null);
            setOldPassword("");
          }
        }}
      >
        <DialogContent
          className={
            missingEncryptionSetup
              ? "max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-xl border-border border-t-border bg-white p-0 shadow-xl backdrop-blur-none sm:max-w-md dark:bg-neutral-900"
              : "sm:max-w-md"
          }
        >
          {missingEncryptionSetup ? (
            <DialogHeader className="gap-2 px-6 pt-6 text-left">
              <DialogTitle className="pr-6 text-xl leading-7 tracking-tight">
                Encryption setup missing
              </DialogTitle>
              <p className="break-all text-sm text-muted-foreground">
                {recoveryCredentials?.email}
              </p>
              <DialogDescription className="mt-2 leading-6">
                Your account’s encryption settings are missing, so ViClip can’t
                unlock your clipboard history.
              </DialogDescription>
            </DialogHeader>
          ) : (
            <DialogHeader>
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <KeyRoundIcon className="h-5 w-5" />
                <DialogTitle>Encryption Key Mismatch</DialogTitle>
              </div>
              <DialogDescription>
                {`Your password for ${recoveryCredentials?.email} is correct, but your clipboard history is encrypted with a previous password (likely after a password reset).`}
              </DialogDescription>
            </DialogHeader>
          )}

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
            <div className={missingEncryptionSetup ? "" : "space-y-4 py-2"}>
              {missingEncryptionSetup ? (
                <div className="space-y-2 px-6 py-5 text-sm leading-6">
                  <p className="font-medium">
                    Starting fresh will permanently delete all saved clips and
                    remove your registered devices.
                  </p>
                  <p className="text-muted-foreground">
                    ViClip will create new encryption settings for future clips.
                  </p>
                  <p className="text-destructive">This can’t be undone.</p>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400 text-xs">
                  <ShieldAlertIcon className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">
                      Permanent Data Loss Warning
                    </p>
                    <p>
                      Without your previous password, old clips cannot be
                      decrypted. Wiping will permanently delete all existing
                      clips and registered devices from your account. Fresh
                      encryption keys will be created for future clips.
                    </p>
                  </div>
                </div>
              )}

              {recoveryError && (
                <div
                  role="alert"
                  className={
                    missingEncryptionSetup
                      ? "px-6 pb-5 text-sm leading-6 text-destructive"
                      : "text-red-500 dark:text-red-400 text-xs text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2"
                  }
                >
                  {recoveryError}
                </div>
              )}

              <DialogFooter
                className={
                  missingEncryptionSetup
                    ? "gap-2 border-t px-6 py-4"
                    : "flex-col sm:flex-row gap-2 pt-2"
                }
              >
                <Button
                  type="button"
                  variant={missingEncryptionSetup ? "ghost" : "outline"}
                  onClick={() => {
                    if (missingEncryptionSetup) {
                      setKeyMismatch(false);
                      setRecoveryCredentials(null);
                    } else {
                      setShowWipeConfirm(false);
                    }
                    setRecoveryError("");
                  }}
                  disabled={isWiping}
                  className="w-full sm:w-auto"
                >
                  {missingEncryptionSetup ? "Cancel" : "Back to Recovery"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleResetAccountData}
                  disabled={isWiping}
                  className="w-full sm:w-auto"
                >
                  {missingEncryptionSetup
                    ? isWiping
                      ? "Starting fresh..."
                      : "Delete data & start fresh"
                    : isWiping
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
