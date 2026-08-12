/**
 * StoreSelector.tsx
 *
 * Store onboarding screen with three states:
 *   1. Join Store (default)  — enter a store code, join, toast, redirect.
 *   2. Create Store          — enter a store name, receive a generated code.
 *   3. Store Created         — success view with reveal/copy animations.
 *
 * Keyboard fix: the entire form region (inputs + their wrappers) is a
 * completely static, un-animated view tree on every render. Transitions are
 * preserved ONLY on text/icon/button surfaces that never contain a
 * TextInput, so input focus — and the keyboard — is never interrupted.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import type { TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Hash,
  PartyPopper,
  Plus,
  Store,
  UserPlus,
} from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import UniversalToast from '../ui-components/UniversalToast';
import type { ToastType } from '../ui-components/UniversalToast';

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
  success: '#3E9B63',
  successSoft: '#ECF7EF',
  successBorder: '#CDE8D6',
  yellowSoft: '#FBF3DC',
  text: '#2D2926',
  textMuted: '#9A9186',
  textLight: '#BDB3A6',
  error: '#DF6C57',
  white: '#FFFFFF',
} as const;

/* ---------------------------------- Types --------------------------------- */

type SelectorMode = 'join' | 'create';
type ViewState = SelectorMode | 'success';

interface ToastPayload {
  id: number;
  type: ToastType;
  msg: string;
}

interface CreatedStore {
  name: string;
  storeCode: string;
}

/* -------------------------------- Mock API -------------------------------- */

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Replace with the real "join store" endpoint when wiring up the backend. */
async function joinStoreRequest(storeCode: string): Promise<void> {
  await delay(1200);
  void storeCode;
}

/** Replace with the real "create store" endpoint when wiring up the backend. */
async function createStoreRequest(storeName: string): Promise<CreatedStore> {
  await delay(1400);
  return { name: storeName, storeCode: generateStoreCode(storeName) };
}

