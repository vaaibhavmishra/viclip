import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
import { loginUser, resetPassword, signupUser } from "../services/auth";

export default function Login() {
  const router = useRouter();
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

  const handleAuth = async () => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    if (!isLogin) {
      if (!username) {
        setError("Username is required for signup");
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

    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await loginUser(email, password);
      } else {
        await signupUser(email, username, password);
        Toast.show({
          type: "success",
          text1: "Account Created",
          text2: "Welcome to ViClip!",
        });
      }
      router.replace("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      Toast.show({
        type: "success",
        text1: "Check Your Email",
        text2: "We have sent a password reset link to your email address.",
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while resetting password");
      }
    } finally {
      setIsLoading(false);
    }
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main Card Container */}
          <Animated.View
            entering={FadeInDown.duration(500)}
            layout={LinearTransition.duration(200)}
            style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}
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
                          color: isDark ? colors.text.dark : colors.text.light,
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
                        color: isDark ? colors.text.dark : colors.text.light,
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
                        color: isDark ? colors.text.dark : colors.text.light,
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
                      • At least 12 characters long{"\n"}• Must contain 3 of the
                      following:{"\n"}
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
                          color: isDark ? colors.text.dark : colors.text.light,
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
                        color: isDark ? colors.primaryLight : colors.primary,
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
        </ScrollView>
      </KeyboardAvoidingView>
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
});
