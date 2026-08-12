/**
 * AuthPage.tsx
 *
 * Single-screen authentication that switches between Login and Sign Up.
 * Intentionally free of entrance/container animations so TextInput focus
 * (and therefore the keyboard) is never interrupted on any platform.
 */

import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import FontAwesome6 from '@react-native-vector-icons/fontawesome6';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  User,
} from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useUser } from './User.context';

/* ---------------------------------- Theme --------------------------------- */

const COLORS = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  inputBackground: '#FBF8F4',
  border: '#EFE8DF',
  primary: '#F2A259', // pastel orange
  primaryDark: '#E2832F',
  primarySoft: '#FDEBD7',
  primaryFaint: '#FDF4E8',
  track: '#F7F1E9',
  blueSoft: '#EDF3FC',
  text: '#2D2926',
  textMuted: '#9A9186',
  textLight: '#BDB3A6',
  error: '#DF6C57',
  errorSoft: '#FBEEEB',
  white: '#FFFFFF',
} as const;

/* ---------------------------------- Types --------------------------------- */

type AuthMode = 'login' | 'signup';

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

type BusyAction = 'primary' | 'google' | null;

/* -------------------------------- Constants ------------------------------- */

const INITIAL_VALUES: FormValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const MODES: ReadonlyArray<{ key: AuthMode; label: string }> = [
  { key: 'login', label: 'Login' },
  { key: 'signup', label: 'Sign Up' },
];

/* ------------------------------- Validation ------------------------------- */