function generateStoreCode(storeName: string): string {
  const prefix = storeName
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${suffix}`;
}

/* --------------------------- Reusable components -------------------------- */

interface LabeledInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string;
  icon: (color: string) => React.ReactNode;
}

/**
 * Premium labeled input. Renders as a fully static view tree — no Animated
 * wrappers anywhere — so tapping it always focuses and opens the keyboard.
 */
function LabeledInput({
  label,
  hint,
  error,
  icon,
  onFocus,
  onBlur,
  ...inputProps
}: LabeledInputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  const iconColor = hasError ? COLORS.error : focused ? COLORS.primaryDark : COLORS.textMuted;

  return (
    <View style={styles.field}>
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
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={14} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
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
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const animateScale = useCallback(
    (toValue: number) => {
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }).start();
    },
    [scale],
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateScale(0.97)}
      onPressOut={() => animateScale(1)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <Animated.View
        style={[
          styles.primaryButton,
          { transform: [{ scale }] },
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
      </Animated.View>
    </Pressable>
  );
}

interface ModeSwitchProps {
  mode: SelectorMode;
  onChange: (mode: SelectorMode) => void;
}

const SEGMENTS: ReadonlyArray<{
  key: SelectorMode;
  label: string;
  icon: (color: string) => React.ReactNode;
}> = [
  {
    key: 'join',
    label: 'Join Store',
    icon: (color) => <UserPlus size={16} color={color} strokeWidth={2.2} />,
  },
  {
    key: 'create',
    label: 'Create Store',
    icon: (color) => <Plus size={16} color={color} strokeWidth={2.4} />,
  },
];

/**
 * Sliding segmented control with an animated white pill.
 * Keyboard-safe: contains no TextInputs.
 */
function ModeSwitch({ mode, onChange }: ModeSwitchProps): React.JSX.Element {
  const [trackWidth, setTrackWidth] = useState(0);
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animation, {
      toValue: mode === 'join' ? 0 : 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [mode, animation]);

  const pillWidth = trackWidth > 0 ? (trackWidth - 8) / 2 : 0;
  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pillWidth],
  });

  return (
    <View
      style={styles.switchTrack}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {pillWidth > 0 && (
        <Animated.View
          style={[styles.switchPill, { width: pillWidth, transform: [{ translateX }] }]}
        />
      )}
      {SEGMENTS.map((segment) => {
        const active = segment.key === mode;
        const color = active ? COLORS.text : COLORS.textMuted;
        return (
          <Pressable
            key={segment.key}
            style={styles.switchOption}
            onPress={() => onChange(segment.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {segment.icon(color)}
            <Text style={[styles.switchLabel, active && styles.switchLabelActive]}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------- Success view ----------------------------- */

interface SuccessViewProps {
  store: CreatedStore;
  onCopySuccess: () => void;
  onContinue: () => void;
}

/**
 * Success state. Contains no TextInputs, so its internal animations
 * (badge pop, reveal crossfade, copy check) are keyboard-safe.
 */
function SuccessView({
  store,
  onCopySuccess,
  onContinue,
}: SuccessViewProps): React.JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const iconPop = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;
  const copyAnim = useRef(new Animated.Value(0)).current;
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.spring(iconPop, {
      toValue: 1,
      useNativeDriver: true,
      damping: 12,
      stiffness: 160,
      mass: 0.8,
    }).start();
    return () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    };
  }, [iconPop]);

  const toggleReveal = useCallback(() => {
    setRevealed((prev) => {
      Animated.timing(revealAnim, {
        toValue: prev ? 0 : 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return !prev;
    });
  }, [revealAnim]);

  const handleCopy = useCallback(async () => {
    if (copied) return;
    try {
      await Clipboard.setStringAsync(store.storeCode);
    } catch {
      return; // Clipboard unavailable — keep state unchanged.
    }

    setCopied(true);
    onCopySuccess();

    Animated.spring(copyAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 220,
      mass: 0.7,
    }).start();

    revertTimer.current = setTimeout(() => {
      Animated.timing(copyAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setCopied(false));
    }, 1800);
  }, [copied, copyAnim, onCopySuccess, store.storeCode]);

  const maskedCode = '•'.repeat(store.storeCode.length);

  return (
    <View style={styles.successContainer}>
      <Animated.View
        style={[
          styles.successBadge,
          {
            opacity: iconPop,
            transform: [
              { scale: iconPop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            ],
          },
        ]}
      >
        <View style={styles.successBadgeInner}>
          <PartyPopper size={34} color={COLORS.primaryDark} strokeWidth={2} />
        </View>
      </Animated.View>

      <Text style={styles.successTitle}>Congratulations!</Text>
      <Text style={styles.successSubtitle}>
        Your new store has been created successfully.
      </Text>

      <View style={styles.codeCard}>
        <View style={styles.codeCardHeader}>
          <Text style={styles.codeCardLabel}>YOUR STORE CODE</Text>
          <View style={styles.codeCardChip}>
            <Store size={12} color={COLORS.primaryDark} strokeWidth={2.2} />
            <Text style={styles.codeCardChipText} numberOfLines={1}>
              {store.name}
            </Text>
          </View>
        </View>

        <View style={styles.codeRow}>
          <View style={styles.codeValueBox}>
            <Animated.Text
              style={[styles.codeValue, styles.codeValueOverlay, { opacity: revealAnim }]}
              numberOfLines={1}
            >
              {store.storeCode}
            </Animated.Text>
            <Animated.Text
              style={[
                styles.codeValue,
                styles.codeValueMasked,
                { opacity: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
              ]}
              numberOfLines={1}
            >
              {maskedCode}
            </Animated.Text>
          </View>

          <Pressable
            onPress={toggleReveal}
            hitSlop={10}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide store code' : 'Reveal store code'}
          >
            {revealed ? (
              <EyeOff size={20} color={COLORS.primaryDark} strokeWidth={2} />
            ) : (
              <Eye size={20} color={COLORS.textMuted} strokeWidth={2} />
            )}
          </Pressable>

          <Pressable
            onPress={handleCopy}
            hitSlop={6}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Copy store code"
          >
            <View style={styles.copySlot}>
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.copySlotCenter,
                  {
                    opacity: copyAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                    transform: [
                      { scale: copyAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) },
                    ],
                  },
                ]}
              >
                <Copy size={19} color={COLORS.primaryDark} strokeWidth={2} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.copyCheckCircle,
                  {
                    opacity: copyAnim,
                    transform: [
                      { scale: copyAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                    ],
                  },
                ]}
              >
                <Check size={14} color={COLORS.white} strokeWidth={3} />
              </Animated.View>
            </View>
          </Pressable>
        </View>

        <Text style={styles.codeHint}>
          Share this code with your team so they can join your store.
        </Text>
      </View>

      <PrimaryButton title="Continue to Store" onPress={onContinue} />
    </View>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function StoreSelector(): React.JSX.Element {
  const router = useRouter();

  const [view, setView] = useState<ViewState>('join');
  const [storeCode, setStoreCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdStore, setCreatedStore] = useState<CreatedStore | null>(null);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  /**
   * Header transition: a gentle opacity fade applied to TEXT ONLY.
   * No slide/transform, and it never wraps a TextInput, so it cannot
   * disturb input focus or the keyboard.
   */
  const headerFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    headerFade.setValue(0);
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [view, headerFade]);

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToast({ id: Date.now(), type, msg });
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  const mode: SelectorMode = view === 'success' ? 'create' : view;

  const switchMode = useCallback((next: SelectorMode) => {
    setView((current) => {
      if (current === next || current === 'success') return current;
      Keyboard.dismiss();
      setJoinError(null);
      setCreateError(null);
      return next;
    });
  }, []);

  const handleJoin = useCallback(async () => {
    if (loading) return;
    Keyboard.dismiss();

    const code = storeCode.trim();
    if (!code) {
      setJoinError('Store code is required.');
      return;
    }
    setJoinError(null);
    setLoading(true);

    try {
      await joinStoreRequest(code);
      showToast('success', 'Store joined successfully');
      setTimeout(() => router.replace('/dashboard'), 900);
    } catch {
      showToast('error', "We couldn't join that store. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }, [loading, storeCode, router, showToast]);

  const handleCreate = useCallback(async () => {
    if (loading) return;
    Keyboard.dismiss();

    const name = storeName.trim();
    if (!name) {
      setCreateError('Store name is required.');
      return;
    }
    setCreateError(null);
    setLoading(true);

    try {
      const store = await createStoreRequest(name);
      setCreatedStore(store);
      setView('success');
      showToast('success', 'Store created successfully');
    } catch {
      showToast('error', "We couldn't create your store. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [loading, storeName, showToast]);

  const handleContinue = useCallback(() => {
    router.replace('/dashboard');
  }, [router]);

  const handleCodeChange = useCallback((text: string) => {
    setStoreCode(text);
    setJoinError(null);
  }, []);

  const handleNameChange = useCallback((text: string) => {
    setStoreName(text);
    setCreateError(null);
  }, []);

  const headerCopy =
    view === 'join'
      ? {
          title: 'Join an existing store',
          subtitle: 'Enter the store code shared with you by your team.',
        }
      : {
          title: 'Create a new store',
          subtitle: 'Give your store a name — you can change it later.',
        };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {/*
        Standard, proven keyboard handling: resize the layout so the focused
        input scrolls into view. No custom behavior offsets.
      */}
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
                <Store size={24} color={COLORS.primaryDark} strokeWidth={2.2} />
              </View>
              <Text style={styles.brandTitle}>Store setup</Text>
              <Text style={styles.brandSubtitle}>
                Join your team or start something new.
              </Text>
            </View>

            {view !== 'success' && <ModeSwitch mode={mode} onChange={switchMode} />}

            {/* Fully static content region — no Animated wrappers around inputs. */}
            <View style={styles.content}>
              {view === 'success' && createdStore ? (
                <SuccessView
                  store={createdStore}
                  onCopySuccess={() => showToast('success', 'Code copied to clipboard')}
                  onContinue={handleContinue}
                />
              ) : (
                <>
                  {/* Text-only fade — contains zero TextInputs. */}
                  <Animated.View style={{ opacity: headerFade }}>
                    <Text style={styles.title}>{headerCopy.title}</Text>
                    <Text style={styles.subtitle}>{headerCopy.subtitle}</Text>
                  </Animated.View>

                  {/* Static form area — inputs are never inside an animated view. */}
                  {view === 'join' ? (
                    <View>
                      <LabeledInput
                        label="Store Code"
                        placeholder="e.g. SUN-8K2M4P"
                        hint="Ask your store owner if you don't have a code."
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="go"
                        onSubmitEditing={handleJoin}
                        value={storeCode}
                        onChangeText={handleCodeChange}
                        error={joinError ?? undefined}
                        icon={(color) => <Hash size={20} color={color} strokeWidth={2} />}
                      />
                      <PrimaryButton
                        title="Join Store"
                        onPress={handleJoin}
                        loading={loading}
                        disabled={loading}
                      />
                    </View>
                  ) : (
                    <View>
                      <LabeledInput
                        label="Store Name"
                        placeholder="e.g. Sunrise Bakery"
                        hint="This is how your store will appear to your team."
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="go"
                        onSubmitEditing={handleCreate}
                        value={storeName}
                        onChangeText={handleNameChange}
                        error={createError ?? undefined}
                        icon={(color) => <Store size={20} color={color} strokeWidth={2} />}
                      />
                      <PrimaryButton
                        title="Create Store"
                        onPress={handleCreate}
                        loading={loading}
                        disabled={loading}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {toast && (
        <UniversalToast
          key={toast.id}
          type={toast.type}
          msg={toast.msg}
          onDismiss={hideToast}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },

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
    top: 170,
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
  brandTitle: { marginTop: 16, fontSize: 22, fontWeight: '700', color: COLORS.text },
  brandSubtitle: { marginTop: 4, fontSize: 14, color: COLORS.textMuted },

  // Segmented control
  switchTrack: {
    flexDirection: 'row',
    backgroundColor: COLORS.track,
    borderRadius: 16,
    padding: 4,
  },
  switchPill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    shadowColor: '#8A6D4A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  switchOption: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  switchLabel: { fontSize: 15, fontWeight: '500', color: COLORS.textMuted },
  switchLabelActive: { color: COLORS.text, fontWeight: '600' },

  content: { marginTop: 32 },

  title: { fontSize: 28, fontWeight: '700', color: COLORS.text, letterSpacing: -0.4 },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textMuted,
  },

  // Inputs
  field: { marginBottom: 22 },
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
  hintText: { marginTop: 8, marginLeft: 2, fontSize: 13, color: COLORS.textLight },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7, marginLeft: 2 },
  errorText: { marginLeft: 5, fontSize: 13, fontWeight: '500', color: COLORS.error },

  // Primary button
  primaryButton: {
    height: 56,
    marginTop: 4,
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

  // Success view
  successContainer: { alignItems: 'stretch' },
  successBadge: { alignSelf: 'center', marginTop: 8 },
  successBadgeInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: COLORS.primaryFaint,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  successTitle: {
    marginTop: 22,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  successSubtitle: {
    marginTop: 8,
    marginBottom: 28,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  codeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 26,
    shadowColor: '#4A3F30',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  codeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  codeCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.textMuted,
  },
  codeCardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '55%',
  },
  codeCardChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primaryDark },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  codeValueBox: { flex: 1, justifyContent: 'center', minHeight: 26 },
  codeValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  codeValueOverlay: { position: 'absolute', left: 0, right: 0 },
  codeValueMasked: { color: COLORS.textMuted },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  copySlot: { width: 24, height: 24 },
  copySlotCenter: { alignItems: 'center', justifyContent: 'center' },
  copyCheckCircle: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeHint: { marginTop: 14, fontSize: 13, lineHeight: 18, color: COLORS.textLight },
});