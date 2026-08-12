/**
 * Inventory/components/InventoryItemForm.tsx
 *
 * Shared create/edit form — the single source of truth for inventory item
 * definitions. `create.tsx` and `edit/[id].tsx` only choose the mode.
 *
 *   mode="create" → empty fields, "Create Inventory Item"
 *   mode="edit"   → prefilled fields, read-only stock state,
 *                   "Save Changes" + confirmed delete
 *
 * NOTE: this form edits the item DEFINITION only. Stock values are rendered
 * read-only and are never modified — stock moves exclusively through
 * Purchase Bills (+) and Sales Bills (−).
 *
 * Keyboard fix: the entire form region (all TextInputs and their ancestors)
 * is a static, un-animated view tree. The expiry-duration section now mounts
 * conditionally as a plain View instead of an opacity/translateY animation,
 * and focus styles change color only — so input focus and the keyboard are
 * never interrupted.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  Package,
  Trash2,
} from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import ImagePickerField from './ImagePicker';
import StockEntriesList from './StockEntriesList';
import UniversalToast from '@/ui-components/UniversalToast';
import type { ToastType } from '@/ui-components/UniversalToast';
import { COLORS } from '../utils/theme';
import {
  createInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
} from '../utils/inventory.data';
import { formatQuantity, metricTypeLabel, totalActiveStock } from '../utils/inventory.utils';
import type { InventoryItemPayload, InventoryItemWithStock, MetricType } from '../utils/inventory.types';

/* ---------------------------------- Types ---------------------------------- */

export interface InventoryItemFormProps {
  mode: 'create' | 'edit';
  /** Required in edit mode — the item (with read-only stock state). */
  initialItem?: InventoryItemWithStock;
}

interface FormErrors {
  name?: string;
  metricType?: string;
  expiryDays?: string;
}

interface ToastPayload {
  id: number;
  type: ToastType;
  msg: string;
}

const METRIC_OPTIONS: ReadonlyArray<{ value: MetricType; label: string; hint: string }> = [
  { value: 'pieces', label: 'Pieces', hint: 'PCS' },
  { value: 'weight', label: 'Weight', hint: 'GRAM · KG' },
  { value: 'volume', label: 'Volume', hint: 'ML · L' },
];

/* ------------------------------ Delete dialog ------------------------------ */

