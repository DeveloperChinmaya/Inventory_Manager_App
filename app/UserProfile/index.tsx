/**
 * UserProfile.tsx
 *
 * Premium user profile screen:
 *   - View account info (read-only) with masked password row
 *   - Edit mode: avatar picker, first/last name (email stays locked)
 *   - Optional change-password flow with animated reveal + validation
 *   - Save / Cancel with loading + toast feedback
 *   - Logout, Delete Account (destructive, confirmed via animated dialog)
 *   - Account ID copy-to-clipboard + subtle app version
 *
 * Reuses UniversalToast for feedback and UserContext for auth clearing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Pencil,
  Trash2,
  User,
} from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import UniversalToast from '../../ui-components/UniversalToast';
import type { ToastType } from '../../ui-components/UniversalToast';
import { useUser } from '../User.context';

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
  successSoft: '#ECF7EF',
  text: '#2D2926',
  textMuted: '#9A9186',
  textLight: '#BDB3A6',
  error: '#D66A4E',
  errorSoft: '#FBEEE9',
  errorBorder: '#F2D5CA',
  white: '#FFFFFF',
} as const;

/* ---------------------------------- Types --------------------------------- */

interface UserProfileData {
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  /** ISO date string, rendered as "Aug 2026". */
  memberSince: string;
  avatarUri: string | null;
}

interface ProfileDraft {
  firstName: string;
  lastName: string;
  newPassword: string;
  confirmPassword: string;
}

type DraftErrors = Partial<Record<keyof ProfileDraft, string>>;

interface ToastPayload {
  id: number;
  type: ToastType;
  msg: string;
}

/* -------------------------------- Constants ------------------------------- */

const APP_VERSION = '1.0.0';
const MIN_PASSWORD_LENGTH = 8;
const MASKED_PASSWORD = '••••••••';

/** Mock signed-in user — replace with real profile data from your backend. */
const INITIAL_PROFILE: UserProfileData = {
  accountId: 'acct_7F4K2M9XQ1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@sunrisebakery.com',
  memberSince: '2026-08-12T00:00:00.000Z',
  avatarUri: null,
};

/* -------------------------------- Mock API -------------------------------- */

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface SaveProfilePayload {
  firstName: string;
  lastName: string;
  avatarUri: string | null;
  newPassword: string | null;
}

/** Replace the body with the real "update profile" endpoint. */
async function saveProfileRequest(payload: SaveProfilePayload): Promise<void> {
  await delay(1400);
  void payload;
}

/** Replace the body with the real "logout" call (token revocation, etc.). */
async function logoutRequest(): Promise<void> {
  await delay(700);
}

/** Replace the body with the real "delete account" endpoint. */
async function deleteAccountRequest(): Promise<void> {
  await delay(1600);
}

/* --------------------------------- Helpers -------------------------------- */

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || '?';
}

function draftFromProfile(profile: UserProfileData): ProfileDraft {
  return { firstName: profile.firstName, lastName: profile.lastName, newPassword: '', confirmPassword: '' };
}

