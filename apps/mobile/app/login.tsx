import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { loginUser, resetPassword, signupUser } from '../services/auth'

export default function Login() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    if (!isLogin) {
      if (!username) {
        setError('Username is required for signup')
        return
      }

      if (password.length < 12) {
        setError('Password must be at least 12 characters long')
        return
      }

      let typesCount = 0
      if (/[A-Z]/.test(password)) typesCount++
      if (/[a-z]/.test(password)) typesCount++
      if (/[0-9]/.test(password)) typesCount++
      if (/[^A-Za-z0-9]/.test(password)) typesCount++

      if (typesCount < 4) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setError(
          'Password must contain an uppercase letter, a lowercase letter, a number, and a special character',
        )
        return
      }

      if (password !== confirmPassword) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setError('Passwords do not match')
        return
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      if (isLogin) {
        await loginUser(email, password)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        await signupUser(email, username, password)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Toast.show({
          type: 'success',
          text1: 'Account Created',
          text2: 'Welcome to ViClip!',
        })
      }
      router.replace('/')
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      await resetPassword(email)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Toast.show({
        type: 'success',
        text1: 'Check Your Email',
        text2: 'We have sent a password reset link to your email address.',
      })
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred while resetting password')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const getInputStyle = (inputName: string) => {
    const isFocused = focusedInput === inputName
    return `flex-row items-center border rounded-2xl px-4 py-3.5 ${
      isFocused
        ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-400 dark:border-blue-500'
        : 'bg-gray-50 dark:bg-zinc-800/50 border-gray-100 dark:border-zinc-700/50'
    }`
  }

  const getIconColor = (inputName: string) => {
    return focusedInput === inputName ? '#3b82f6' : '#6b7280'
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f9fafb] dark:bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-5 py-8"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main Card Container */}
          <Animated.View
            entering={FadeInDown.duration(500)}
            layout={LinearTransition.duration(200)}
            className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-[36px] px-6 py-10 shadow-lg shadow-blue-900/5"
          >
            <View className="items-center mb-8">
              <View className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-[28px] mb-5 shadow-sm border border-blue-100 dark:border-blue-900/30">
                <Image
                  source={require('../assets/images/viclip-icon.png')}
                  className="w-20 h-20"
                  resizeMode="contain"
                />
              </View>
              <Text className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Welcome to ViClip
              </Text>
              <Text className="text-[15px] font-medium text-gray-500 dark:text-gray-400 mt-2.5 text-center px-2 leading-relaxed">
                Sync your clipboard seamlessly across all your devices
              </Text>
            </View>

            <View className="w-full gap-5">
              {/* Username for Signup */}
              {!isLogin && (
                <Animated.View
                  entering={FadeInUp.duration(300)}
                  exiting={FadeOutUp.duration(200)}
                  layout={LinearTransition.duration(200)}
                  className="gap-2"
                >
                  <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Username
                  </Text>
                  <Animated.View className={getInputStyle('username')}>
                    <Feather
                      name="user"
                      size={20}
                      color={getIconColor('username')}
                    />
                    <TextInput
                      className="flex-1 ml-3 text-base font-medium text-gray-900 dark:text-white"
                      placeholder="Choose a username"
                      placeholderTextColor="#9ca3af"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      editable={!isLoading}
                      onFocus={() => setFocusedInput('username')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </Animated.View>
                </Animated.View>
              )}

              {/* Email */}
              <Animated.View
                layout={LinearTransition.duration(200)}
                className="gap-2"
              >
                <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                  Email Address
                </Text>
                <Animated.View className={getInputStyle('email')}>
                  <Feather
                    name="mail"
                    size={20}
                    color={getIconColor('email')}
                  />
                  <TextInput
                    className="flex-1 ml-3 text-base font-medium text-gray-900 dark:text-white"
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </Animated.View>
              </Animated.View>

              {/* Password */}
              <Animated.View
                layout={LinearTransition.duration(200)}
                className="gap-2"
              >
                <View className="flex-row items-center justify-between ml-1 pr-1">
                  <View className="flex-row items-center">
                    <Text className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      Password
                    </Text>
                    {!isLogin && (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setShowPasswordRequirements(!showPasswordRequirements)
                        }}
                        className="p-1 ml-1"
                      >
                        <Feather name="info" size={16} color="#6b7280" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {/* Forgot Password Link specifically placed here for Login */}
                  {isLogin && (
                    <TouchableOpacity
                      onPress={handleForgotPassword}
                      disabled={isLoading}
                    >
                      <Text className="text-blue-600 dark:text-blue-400 text-[13px] font-bold">
                        Forgot Password?
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Animated.View className={getInputStyle('password')}>
                  <Feather
                    name="lock"
                    size={20}
                    color={getIconColor('password')}
                  />
                  <TextInput
                    className="flex-1 ml-3 text-base font-medium text-gray-900 dark:text-white"
                    placeholder="Enter your password"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setShowPassword(!showPassword)
                    }}
                    className="p-1"
                  >
                    <Feather
                      name={showPassword ? 'eye' : 'eye-off'}
                      size={20}
                      color={getIconColor('password')}
                    />
                  </TouchableOpacity>
                </Animated.View>

                {!isLogin && showPasswordRequirements && (
                  <Animated.View
                    entering={FadeInUp.duration(300)}
                    exiting={FadeOutUp.duration(200)}
                    layout={LinearTransition.duration(200)}
                    className="mt-1 px-1 bg-gray-50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800"
                  >
                    <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Password requirements:
                    </Text>
                    <Text className="text-[13px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                      • At least 12 characters long{'\n'}• Must contain 3 of the
                      following:{'\n'}
                      {'  '}• Uppercase letter (A-Z){'\n'}
                      {'  '}• Lowercase letter (a-z){'\n'}
                      {'  '}• Number (0-9){'\n'}
                      {'  '}• Special character (!@#$%...)
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
                  className="gap-2"
                >
                  <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Confirm Password
                  </Text>
                  <Animated.View className={getInputStyle('confirmPassword')}>
                    <Feather
                      name="lock"
                      size={20}
                      color={getIconColor('confirmPassword')}
                    />
                    <TextInput
                      className="flex-1 ml-3 text-base font-medium text-gray-900 dark:text-white"
                      placeholder="Confirm your password"
                      placeholderTextColor="#9ca3af"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      editable={!isLoading}
                      onFocus={() => setFocusedInput('confirmPassword')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setShowConfirmPassword(!showConfirmPassword)
                      }}
                      className="p-1"
                    >
                      <Feather
                        name={showConfirmPassword ? 'eye' : 'eye-off'}
                        size={20}
                        color={getIconColor('confirmPassword')}
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
                  className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl flex-row items-center border border-red-100 dark:border-red-900/30 mt-1"
                >
                  <Feather name="alert-circle" size={18} color="#ef4444" />
                  <Text className="text-red-500 text-sm font-medium ml-2.5 flex-1">
                    {error}
                  </Text>
                </Animated.View>
              )}

              {/* Submit Button */}
              <Animated.View layout={LinearTransition.duration(200)}>
                <TouchableOpacity
                  className={`w-full bg-blue-600 active:bg-blue-700 rounded-2xl py-4 flex-row items-center justify-center mt-3 shadow-md shadow-blue-500/30 ${
                    isLoading ? 'opacity-80' : ''
                  }`}
                  onPress={handleAuth}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-[17px] font-bold text-white tracking-wide">
                      {isLogin ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Toggle Mode */}
              <Animated.View
                layout={LinearTransition.duration(200)}
                className="flex-row justify-center items-center mt-2"
              >
                <Text className="text-gray-500 dark:text-gray-400 text-[15px] font-medium">
                  {isLogin
                    ? "Don't have an account?"
                    : 'Already have an account?'}
                </Text>
                <TouchableOpacity
                  className="ml-2"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setIsLogin(!isLogin)
                    setError(null)
                    setPassword('')
                    setConfirmPassword('')
                  }}
                  disabled={isLoading}
                >
                  <Text className="text-blue-600 dark:text-blue-400 text-[15px] font-bold">
                    {isLogin ? 'Sign up' : 'Log in'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Footer text Outside the Card */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(150)}
            className="mt-8 px-4"
          >
            <Text className="text-gray-400 dark:text-gray-500 text-sm font-medium text-center leading-loose">
              By continuing, you agree to ViClip's{'\n'}
              <Text className="text-gray-600 dark:text-gray-400 font-bold underline">
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text className="text-gray-600 dark:text-gray-400 font-bold underline">
                Privacy Policy
              </Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
