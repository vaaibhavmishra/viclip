import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { colors } from "@/constants/theme";
import {
  loginUser,
  recoverAccountWithOldPassword,
  resetAccountData,
  resetPassword,
  signupUser,
} from "../services/auth";

export default function Login() {
  const router = useRouter();
  const pendingOperation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Key mismatch recovery state
  const [keyMismatch, setKeyMismatch] = useState(false);
  const [missingEncryptionSetup, setMissingEncryptionSetup] = useState(false);
  const [recoveryCredentials, setRecoveryCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // Prevent back navigation loop on Android when logged out
  useEffect(() => {
    const onBackPress = () => {
      if (keyMismatch) {
        if (!isRecovering && !isWiping) {
          setKeyMismatch(false);
          setMissingEncryptionSetup(false);
          setRecoveryCredentials(null);
          setOldPassword("");
          setShowOldPassword(false);
          setShowWipeConfirm(false);
          setRecoveryError(null);
        }
        return true;
      }
      BackHandler.exitApp();
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [keyMismatch, isRecovering, isWiping]);

  const handleRecoverAccount = async () => {
    if (pendingOperation.current || !recoveryCredentials) return;
    if (!oldPassword) {
      setRecoveryError("Please enter your previous password.");
      return;
    }
    pendingOperation.current = true;
    setIsRecovering(true);
    setRecoveryError(null);
    try {
      await recoverAccountWithOldPassword(
        recoveryCredentials.email,
        recoveryCredentials.password,
        oldPassword,
      );
      if (!mounted.current) return;
      setKeyMismatch(false);
      setMissingEncryptionSetup(false);
      setRecoveryCredentials(null);
      setOldPassword("");
      if (mounted.current) router.replace("/");
    } catch (err: unknown) {
      if (!mounted.current) return;
      const msg = err instanceof Error ? err.message : "Recovery failed.";
      if (msg.includes("ERR_OLD_PASSWORD_INVALID")) {
        setRecoveryError("The previous password entered is incorrect.");
      } else {
        setRecoveryError(msg);
      }
    } finally {
      pendingOperation.current = false;
      if (mounted.current) setIsRecovering(false);
    }
  };

  const handleResetAccountData = async () => {
    if (pendingOperation.current || !recoveryCredentials) return;
    pendingOperation.current = true;
    setIsWiping(true);
    setRecoveryError(null);
    try {
      await resetAccountData(
        recoveryCredentials.email,
        recoveryCredentials.password,
      );
      if (!mounted.current) return;
      setKeyMismatch(false);
      setMissingEncryptionSetup(false);
      setRecoveryCredentials(null);
      setShowWipeConfirm(false);
      setOldPassword("");
      if (mounted.current) router.replace("/");
    } catch (err: unknown) {
      if (!mounted.current) return;
      setRecoveryError(
        err instanceof Error ? err.message : "Failed to reset account data.",
      );
    } finally {
      pendingOperation.current = false;
      if (mounted.current) setIsWiping(false);
    }
  };

  const handleAuth = async () => {
    if (pendingOperation.current) return;
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Email and password are required");
      return;
    }
    if (!isLogin) {
      if (!username.trim()) {
        setError("Username is required for signup");
        return;
      }

      if (username.trim().length < 3) {
        setError("Username must be at least 3 characters long");
        return;
      }

      if (password.length < 12) {
        setError("Password must be at least 12 characters long");
        return;
      }

      let typesCount = 0;
      if (/[A-Z]/.test(password)) typesCount++;
      if (/[a-z]/.test(password)) typesCount++;
      if (/[0-9]/.test(password)) typesCount++;
      if (/[^A-Za-z0-9]/.test(password)) typesCount++;

      if (typesCount < 4) {
        setError(
          "Password must contain an uppercase letter, a lowercase letter, a number, and a special character",
        );
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    pendingOperation.current = true;
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await loginUser(cleanEmail, password);
      } else {
        await signupUser(cleanEmail, username.trim(), password);
        if (!mounted.current) return;
        Toast.show({
          type: "success",
          text1: "Account Created",
          text2: "Welcome to ViClip!",
        });
      }
      if (mounted.current) router.replace("/");
    } catch (err: unknown) {
      if (!mounted.current) return;
      if (err instanceof Error) {
        const missingSetup =
          err.message.includes("ERR_KEY_METADATA_MISSING") ||
          err.message.includes("ERR_ENCRYPTION_METADATA_MISSING");
        if (err.message.includes("ERR_KEY_DECRYPTION_FAILED") || missingSetup) {
          setRecoveryCredentials({ email: cleanEmail, password });
          setMissingEncryptionSetup(missingSetup);
          setKeyMismatch(true);
          setRecoveryError(null);
          setShowWipeConfirm(missingSetup);
          setOldPassword("");
          setShowOldPassword(false);
          setError(null);
          return;
        }
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      pendingOperation.current = false;
      if (mounted.current) setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (pendingOperation.current) return;
    if (!email.trim()) {
      setError("Please enter your email address first");
      return;
    }

    pendingOperation.current = true;
    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(email.trim());
      if (!mounted.current) return;
      Toast.show({
        type: "success",
        text1: "Check Your Email",
        text2: "We have sent a password reset link to your email address.",
      });
    } catch (err: unknown) {
      if (!mounted.current) return;
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while resetting password");
      }
    } finally {
      pendingOperation.current = false;
      if (mounted.current) setIsLoading(false);
    }
  };

  const closeRecoveryDialog = () => {
    setKeyMismatch(false);
    setMissingEncryptionSetup(false);
    setRecoveryCredentials(null);
    setOldPassword("");
    setShowOldPassword(false);
    setShowWipeConfirm(false);
    setRecoveryError(null);
  };

  const getInputContainerStyle = (inputName: string) => {
    const isFocused = focusedInput === inputName;
    if (isFocused) {
      return isDark
        ? styles.inputContainerFocusedDark
        : styles.inputContainerFocusedLight;
    }
    return isDark
      ? styles.inputContainerNormalDark
      : styles.inputContainerNormalLight;
  };

  const getIconColor = (inputName: string) => {
    return focusedInput === inputName ? colors.primaryLight : "#6b7280";
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        isDark ? styles.safeAreaDark : styles.safeAreaLight,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback
            onPress={Keyboard.dismiss}
            accessible={false}
          >
            <View>
              {/* Main Card Container */}
              <Animated.View
                entering={FadeInDown.duration(500)}
                layout={LinearTransition.duration(200)}
                style={[
                  styles.card,
                  isDark ? styles.cardDark : styles.cardLight,
                ]}
              >
                <View style={styles.header}>
                  <View
                    style={[
                      styles.logoBox,
                      isDark ? styles.logoBoxDark : styles.logoBoxLight,
                    ]}
                  >
                    <Image
                      source={require("../assets/images/viclip-icon-small.png")}
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  </View>
                  <Text
                    style={[
                      styles.title,
                      { color: isDark ? colors.text.dark : colors.text.light },
                    ]}
                  >
                    Welcome to ViClip
                  </Text>
                  <Text
                    style={[
                      styles.subtitle,
                      {
                        color: isDark
                          ? colors.text.mutedDark
                          : colors.text.mutedLight,
                      },
                    ]}
                  >
                    Sync your clipboard seamlessly across all your devices
                  </Text>
                </View>

                <View style={styles.form}>
                  {/* Username for Signup */}
                  {!isLogin && (
                    <Animated.View
                      entering={FadeInUp.duration(300)}
                      exiting={FadeOutUp.duration(200)}
                      layout={LinearTransition.duration(200)}
                      style={styles.inputGroup}
                    >
                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            color: isDark
                              ? colors.text.subDark
                              : colors.text.subLight,
                          },
                        ]}
                      >
                        Username
                      </Text>
                      <Animated.View
                        style={[
                          styles.inputContainer,
                          getInputContainerStyle("username"),
                        ]}
                      >
                        <Feather
                          name="user"
                          size={20}
                          color={getIconColor("username")}
                        />
                        <TextInput
                          style={[
                            styles.textInput,
                            {
                              color: isDark
                                ? colors.text.dark
                                : colors.text.light,
                            },
                          ]}
                          placeholder="Choose a username"
                          placeholderTextColor="#9ca3af"
                          value={username}
                          onChangeText={setUsername}
                          autoCapitalize="none"
                          editable={!isLoading}
                          onFocus={() => setFocusedInput("username")}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </Animated.View>
                    </Animated.View>
                  )}

                  {/* Email */}
                  <Animated.View
                    layout={LinearTransition.duration(200)}
                    style={styles.inputGroup}
                  >
                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: isDark
                            ? colors.text.subDark
                            : colors.text.subLight,
                        },
                      ]}
                    >
                      Email Address
                    </Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        getInputContainerStyle("email"),
                      ]}
                    >
                      <Feather
                        name="mail"
                        size={20}
                        color={getIconColor("email")}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            color: isDark
                              ? colors.text.dark
                              : colors.text.light,
                          },
                        ]}
                        placeholder="you@example.com"
                        placeholderTextColor="#9ca3af"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                        onFocus={() => setFocusedInput("email")}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </Animated.View>
                  </Animated.View>

                  {/* Password */}
                  <Animated.View
                    layout={LinearTransition.duration(200)}
                    style={styles.inputGroup}
                  >
                    <View style={styles.passwordHeaderRow}>
                      <View style={styles.passwordLabelRow}>
                        <Text
                          style={[
                            styles.inputLabel,
                            {
                              color: isDark
                                ? colors.text.subDark
                                : colors.text.subLight,
                              marginLeft: 0,
                            },
                          ]}
                        >
                          Password
                        </Text>
                        {!isLogin && (
                          <TouchableOpacity
                            onPress={() => {
                              setShowPasswordRequirements(
                                !showPasswordRequirements,
                              );
                            }}
                            style={styles.infoIconBtn}
                          >
                            <Feather name="info" size={16} color="#6b7280" />
                          </TouchableOpacity>
                        )}
                      </View>
                      {isLogin && (
                        <TouchableOpacity
                          onPress={handleForgotPassword}
                          disabled={isLoading}
                        >
                          <Text
                            style={[
                              styles.forgotPasswordText,
                              {
                                color: isDark
                                  ? colors.primaryLight
                                  : colors.primary,
                              },
                            ]}
                          >
                            Forgot Password?
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Animated.View
                      style={[
                        styles.inputContainer,
                        getInputContainerStyle("password"),
                      ]}
                    >
                      <Feather
                        name="lock"
                        size={20}
                        color={getIconColor("password")}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            color: isDark
                              ? colors.text.dark
                              : colors.text.light,
                          },
                        ]}
                        placeholder="Enter your password"
                        placeholderTextColor="#9ca3af"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        editable={!isLoading}
                        onFocus={() => setFocusedInput("password")}
                        onBlur={() => setFocusedInput(null)}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          setShowPassword(!showPassword);
                        }}
                        style={styles.eyeIconBtn}
                      >
                        <Feather
                          name={showPassword ? "eye" : "eye-off"}
                          size={20}
                          color={getIconColor("password")}
                        />
                      </TouchableOpacity>
                    </Animated.View>

                    {!isLogin && showPasswordRequirements && (
                      <Animated.View
                        entering={FadeInUp.duration(300)}
                        exiting={FadeOutUp.duration(200)}
                        layout={LinearTransition.duration(200)}
                        style={[
                          styles.passwordReqBox,
                          isDark
                            ? styles.passwordReqBoxDark
                            : styles.passwordReqBoxLight,
                        ]}
                      >
                        <Text
                          style={[
                            styles.passwordReqTitle,
                            {
                              color: isDark
                                ? colors.text.subDark
                                : colors.text.subLight,
                            },
                          ]}
                        >
                          Password requirements:
                        </Text>
                        <Text
                          style={[
                            styles.passwordReqText,
                            {
                              color: isDark
                                ? colors.text.mutedDark
                                : colors.text.mutedLight,
                            },
                          ]}
                        >
                          • At least 12 characters long{"\n"}• Must contain all
                          of the following:{"\n"}
                          {"  "}• Uppercase letter (A-Z){"\n"}
                          {"  "}• Lowercase letter (a-z){"\n"}
                          {"  "}• Number (0-9){"\n"}
                          {"  "}• Special character (!@#$%...)
                        </Text>
                      </Animated.View>
                    )}
                  </Animated.View>

                  {/* Confirm Password */}
                  {!isLogin && (
                    <Animated.View
                      entering={FadeInUp.duration(300)}
                      exiting={FadeOutUp.duration(200)}
                      layout={LinearTransition.duration(200)}
                      style={styles.inputGroup}
                    >
                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            color: isDark
                              ? colors.text.subDark
                              : colors.text.subLight,
                          },
                        ]}
                      >
                        Confirm Password
                      </Text>
                      <Animated.View
                        style={[
                          styles.inputContainer,
                          getInputContainerStyle("confirmPassword"),
                        ]}
                      >
                        <Feather
                          name="lock"
                          size={20}
                          color={getIconColor("confirmPassword")}
                        />
                        <TextInput
                          style={[
                            styles.textInput,
                            {
                              color: isDark
                                ? colors.text.dark
                                : colors.text.light,
                            },
                          ]}
                          placeholder="Confirm your password"
                          placeholderTextColor="#9ca3af"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry={!showConfirmPassword}
                          editable={!isLoading}
                          onFocus={() => setFocusedInput("confirmPassword")}
                          onBlur={() => setFocusedInput(null)}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            setShowConfirmPassword(!showConfirmPassword);
                          }}
                          style={styles.eyeIconBtn}
                        >
                          <Feather
                            name={showConfirmPassword ? "eye" : "eye-off"}
                            size={20}
                            color={getIconColor("confirmPassword")}
                          />
                        </TouchableOpacity>
                      </Animated.View>
                    </Animated.View>
                  )}

                  {/* Error Message */}
                  {error && (
                    <Animated.View
                      entering={FadeInUp.duration(300)}
                      exiting={FadeOutUp.duration(200)}
                      layout={LinearTransition.duration(200)}
                      style={[
                        styles.errorBox,
                        isDark ? styles.errorBoxDark : styles.errorBoxLight,
                      ]}
                    >
                      <Feather
                        name="alert-circle"
                        size={18}
                        color={colors.danger}
                      />
                      <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                  )}

                  {/* Submit Button */}
                  <Animated.View layout={LinearTransition.duration(200)}>
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        isLoading && styles.submitButtonDisabled,
                      ]}
                      onPress={handleAuth}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>
                          {isLogin ? "Sign In" : "Create Account"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Toggle Mode */}
                  <Animated.View
                    layout={LinearTransition.duration(200)}
                    style={styles.toggleRow}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        {
                          color: isDark
                            ? colors.text.mutedDark
                            : colors.text.mutedLight,
                        },
                      ]}
                    >
                      {isLogin
                        ? "Don't have an account?"
                        : "Already have an account?"}
                    </Text>
                    <TouchableOpacity
                      style={{ marginLeft: 8 }}
                      onPress={() => {
                        setIsLogin(!isLogin);
                        setError(null);
                        setPassword("");
                        setConfirmPassword("");
                      }}
                      disabled={isLoading}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          {
                            color: isDark
                              ? colors.primaryLight
                              : colors.primary,
                          },
                        ]}
                      >
                        {isLogin ? "Sign up" : "Log in"}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </Animated.View>

              {/* Footer text Outside the Card */}
              <Animated.View
                entering={FadeInDown.duration(600).delay(150)}
                style={styles.footerBox}
              >
                <Text
                  style={[
                    styles.footerText,
                    { color: isDark ? "#71717a" : "#9ca3af" },
                  ]}
                >
                  By continuing, you agree to ViClip's{"\n"}
                  <Text
                    style={[
                      styles.footerLink,
                      { color: isDark ? colors.text.mutedDark : "#4b5563" },
                    ]}
                  >
                    Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text
                    style={[
                      styles.footerLink,
                      { color: isDark ? colors.text.mutedDark : "#4b5563" },
                    ]}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Encryption Key Mismatch & Recovery Modal */}
      <Modal
        visible={keyMismatch}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isRecovering && !isWiping) {
            closeRecoveryDialog();
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalContentWrapper}
          >
            <View
              accessibilityViewIsModal
              importantForAccessibility="yes"
              style={[
                styles.recoveryCard,
                isDark ? styles.recoveryCardDark : styles.recoveryCardLight,
              ]}
            >
              <ScrollView
                style={styles.recoveryScroll}
                contentContainerStyle={styles.recoveryScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View
                  style={[
                    styles.recoveryHeader,
                    missingEncryptionSetup && styles.missingSetupHeader,
                  ]}
                >
                  {!missingEncryptionSetup && (
                    <View
                      style={[
                        styles.recoveryIconBox,
                        showWipeConfirm
                          ? styles.recoveryIconBoxDanger
                          : styles.recoveryIconBoxPrimary,
                      ]}
                    >
                      <Feather
                        name={showWipeConfirm ? "alert-triangle" : "key"}
                        size={24}
                        color={showWipeConfirm ? colors.danger : colors.primary}
                      />
                    </View>
                  )}
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.recoveryTitle,
                      { color: isDark ? colors.text.dark : colors.text.light },
                      missingEncryptionSetup && styles.missingSetupTitle,
                    ]}
                  >
                    {missingEncryptionSetup
                      ? "Encryption setup missing"
                      : showWipeConfirm
                        ? "Wipe & Reset All Data?"
                        : "Encryption Key Recovery"}
                  </Text>
                  {missingEncryptionSetup && (
                    <Text
                      style={[
                        styles.missingSetupEmail,
                        {
                          color: isDark
                            ? colors.text.mutedDark
                            : colors.text.mutedLight,
                        },
                      ]}
                    >
                      {recoveryCredentials?.email}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.recoverySubtitle,
                      {
                        color: isDark
                          ? colors.text.mutedDark
                          : colors.text.mutedLight,
                      },
                      missingEncryptionSetup && styles.missingSetupSubtitle,
                    ]}
                  >
                    {missingEncryptionSetup
                      ? "Your account’s encryption settings are missing, so ViClip can’t unlock your clipboard history."
                      : showWipeConfirm
                        ? "This action cannot be undone. All your existing encrypted clips and device pairings will be permanently deleted from the cloud."
                        : "Your password was recently changed. To decrypt and recover your existing clips, please enter your previous password."}
                  </Text>
                </View>

                {missingEncryptionSetup && (
                  <View style={styles.missingSetupBody}>
                    <Text
                      style={[
                        styles.missingSetupBodyStrong,
                        {
                          color: isDark ? colors.text.dark : colors.text.light,
                        },
                      ]}
                    >
                      Starting fresh will permanently delete all saved clips and
                      remove your registered devices.
                    </Text>
                    <Text
                      style={[
                        styles.missingSetupBodyText,
                        {
                          color: isDark
                            ? colors.text.mutedDark
                            : colors.text.mutedLight,
                        },
                      ]}
                    >
                      ViClip will create new encryption settings for future
                      clips.
                    </Text>
                    <Text style={styles.missingSetupWarning}>
                      This can’t be undone.
                    </Text>
                  </View>
                )}

                {recoveryError && (
                  <View
                    accessibilityLiveRegion="assertive"
                    accessibilityRole="alert"
                    style={[
                      styles.errorBox,
                      isDark ? styles.errorBoxDark : styles.errorBoxLight,
                      { marginBottom: 16 },
                    ]}
                  >
                    <Feather
                      name="alert-circle"
                      size={18}
                      color={colors.danger}
                    />
                    <Text style={styles.errorText}>{recoveryError}</Text>
                  </View>
                )}

                {missingEncryptionSetup ? (
                  <TouchableOpacity
                    style={[
                      styles.dangerButton,
                      isWiping && styles.submitButtonDisabled,
                    ]}
                    onPress={handleResetAccountData}
                    disabled={isWiping}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityHint="Permanently deletes saved clips and registered devices, then creates new encryption settings."
                  >
                    {isWiping ? (
                      <>
                        <ActivityIndicator color="#ffffff" size="small" />
                        <Text
                          style={[
                            styles.submitButtonText,
                            styles.buttonLoadingText,
                          ]}
                        >
                          Starting fresh...
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.submitButtonText}>
                        Delete data & start fresh
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : !showWipeConfirm ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            color: isDark
                              ? colors.text.subDark
                              : colors.text.subLight,
                          },
                        ]}
                      >
                        Previous Password
                      </Text>
                      <View
                        style={[
                          styles.inputContainer,
                          isDark
                            ? styles.inputContainerNormalDark
                            : styles.inputContainerNormalLight,
                        ]}
                      >
                        <Feather name="lock" size={20} color="#6b7280" />
                        <TextInput
                          style={[
                            styles.textInput,
                            {
                              color: isDark
                                ? colors.text.dark
                                : colors.text.light,
                            },
                          ]}
                          placeholder="Enter previous password"
                          placeholderTextColor="#9ca3af"
                          value={oldPassword}
                          onChangeText={setOldPassword}
                          secureTextEntry={!showOldPassword}
                          autoCapitalize="none"
                          editable={!isRecovering}
                        />
                        <TouchableOpacity
                          onPress={() => setShowOldPassword(!showOldPassword)}
                          style={styles.eyeIconBtn}
                        >
                          <Feather
                            name={showOldPassword ? "eye" : "eye-off"}
                            size={20}
                            color="#6b7280"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        isRecovering && styles.submitButtonDisabled,
                      ]}
                      onPress={handleRecoverAccount}
                      disabled={isRecovering}
                      activeOpacity={0.8}
                    >
                      {isRecovering ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>
                          Recover & Decrypt Clips
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.wipeButton, { marginTop: 12 }]}
                      onPress={() => {
                        setRecoveryError(null);
                        setShowWipeConfirm(true);
                      }}
                      disabled={isRecovering}
                    >
                      <Text style={styles.wipeButtonText}>
                        Cannot remember? Start Fresh / Wipe Data
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.dangerButton,
                        isWiping && styles.submitButtonDisabled,
                      ]}
                      onPress={handleResetAccountData}
                      disabled={isWiping}
                      activeOpacity={0.8}
                    >
                      {isWiping ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>
                          Confirm Reset & Start Fresh
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cancelButton, { marginTop: 12 }]}
                      onPress={() => {
                        setRecoveryError(null);
                        setShowWipeConfirm(false);
                      }}
                      disabled={isWiping}
                    >
                      <Text
                        style={[
                          styles.cancelButtonText,
                          {
                            color: isDark
                              ? colors.text.mutedDark
                              : colors.text.mutedLight,
                          },
                        ]}
                      >
                        Back to Password Recovery
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={{ marginTop: 16, alignItems: "center" }}
                  onPress={closeRecoveryDialog}
                  disabled={isRecovering || isWiping}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: isDark ? colors.text.mutedDark : "#6b7280",
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaLight: {
    backgroundColor: colors.background.light,
  },
  safeAreaDark: {
    backgroundColor: colors.background.dark,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  card: {
    borderRadius: 36,
    paddingHorizontal: 24,
    paddingVertical: 40,
    borderWidth: 1,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 8,
  },
  cardLight: {
    backgroundColor: colors.card.light,
    borderColor: colors.border.light,
  },
  cardDark: {
    backgroundColor: colors.card.dark,
    borderColor: colors.border.dark,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoBox: {
    padding: 20,
    borderRadius: 28,
    marginBottom: 20,
    borderWidth: 1,
  },
  logoBoxLight: {
    backgroundColor: colors.primaryTint,
    borderColor: "#dbeafe",
  },
  logoBoxDark: {
    backgroundColor: colors.primaryTintDark,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 8,
    lineHeight: 22,
  },
  form: {
    width: "100%",
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputContainerNormalLight: {
    backgroundColor: colors.input.bgLight,
    borderColor: colors.input.borderLight,
  },
  inputContainerNormalDark: {
    backgroundColor: colors.input.bgDark,
    borderColor: colors.input.borderDark,
  },
  inputContainerFocusedLight: {
    backgroundColor: colors.input.bgFocusLight,
    borderColor: colors.input.borderFocusLight,
  },
  inputContainerFocusedDark: {
    backgroundColor: colors.input.bgFocusDark,
    borderColor: colors.input.borderFocusDark,
  },
  textInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "500",
  },
  passwordHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 4,
    paddingRight: 4,
  },
  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoIconBtn: {
    padding: 4,
    marginLeft: 4,
  },
  eyeIconBtn: {
    padding: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: "700",
  },
  passwordReqBox: {
    marginTop: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  passwordReqBoxLight: {
    backgroundColor: colors.subtleCard.light,
    borderColor: colors.border.light,
  },
  passwordReqBoxDark: {
    backgroundColor: "rgba(39, 39, 42, 0.3)",
    borderColor: colors.border.dark,
  },
  passwordReqTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  passwordReqText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
  },
  errorBox: {
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    marginTop: 4,
  },
  errorBoxLight: {
    backgroundColor: colors.dangerTint,
    borderColor: colors.dangerBorder,
  },
  errorBoxDark: {
    backgroundColor: colors.dangerTintDark,
    borderColor: colors.dangerBorderDark,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 10,
    flex: 1,
  },
  submitButton: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.8,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  buttonLoadingText: {
    marginLeft: 8,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "500",
  },
  toggleBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  footerBox: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 24,
  },
  footerLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContentWrapper: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "90%",
  },
  recoveryCard: {
    borderRadius: 28,
    borderWidth: 1,
    maxHeight: "100%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  recoveryCardLight: {
    backgroundColor: colors.card.light,
    borderColor: colors.border.light,
  },
  recoveryCardDark: {
    backgroundColor: colors.card.dark,
    borderColor: colors.border.dark,
  },
  recoveryScroll: {
    flexShrink: 1,
  },
  recoveryScrollContent: {
    padding: 24,
  },
  recoveryHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  missingSetupHeader: {
    alignItems: "flex-start",
    marginBottom: 18,
  },
  recoveryIconBox: {
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  recoveryIconBoxPrimary: {
    backgroundColor: colors.primaryTint,
  },
  recoveryIconBoxDanger: {
    backgroundColor: colors.dangerTint,
  },
  recoveryTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  missingSetupTitle: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 4,
    textAlign: "left",
  },
  missingSetupEmail: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  recoverySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  missingSetupSubtitle: {
    lineHeight: 21,
    textAlign: "left",
  },
  missingSetupBody: {
    gap: 8,
    marginBottom: 20,
  },
  missingSetupBodyStrong: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
  },
  missingSetupBodyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  missingSetupWarning: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
  },
  wipeButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  wipeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.danger,
    textAlign: "center",
  },
  dangerButton: {
    width: "100%",
    backgroundColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