function validateForm(values: FormValues, mode: AuthMode): FormErrors {
  const errors: FormErrors = {};
  const email = values.email.trim();

  if (mode === 'signup') {
    if (!values.firstName.trim()) errors.firstName = 'First name is required.';
    if (!values.lastName.trim()) errors.lastName = 'Last name is required.';
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (mode === 'signup' && values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (mode === 'signup') {
    if (!values.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (values.confirmPassword !== values.password) {
      errors.confirmPassword = 'Passwords do not match.';
    }
  }

  return errors;
}

/* ----------------------------- Auth requests ------------------------------ */

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Simulated auth request — swap the body for the real API call (fetch / axios)
 * when wiring up a backend. Validation, loading, errors and redirect stay as-is.
 */
async function requestAuthToken(mode: AuthMode, values: FormValues): Promise<string> {
  await delay(1400);
  return `auth.${mode}.${values.email.trim().toLowerCase()}.${Date.now()}`;
}

async function requestGoogleToken(): Promise<string> {
  await delay(1100);
  return `auth.google.${Date.now()}`;
}

/* --------------------------- Reusable components -------------------------- */

function FieldError({ message }: { message: string }): React.JSX.Element {
  return (
    <View style={styles.errorRow}>
      <MaterialIcons name="error-outline" size={14} color={COLORS.error} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

interface AuthTextInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon: (color: string) => React.ReactNode;
  error?: string;
  /** Enables secure entry with a built-in show/hide toggle. */
  secureToggle?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

function AuthTextInput({
  label,
  icon,
  error,
  secureToggle = false,
  containerStyle,
  onFocus,
  onBlur,
  ...inputProps
}: AuthTextInputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const hasError = Boolean(error);
  const iconColor = hasError ? COLORS.error : focused ? COLORS.primaryDark : COLORS.textMuted;

  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          hasError && styles.inputWrapperError,
        ]}
      >
        <View style={styles.inputIcon}>{icon(iconColor)}</View>
        <TextInput
          {...inputProps}
          style={styles.input}
          placeholderTextColor={COLORS.textLight}
          secureTextEntry={secureToggle && hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {secureToggle && (
          <Pressable
            onPress={() => setHidden((prev) => !prev)}
            hitSlop={10}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            {hidden ? (
              <EyeOff size={20} color={COLORS.textMuted} strokeWidth={2} />
            ) : (
              <Eye size={20} color={COLORS.primaryDark} strokeWidth={2} />
            )}
          </Pressable>
        )}
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

interface ModeSwitchProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

/** Static segmented control — active option gets the white pill style. */
function ModeSwitch({ mode, onChange }: ModeSwitchProps): React.JSX.Element {
  return (
    <View style={styles.switchTrack}>
      {MODES.map((item) => {
        const active = item.key === mode;
        return (
          <Pressable
            key={item.key}
            style={[styles.switchOption, active && styles.switchOptionActive]}
            onPress={() => onChange(item.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.switchLabel, active && styles.switchLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
}: PrimaryButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.buttonPressed,
        isDisabled && !loading && styles.primaryButtonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.white} />
      ) : (
        <>
          <Text style={styles.primaryButtonText}>{title}</Text>
          <MaterialIcons
            name="arrow-forward"
            size={20}
            color={COLORS.white}
            style={styles.primaryButtonIcon}
          />
        </>
      )}
    </Pressable>
  );
}

interface GoogleButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

function GoogleButton({
  onPress,
  loading = false,
  disabled = false,
}: GoogleButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.googleButton,
        pressed && styles.buttonPressed,
        isDisabled && !loading && styles.primaryButtonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : (
        <>
          <FontAwesome6 name="google" iconStyle="brand" size={20} color={COLORS.text} />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function AuthPage(): React.JSX.Element {
  const router = useRouter();
  const { authToken, setAuthToken, loadingAuth } = useUser();

  const [mode, setMode] = useState<AuthMode>('login');
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  // Redirect straight to StoreSelector whenever an auth token exists.
  useLayoutEffect(() => {
    if (authToken) {
      router.replace('./StoreSelector');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const switchMode = useCallback((next: AuthMode) => {
    setMode((current) => {
      if (current === next) return current;
      Keyboard.dismiss();
      setErrors({});
      setFormError(null);
      return next;
    });
  }, []);

  const handleChange = useCallback(
    (field: keyof FormValues) => (text: string) => {
      setValues((prev) => ({ ...prev, [field]: text }));
      setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (busyAction) return;
    Keyboard.dismiss();

    const validationErrors = validateForm(values, mode);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setBusyAction('primary');
    setFormError(null);
    try {
      const token = await requestAuthToken(mode, values);
      setAuthToken(token); // useLayoutEffect above redirects to StoreSelector.
    } catch {
      setFormError("We couldn't complete your request. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, mode, values, setAuthToken]);

  const handleGooglePress = useCallback(async () => {
    if (busyAction) return;
    Keyboard.dismiss();

    setBusyAction('google');
    setFormError(null);
    try {
      const token = await requestGoogleToken();
      setAuthToken(token);
    } catch {
      setFormError('Google sign-in failed. Please try again.');
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, setAuthToken]);

  const copy =
    mode === 'login'
      ? { title: 'Welcome back', subtitle: 'Sign in to continue to your account.' }
      : { title: 'Create your account', subtitle: 'Get started in less than a minute.' };

  // Hold a splash while the session restores or the redirect completes.
  if (loadingAuth || authToken) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.logoMark}>
          <Sparkles size={26} color={COLORS.primaryDark} strokeWidth={2.2} />
        </View>
        <ActivityIndicator style={styles.loadingSpinner} color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.decorWarm} pointerEvents="none" />
          <View style={styles.decorBlue} pointerEvents="none" />

          <View style={styles.container}>
            <View style={styles.brand}>
              <View style={styles.logoMark}>
                <Sparkles size={24} color={COLORS.primaryDark} strokeWidth={2.2} />
              </View>
            </View>

            <ModeSwitch mode={mode} onChange={switchMode} />

            <View style={styles.form}>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>

              {formError ? (
                <View style={styles.formErrorBanner}>
                  <MaterialIcons name="error-outline" size={16} color={COLORS.error} />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              ) : null}

              {mode === 'signup' ? (
                <View style={styles.nameRow}>
                  <AuthTextInput
                    containerStyle={styles.nameField}
                    label="First Name"
                    placeholder="Jane"
                    autoCapitalize="words"
                    autoComplete="name-given"
                    textContentType="givenName"
                    returnKeyType="next"
                    value={values.firstName}
                    onChangeText={handleChange('firstName')}
                    error={errors.firstName}
                    icon={(color) => <User size={20} color={color} strokeWidth={2} />}
                  />
                  <AuthTextInput
                    containerStyle={styles.nameField}
                    label="Last Name"
                    placeholder="Doe"
                    autoCapitalize="words"
                    autoComplete="name-family"
                    textContentType="familyName"
                    returnKeyType="next"
                    value={values.lastName}
                    onChangeText={handleChange('lastName')}
                    error={errors.lastName}
                    icon={(color) => <User size={20} color={color} strokeWidth={2} />}
                  />
                </View>
              ) : null}

              <AuthTextInput
                label="Email"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                value={values.email}
                onChangeText={handleChange('email')}
                error={errors.email}
                icon={(color) => <Mail size={20} color={color} strokeWidth={2} />}
              />

              <AuthTextInput
                label="Password"
                placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
                secureToggle
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'login' ? 'password' : 'password-new'}
                textContentType={mode === 'login' ? 'password' : 'newPassword'}
                returnKeyType={mode === 'login' ? 'go' : 'next'}
                onSubmitEditing={mode === 'login' ? handleSubmit : undefined}
                value={values.password}
                onChangeText={handleChange('password')}
                error={errors.password}
                icon={(color) => <Lock size={20} color={color} strokeWidth={2} />}
              />

              {mode === 'signup' ? (
                <AuthTextInput
                  label="Confirm Password"
                  placeholder="Re-enter your password"
                  secureToggle
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password-new"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  value={values.confirmPassword}
                  onChangeText={handleChange('confirmPassword')}
                  error={errors.confirmPassword}
                  icon={(color) => <Lock size={20} color={color} strokeWidth={2} />}
                />
              ) : null}

              <PrimaryButton
                title={mode === 'login' ? 'Login' : 'Create Account'}
                onPress={handleSubmit}
                loading={busyAction === 'primary'}
                disabled={busyAction !== null}
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <GoogleButton
                onPress={handleGooglePress}
                loading={busyAction === 'google'}
                disabled={busyAction !== null}
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                </Text>
                <Pressable
                  onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  hitSlop={10}
                  accessibilityRole="button"
                >
                  <Text style={styles.footerLink}>{mode === 'login' ? 'Sign Up' : 'Login'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingSpinner: { marginTop: 18 },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Soft decorative washes behind the content.
  decorWarm: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: COLORS.primaryFaint,
  },
  decorBlue: {
    position: 'absolute',
    top: 150,
    left: -120,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.blueSoft,
    opacity: 0.55,
  },

  container: { width: '100%', maxWidth: 440, alignSelf: 'center' },

  brand: { alignItems: 'center', marginTop: 20, marginBottom: 28 },
  logoMark: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  // Segmented control (static)
  switchTrack: {
    flexDirection: 'row',
    backgroundColor: COLORS.track,
    borderRadius: 16,
    padding: 4,
  },
  switchOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  switchOptionActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#8A6D4A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  switchLabel: { fontSize: 15, fontWeight: '500', color: COLORS.textMuted },
  switchLabelActive: { color: COLORS.text, fontWeight: '600' },

  form: { marginTop: 32 },

  title: { fontSize: 30, fontWeight: '700', color: COLORS.text, letterSpacing: -0.4 },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textMuted,
  },

  formErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  formErrorText: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '500', color: COLORS.error },

  nameRow: { flexDirection: 'row', gap: 12 },
  nameField: { flex: 1 },

  // Inputs
  field: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginLeft: 2 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  inputWrapperError: { borderColor: COLORS.error, backgroundColor: '#FFFBFA' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16, color: COLORS.text },
  eyeButton: { marginLeft: 8, padding: 4 },

  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7, marginLeft: 2 },
  errorText: { marginLeft: 5, fontSize: 13, fontWeight: '500', color: COLORS.error },

  // Primary CTA
  primaryButton: {
    height: 56,
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryButtonDisabled: { opacity: 0.55, shadowOpacity: 0, elevation: 0 },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  primaryButtonIcon: { marginLeft: 8 },
  buttonPressed: { opacity: 0.85 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 26 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { marginHorizontal: 14, fontSize: 13, fontWeight: '500', color: COLORS.textLight },

  // Google button
  googleButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: '#4A3F30',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  googleButtonText: { marginLeft: 10, fontSize: 16, fontWeight: '600', color: COLORS.text },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: { fontSize: 15, color: COLORS.textMuted },
  footerLink: { marginLeft: 6, fontSize: 15, fontWeight: '700', color: COLORS.primaryDark },
});