interface DeleteDialogProps {
  visible: boolean;
  deleting: boolean;
  itemName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteDialog({
  visible,
  deleting,
  itemName,
  onCancel,
  onConfirm,
}: DeleteDialogProps): React.JSX.Element {
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

        <View style={styles.dialogCard}>
          <View style={styles.dialogIconCircle}>
            <AlertTriangle size={26} color={COLORS.error} strokeWidth={2.2} />
          </View>
          <Text style={styles.dialogTitle}>Delete Inventory Item?</Text>
          <Text style={styles.dialogBody}>
            “{itemName}” will be permanently deleted. Menu items referencing it may need to be
            updated. This action cannot be undone.
          </Text>
          <View style={styles.dialogButtons}>
            <Pressable
              onPress={onCancel}
              disabled={deleting}
              style={[styles.dialogButton, styles.dialogButtonSecondary]}
              accessibilityRole="button"
            >
              <Text style={styles.dialogButtonSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={deleting}
              style={[styles.dialogButton, styles.dialogButtonDanger]}
              accessibilityRole="button"
            >
              {deleting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.dialogButtonDangerText}>Delete</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------------------------- Form ----------------------------------- */

export function InventoryItemForm({ mode, initialItem }: InventoryItemFormProps): React.JSX.Element {
  const router = useRouter();
  const isEdit = mode === 'edit';

  const [name, setName] = useState(initialItem?.name ?? '');
  const [imageUri, setImageUri] = useState<string | null>(initialItem?.image ?? null);
  const [metricType, setMetricType] = useState<MetricType | null>(initialItem?.metricType ?? null);
  const [perishable, setPerishable] = useState<boolean>(initialItem?.perishable ?? false);
  const [expiryDays, setExpiryDays] = useState(
    initialItem?.expiryDurationDays != null ? String(initialItem.expiryDurationDays) : '',
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [nameFocused, setNameFocused] = useState(false);
  const [expiryFocused, setExpiryFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const handleNameChange = useCallback((text: string) => {
    setName(text);
    setErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev));
  }, []);

  const handleExpiryChange = useCallback((text: string) => {
    setExpiryDays(text.replace(/[^0-9]/g, ''));
    setErrors((prev) => (prev.expiryDays ? { ...prev, expiryDays: undefined } : prev));
  }, []);

  const handleSelectMetric = useCallback((value: MetricType) => {
    setMetricType(value);
    setErrors((prev) => (prev.metricType ? { ...prev, metricType: undefined } : prev));
  }, []);

  const handlePerishableChange = useCallback((value: boolean) => {
    setPerishable(value);
    if (!value) setErrors((prev) => ({ ...prev, expiryDays: undefined }));
  }, []);

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Item name is required.';
    if (!metricType) next.metricType = 'Select a metric type.';
    if (perishable) {
      const days = Number(expiryDays);
      if (!expiryDays.trim()) {
        next.expiryDays = 'Expiry duration is required.';
      } else if (Number.isNaN(days) || days <= 0) {
        next.expiryDays = 'Expiry duration must be greater than zero.';
      }
    }
    return next;
  }, [name, metricType, perishable, expiryDays]);

  const handleSubmit = useCallback(async () => {
    if (submitting || !metricType) {
      // Still run validation to surface the metric error when unselected.
      if (!submitting) setErrors(validate());
      return;
    }
    Keyboard.dismiss();

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const payload: InventoryItemPayload = {
      name: name.trim(),
      image: imageUri,
      metricType,
      perishable,
      expiryDurationDays: perishable ? Number(expiryDays) : null,
    };

    setSubmitting(true);
    try {
      if (isEdit && initialItem) {
        await updateInventoryItem(initialItem.id, payload);
        showToast('success', 'Inventory item updated');
      } else {
        await createInventoryItem(payload);
        showToast('success', 'Inventory item created');
      }
      setTimeout(() => {
        if (router.canGoBack()) router.back();
      }, 700);
    } catch {
      showToast('error', "We couldn't save this item. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, metricType, validate, isEdit, initialItem, name, imageUri, perishable, expiryDays, router, showToast]);

  const handleDelete = useCallback(async () => {
    if (deleting || !initialItem) return;
    setDeleting(true);
    try {
      await deleteInventoryItem(initialItem.id);
      setDeleteDialogVisible(false);
      showToast('success', 'Inventory item deleted');
      setTimeout(() => {
        if (router.canGoBack()) router.back();
      }, 700);
    } catch {
      setDeleteDialogVisible(false);
      showToast('error', "We couldn't delete this item. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [deleting, initialItem, router, showToast]);

  const activeStock = initialItem
    ? initialItem.perishable
      ? totalActiveStock(initialItem.stockEntries)
      : (initialItem.currentStock ?? 0)
    : 0;

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
          <View style={styles.container}>
            {/* Back */}
            <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
              <View style={styles.backButton}>
                <ChevronLeft size={22} color={COLORS.text} strokeWidth={2.2} />
              </View>
            </Pressable>

            <Text style={styles.title}>{isEdit ? 'Edit Item' : 'New Item'}</Text>
            <Text style={styles.subtitle}>
              {isEdit ? 'Update this inventory item.' : 'Define a new ingredient for your store.'}
            </Text>

            {/* Image */}
            <ImagePickerField value={imageUri} onChange={setImageUri} onError={(msg) => showToast('error', msg)} />

            {/* Name */}
            <Text style={styles.label}>Item Name</Text>
            <View
              style={[
                styles.inputWrapper,
                nameFocused && styles.inputWrapperFocused,
                errors.name ? styles.inputWrapperError : null,
              ]}
            >
              <Package
                size={20}
                color={errors.name ? COLORS.error : nameFocused ? COLORS.primaryDark : COLORS.textMuted}
                strokeWidth={2}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Tomato Ketchup"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="words"
                returnKeyType="next"
                value={name}
                onChangeText={handleNameChange}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>
            {errors.name ? (
              <View style={styles.errorRow}>
                <MaterialIcons name="error-outline" size={14} color={COLORS.error} />
                <Text style={styles.errorText}>{errors.name}</Text>
              </View>
            ) : null}

            {/* Metric type */}
            <Text style={[styles.label, styles.sectionLabel]}>Metric Type</Text>
            <View style={styles.optionRow}>
              {METRIC_OPTIONS.map((option) => {
                const active = metricType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => handleSelectMetric(option.value)}
                    style={styles.optionSlot}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.optionCard, active && styles.optionCardActive]}>
                      <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionHint}>{option.hint}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {errors.metricType ? (
              <View style={styles.errorRow}>
                <MaterialIcons name="error-outline" size={14} color={COLORS.error} />
                <Text style={styles.errorText}>{errors.metricType}</Text>
              </View>
            ) : null}

            {/* Perishable */}
            <Text style={[styles.label, styles.sectionLabel]}>Perishable</Text>
            <View style={styles.segmentTrack}>
              {([false, true] as const).map((value) => {
                const active = perishable === value;
                return (
                  <Pressable
                    key={String(value)}
                    onPress={() => handlePerishableChange(value)}
                    style={styles.segmentOption}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.segmentPill, active && styles.segmentPillActive]}>
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {value ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Expiry duration — conditionally mounted static View (no animation). */}
            {perishable && (
              <View>
                <Text style={[styles.label, styles.sectionLabel]}>Expiry Duration</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    expiryFocused && styles.inputWrapperFocused,
                    errors.expiryDays ? styles.inputWrapperError : null,
                  ]}
                >
                  <CalendarClock
                    size={20}
                    color={
                      errors.expiryDays
                        ? COLORS.error
                        : expiryFocused
                          ? COLORS.primaryDark
                          : COLORS.textMuted
                    }
                    strokeWidth={2}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 10"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    value={expiryDays}
                    onChangeText={handleExpiryChange}
                    onFocus={() => setExpiryFocused(true)}
                    onBlur={() => setExpiryFocused(false)}
                  />
                  <Text style={styles.inputSuffix}>Days</Text>
                </View>
                {errors.expiryDays ? (
                  <View style={styles.errorRow}>
                    <MaterialIcons name="error-outline" size={14} color={COLORS.error} />
                    <Text style={styles.errorText}>{errors.expiryDays}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Read-only stock state (edit mode) */}
            {isEdit && initialItem && (
              <View style={styles.stockCard}>
                <View style={styles.stockCardHeader}>
                  <Text style={styles.stockCardTitle}>Current Stock</Text>
                  <View style={styles.readOnlyChip}>
                    <MaterialIcons name="lock-outline" size={11} color={COLORS.textMuted} />
                    <Text style={styles.readOnlyChipText}>Read-only</Text>
                  </View>
                </View>
                <Text style={styles.stockCardValue}>
                  {formatQuantity(activeStock, initialItem.metricType)}
                  <Text style={styles.stockCardMetric}> · {metricTypeLabel(initialItem.metricType)}</Text>
                </Text>

                {initialItem.perishable && (
                  <>
                    <View style={styles.stockCardDivider} />
                    <StockEntriesList
                      entries={initialItem.stockEntries}
                      metricType={initialItem.metricType}
                      readOnly
                    />
                  </>
                )}
                <Text style={styles.stockCardHint}>
                  Stock changes only through Purchase and Sales Bills.
                </Text>
              </View>
            )}

            {/* Bottom actions */}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={styles.primaryShadow}
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting, busy: submitting }}
            >
              <View style={[styles.primaryButton, submitting && styles.buttonDisabled]}>
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {isEdit ? 'Save Changes' : 'Create Inventory Item'}
                  </Text>
                )}
              </View>
            </Pressable>

            {isEdit && (
              <Pressable
                onPress={() => setDeleteDialogVisible(true)}
                disabled={submitting}
                style={styles.deleteButton}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Delete inventory item"
              >
                <Trash2 size={15} color={COLORS.error} strokeWidth={2.2} />
                <Text style={styles.deleteButtonText}>Delete Inventory Item</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DeleteDialog
        visible={deleteDialogVisible}
        deleting={deleting}
        itemName={initialItem?.name ?? ''}
        onCancel={() => setDeleteDialogVisible(false)}
        onConfirm={handleDelete}
      />

      {toast && (
        <UniversalToast key={toast.id} type={toast.type} msg={toast.msg} onDismiss={hideToast} />
      )}
    </SafeAreaView>
  );
}

/* ---------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 44 },
  container: { width: '100%', maxWidth: 440, alignSelf: 'center' },

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
  title: { marginTop: 20, fontSize: 28, fontWeight: '700', color: COLORS.text, letterSpacing: -0.4 },
  subtitle: { marginTop: 6, marginBottom: 24, fontSize: 15, color: COLORS.textMuted },

  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginLeft: 2 },
  sectionLabel: { marginTop: 20 },
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
  inputSuffix: { marginLeft: 10, fontSize: 14.5, fontWeight: '600', color: COLORS.textMuted },

  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7, marginLeft: 2 },
  errorText: { marginLeft: 5, fontSize: 13, fontWeight: '500', color: COLORS.error },

  // Metric options
  optionRow: { flexDirection: 'row', gap: 10 },
  optionSlot: { flex: 1 },
  optionCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  optionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
  },
  optionTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.textMuted },
  optionTitleActive: { color: COLORS.primaryDark },
  optionHint: { marginTop: 3, fontSize: 10.5, fontWeight: '600', color: COLORS.textLight, letterSpacing: 0.3 },

  // Perishable segment
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: COLORS.track,
    borderRadius: 14,
    padding: 4,
  },
  segmentOption: { flex: 1 },
  segmentPill: {
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#8A6D4A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontSize: 14.5, fontWeight: '600', color: COLORS.textMuted },
  segmentTextActive: { color: COLORS.text, fontWeight: '700' },

  // Read-only stock card
  stockCard: {
    marginTop: 26,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  stockCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stockCardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.6 },
  readOnlyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.track,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  readOnlyChipText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  stockCardValue: { marginTop: 10, fontSize: 24, fontWeight: '700', color: COLORS.text },
  stockCardMetric: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  stockCardDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  stockCardHint: { marginTop: 12, fontSize: 12.5, color: COLORS.textLight },

  // Buttons
  primaryShadow: {
    marginTop: 30,
    borderRadius: 16,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  deleteButton: {
    marginTop: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteButtonText: { fontSize: 14.5, fontWeight: '600', color: COLORS.error },

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
  dialogButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogButtonSecondary: { backgroundColor: COLORS.track },
  dialogButtonSecondaryText: { fontSize: 15.5, fontWeight: '700', color: COLORS.text },
  dialogButtonDanger: { backgroundColor: '#DF6C57' },
  dialogButtonDangerText: { fontSize: 15.5, fontWeight: '700', color: COLORS.white },
});

export default InventoryItemForm;