function validateDraft(draft: ProfileDraft, includePassword: boolean): DraftErrors {
  const errors: DraftErrors = {};

  if (!draft.firstName.trim()) errors.firstName = 'First name is required.';
  if (!draft.lastName.trim()) errors.lastName = 'Last name is required.';

  if (includePassword) {
    if (!draft.newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (draft.newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!draft.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password.';
    } else if (draft.confirmPassword !== draft.newPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
  }

  return errors;
}

/* --------------------------- Reusable components -------------------------- */

interface FadeInProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Mounts children with a subtle fade + rise animation. */
function FadeIn({ children, style }: FadeInProps): React.JSX.Element {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animation]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: animation,
          transform: [
            { translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function FieldError({ message }: { message: string }): React.JSX.Element {
  return (
    <FadeIn>
      <View style={styles.errorRow}>
        <MaterialIcons name="error-outline" size={14} color={COLORS.error} />
        <Text style={styles.errorText}>{message}</Text>
      </View>
    </FadeIn>
  );
}

interface ProfileInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon: (color: string) => React.ReactNode;
  error?: string;
  /** When false the field renders as elegant read-only text. */
  editable?: boolean;
  /** Extra-muted appearance for permanently locked fields (email). */
  muted?: boolean;
  /** Enables secure entry with a built-in show/hide toggle. */
  secureToggle?: boolean;
}

function ProfileInput({
  label,
  icon,
  error,
  editable = true,
  muted = false,
  secureToggle = false,
  onFocus,
  onBlur,
  ...inputProps
}: ProfileInputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const hasError = Boolean(error);
  const interactive = editable && !muted;
  const iconColor = hasError
    ? COLORS.error
    : focused
      ? COLORS.primaryDark
      : muted
        ? COLORS.textLight
        : COLORS.textMuted;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, muted && styles.labelMuted]}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          !interactive && styles.inputWrapperReadOnly,
          muted && styles.inputWrapperMuted,
          focused && interactive && styles.inputWrapperFocused,
          hasError && styles.inputWrapperError,
        ]}
      >
        <View style={styles.inputIcon}>{icon(iconColor)}</View>
        <TextInput
          {...inputProps}
          style={[
            styles.input,
            !interactive && styles.inputReadOnly,
            muted && styles.inputMuted,
          ]}
          editable={interactive}
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
        {secureToggle && interactive && (
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
        {muted && (
          <Lock size={15} color={COLORS.textLight} strokeWidth={2.2} style={styles.lockBadge} />
        )}
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'dangerText';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: (color: string) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_TEXT_COLORS: Record<ButtonVariant, string> = {
  primary: COLORS.white,
  secondary: COLORS.text,
  outline: COLORS.text,
  danger: COLORS.white,
  dangerText: COLORS.error,
};

function ActionButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: ActionButtonProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;
  const textColor = VARIANT_TEXT_COLORS[variant];

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
    },
    [scale],
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <Animated.View
        style={[
          styles.button,
          styles[`button_${variant}`],
          isDisabled && !loading && styles.buttonDisabled,
          { transform: [{ scale }] },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? COLORS.white : COLORS.primary} />
        ) : (
          <>
            {icon?.(textColor)}
            <Text style={[styles.buttonText, { color: textColor }, icon ? styles.buttonTextWithIcon : null]}>
              {title}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

/* ---------------------------- Delete dialog ------------------------------- */

interface DeleteAccountDialogProps {
  visible: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteAccountDialog({
  visible,
  deleting,
  onCancel,
  onConfirm,
}: DeleteAccountDialogProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
      }).start();
    }
  }, [visible, scale]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={deleting ? undefined : onCancel}
    >
      <View style={styles.dialogOverlay}>
        <TouchableWithoutFeedback onPress={deleting ? undefined : onCancel} accessible={false}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.dialogCard, { transform: [{ scale }] }]}>
          <View style={styles.dialogIconCircle}>
            <AlertTriangle size={26} color={COLORS.error} strokeWidth={2.2} />
          </View>
          <Text style={styles.dialogTitle}>Delete Account?</Text>
          <Text style={styles.dialogBody}>
            This action is permanent. All menu items, inventory, billing records, and business
            data associated with your account will be permanently deleted.
          </Text>
          <View style={styles.dialogButtons}>
            <ActionButton
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={deleting}
              style={styles.dialogButton}
            />
            <ActionButton
              title="Delete"
              variant="danger"
              onPress={onConfirm}
              loading={deleting}
              style={styles.dialogButton}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function UserProfile(): React.JSX.Element {
  const router = useRouter();
  const { setAuthToken } = useUser();

  const [profile, setProfile] = useState<UserProfileData>(INITIAL_PROFILE);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(INITIAL_PROFILE));
  const [draftAvatar, setDraftAvatar] = useState<string | null>(INITIAL_PROFILE.avatarUri);

  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToast({ id: Date.now(), type, msg });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  /* ------------------------------ Edit lifecycle --------------------------- */

  const enterEditMode = useCallback(() => {
    setDraft(draftFromProfile(profile));
    setDraftAvatar(profile.avatarUri);
    setErrors({});
    setIsEditing(true);
  }, [profile]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    setDraft(draftFromProfile(profile));
    setDraftAvatar(profile.avatarUri);
    setErrors({});
    setShowPasswordFields(false);
    setIsEditing(false);
  }, [profile]);

  const handleChange = useCallback(
    (field: keyof ProfileDraft) => (text: string) => {
      setDraft((prev) => ({ ...prev, [field]: text }));
      setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    },
    [],
  );

  const handleChangePasswordPress = useCallback(() => {
    // Changing the password is an edit action — enter edit mode first.
    if (!isEditing) enterEditMode();
    setShowPasswordFields(true);
  }, [isEditing, enterEditMode]);

  const handlePickAvatar = useCallback(async () => {
    if (!isEditing) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('error', 'Photo access is needed to update your picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setDraftAvatar(result.assets[0].uri);
      }
    } catch {
      showToast('error', "We couldn't open your photo library.");
    }
  }, [isEditing, showToast]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    Keyboard.dismiss();

    const validationErrors = validateDraft(draft, showPasswordFields);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    try {
      await saveProfileRequest({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        avatarUri: draftAvatar,
        newPassword: showPasswordFields ? draft.newPassword : null,
      });
      setProfile((prev) => ({
        ...prev,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        avatarUri: draftAvatar,
      }));
      setShowPasswordFields(false);
      setIsEditing(false);
      showToast('success', 'Profile updated successfully');
    } catch {
      showToast('error', "We couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [saving, draft, draftAvatar, showPasswordFields, showToast]);

  /* --------------------------- Account actions ----------------------------- */

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutRequest();
      setAuthToken(null);
      // The root route guards on authToken and redirects to the auth screen.
      router.replace('/');
    } catch {
      showToast('error', "We couldn't log you out. Please try again.");
      setLoggingOut(false);
    }
  }, [loggingOut, router, setAuthToken, showToast]);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteAccountRequest();
      setDeleteDialogVisible(false);
      setAuthToken(null);
      router.replace('/');
    } catch {
      setDeleteDialogVisible(false);
      showToast('error', "We couldn't delete your account. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [deleting, router, setAuthToken, showToast]);

  const handleCopyAccountId = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(profile.accountId);
      showToast('success', 'Account ID copied to clipboard');
    } catch {
      showToast('error', "We couldn't copy your account ID.");
    }
  }, [profile.accountId, showToast]);

  /* --------------------------------- Render -------------------------------- */

  const displayedAvatar = isEditing ? draftAvatar : profile.avatarUri;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();

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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
              {/* Back button */}
              <Pressable
                onPress={handleBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <View style={styles.backButton}>
                  <ChevronLeft size={22} color={COLORS.text} strokeWidth={2.2} />
                </View>
              </Pressable>

              {/* Header */}
              <View style={styles.header}>
                {!isEditing && (
                  <FadeIn style={styles.editButtonSlot}>
                    <Pressable
                      onPress={enterEditMode}
                      accessibilityRole="button"
                      accessibilityLabel="Edit profile"
                    >
                      <View style={styles.editButton}>
                        <Pencil size={14} color={COLORS.primaryDark} strokeWidth={2.4} />
                        <Text style={styles.editButtonText}>Edit</Text>
                      </View>
                    </Pressable>
                  </FadeIn>
                )}

                <Pressable
                  onPress={handlePickAvatar}
                  disabled={!isEditing}
                  accessibilityRole={isEditing ? 'button' : 'image'}
                  accessibilityLabel={isEditing ? 'Change profile picture' : 'Profile picture'}
                >
                  <View style={styles.avatarCircle}>
                    {displayedAvatar ? (
                      <Image source={{ uri: displayedAvatar }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarInitials}>
                        {getInitials(profile.firstName, profile.lastName)}
                      </Text>
                    )}
                    {isEditing && (
                      <FadeIn style={styles.avatarBadgeSlot}>
                        <View style={styles.avatarBadge}>
                          <Camera size={14} color={COLORS.white} strokeWidth={2.4} />
                        </View>
                      </FadeIn>
                    )}
                  </View>
                </Pressable>

                <Text style={styles.name}>{fullName || 'Your Name'}</Text>
                <Text style={styles.email}>{profile.email}</Text>
                <View style={styles.memberChip}>
                  <Text style={styles.memberText}>
                    Member Since • {formatMemberSince(profile.memberSince)}
                  </Text>
                </View>

                {isEditing && (
                  <FadeIn>
                    <View style={styles.editingChip}>
                      <Pencil size={11} color={COLORS.primaryDark} strokeWidth={2.6} />
                      <Text style={styles.editingChipText}>Editing profile</Text>
                    </View>
                  </FadeIn>
                )}
              </View>

              {/* Fields */}
              <View style={styles.card}>
                <ProfileInput
                  label="First Name"
                  placeholder="Jane"
                  autoCapitalize="words"
                  autoComplete="name-given"
                  returnKeyType="next"
                  editable={isEditing}
                  value={isEditing ? draft.firstName : profile.firstName}
                  onChangeText={handleChange('firstName')}
                  error={errors.firstName}
                  icon={(color) => <User size={20} color={color} strokeWidth={2} />}
                />
                <ProfileInput
                  label="Last Name"
                  placeholder="Doe"
                  autoCapitalize="words"
                  autoComplete="name-family"
                  returnKeyType="next"
                  editable={isEditing}
                  value={isEditing ? draft.lastName : profile.lastName}
                  onChangeText={handleChange('lastName')}
                  error={errors.lastName}
                  icon={(color) => <User size={20} color={color} strokeWidth={2} />}
                />
                <ProfileInput
                  label="Email"
                  value={profile.email}
                  editable={false}
                  muted
                  icon={(color) => <Mail size={20} color={color} strokeWidth={2} />}
                />
                <ProfileInput
                  label="Password"
                  value={MASKED_PASSWORD}
                  editable={false}
                  icon={(color) => <Lock size={20} color={color} strokeWidth={2} />}
                />

                {!showPasswordFields ? (
                  <Pressable
                    onPress={handleChangePasswordPress}
                    accessibilityRole="button"
                    accessibilityLabel="Change password"
                  >
                    <View style={styles.changePasswordButton}>
                      <KeyRound size={15} color={COLORS.primaryDark} strokeWidth={2.2} />
                      <Text style={styles.changePasswordText}>Change Password</Text>
                    </View>
                  </Pressable>
                ) : (
                  <FadeIn>
                    <View style={styles.passwordSection}>
                      <ProfileInput
                        label="New Password"
                        placeholder="Enter a new password"
                        secureToggle
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="newPassword"
                        returnKeyType="next"
                        value={draft.newPassword}
                        onChangeText={handleChange('newPassword')}
                        error={errors.newPassword}
                        icon={(color) => <Lock size={20} color={color} strokeWidth={2} />}
                      />
                      <View style={styles.passwordSpacer} />
                      <ProfileInput
                        label="Confirm Password"
                        placeholder="Re-enter your new password"
                        secureToggle
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="newPassword"
                        returnKeyType="done"
                        onSubmitEditing={handleSave}
                        value={draft.confirmPassword}
                        onChangeText={handleChange('confirmPassword')}
                        error={errors.confirmPassword}
                        icon={(color) => <Lock size={20} color={color} strokeWidth={2} />}
                      />
                    </View>
                  </FadeIn>
                )}
              </View>

              {/* Footer actions */}
              {isEditing ? (
                <FadeIn key="edit-footer">
                  <ActionButton
                    title="Save Changes"
                    onPress={handleSave}
                    loading={saving}
                    disabled={saving}
                  />
                  <ActionButton
                    title="Cancel"
                    variant="secondary"
                    onPress={handleCancel}
                    disabled={saving}
                    style={styles.footerGap}
                  />
                </FadeIn>
              ) : (
                <FadeIn key="normal-footer">
                  <ActionButton
                    title="Logout"
                    variant="outline"
                    onPress={handleLogout}
                    loading={loggingOut}
                    disabled={loggingOut}
                    icon={(color) => <LogOut size={18} color={color} strokeWidth={2.2} />}
                  />
                  <Pressable
                    onPress={() => setDeleteDialogVisible(true)}
                    hitSlop={10}
                    style={styles.deleteAccountButton}
                    accessibilityRole="button"
                    accessibilityLabel="Delete account"
                  >
                    <Trash2 size={14} color={COLORS.error} strokeWidth={2.2} />
                    <Text style={styles.deleteAccountText}>Delete Account</Text>
                  </Pressable>
                </FadeIn>
              )}

              {/* Account meta */}
              <View style={styles.metaCard}>
                <View style={styles.metaTextBox}>
                  <Text style={styles.metaLabel}>ACCOUNT ID</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {profile.accountId}
                  </Text>
                </View>
                <Pressable
                  onPress={handleCopyAccountId}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Copy account ID"
                >
                  <View style={styles.copyButton}>
                    <Copy size={16} color={COLORS.primaryDark} strokeWidth={2.2} />
                  </View>
                </Pressable>
              </View>

              <Text style={styles.versionText}>Version {APP_VERSION}</Text>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      <DeleteAccountDialog
        visible={deleteDialogVisible}
        deleting={deleting}
        onCancel={() => setDeleteDialogVisible(false)}
        onConfirm={handleDeleteConfirm}
      />

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
    paddingTop: 8,
    paddingBottom: 40,
  },
  container: { width: '100%', maxWidth: 440, alignSelf: 'center' },

  // Back button
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#8A6D4A',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  // Header
  header: { alignItems: 'center', marginTop: 18, marginBottom: 26 },
  editButtonSlot: { position: 'absolute', top: 0, right: 0, zIndex: 2 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.primaryDark },

  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.primaryFaint,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    overflow: 'visible',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 52 },
  avatarInitials: { fontSize: 34, fontWeight: '700', color: COLORS.primaryDark, letterSpacing: 1 },
  avatarBadgeSlot: { position: 'absolute', bottom: 0, right: 0 },
  avatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  name: { marginTop: 16, fontSize: 24, fontWeight: '700', color: COLORS.text, letterSpacing: -0.3 },
  email: { marginTop: 4, fontSize: 15, color: COLORS.textMuted },
  memberChip: {
    marginTop: 12,
    backgroundColor: COLORS.blueSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  memberText: { fontSize: 12.5, fontWeight: '600', color: '#5B7BA6', letterSpacing: 0.2 },
  editingChip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  editingChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark },

  // Card + inputs
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    shadowColor: '#4A3F30',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  field: {},
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginLeft: 2 },
  labelMuted: { color: COLORS.textMuted },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  inputWrapperError: { borderColor: COLORS.error, backgroundColor: '#FFFBFA' },
  inputWrapperReadOnly: { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border },
  inputWrapperMuted: { backgroundColor: COLORS.track, borderColor: COLORS.track },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16, color: COLORS.text },
  inputReadOnly: { color: COLORS.text },
  inputMuted: { color: COLORS.textMuted },
  eyeButton: { marginLeft: 8, padding: 4 },
  lockBadge: { marginLeft: 8 },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -9,
    marginBottom: 14,
    marginLeft: 2,
  },
  errorText: { marginLeft: 5, fontSize: 13, fontWeight: '500', color: COLORS.error },

  // Change password
  changePasswordButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
  },
  changePasswordText: { fontSize: 14, fontWeight: '700', color: COLORS.primaryDark },
  passwordSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 20,
    marginTop: 4,
  },
  passwordSpacer: { height: 2 },

  // Buttons
  button: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button_primary: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  button_secondary: { backgroundColor: COLORS.track },
  button_outline: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  button_danger: { backgroundColor: '#DF6C57' },
  button_dangerText: { backgroundColor: 'transparent', height: 44 },
  buttonDisabled: { opacity: 0.55, shadowOpacity: 0, elevation: 0 },
  buttonText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  buttonTextWithIcon: { marginLeft: 9 },
  footerGap: { marginTop: 12 },

  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  deleteAccountText: { fontSize: 14.5, fontWeight: '600', color: COLORS.error },

  // Meta
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 30,
  },
  metaTextBox: { flex: 1, marginRight: 12 },
  metaLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: COLORS.textMuted },
  metaValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryFaint,
  },
  versionText: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '500',
    color: COLORS.textLight,
  },

  // Delete dialog
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45,41,38,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    shadowColor: '#4A3F30',
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  dialogIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.errorSoft,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: { marginTop: 16, fontSize: 20, fontWeight: '700', color: COLORS.text },
  dialogBody: {
    marginTop: 10,
    fontSize: 14.5,
    lineHeight: 21,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  dialogButtons: { flexDirection: 'row', gap: 12, marginTop: 24, alignSelf: 'stretch' },
  dialogButton: { flex: 1, height: 50 },
});