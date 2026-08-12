/**
 * Menu/components/MenuItemForm.tsx
 *
 * Shared create/edit form — the single source of truth for menu item
 * editing. `create.tsx` and `edit/[id].tsx` only choose the mode.
 *
 *   mode="create" → empty fields, "Create Item"
 *   mode="edit"   → prefilled fields, "Save Changes" + confirmed delete
 *
 * Keyboard fix: the entire form region (all TextInputs and their ancestors)
 * is a static, un-animated view tree. Focus styles change border/background
 * color only (no elevation/shadow re-composite), so input focus — and the
 * keyboard — is never interrupted.
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
  ChevronLeft,
  IndianRupee,
  Plus,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import ImagePickerField from './ImagePicker';
import RawMaterialModal from './RawMaterialModal';
import RawMaterialRow from './RawMaterialRow';
import UniversalToast from '@/ui-components/UniversalToast';
import type { ToastType } from '@/ui-components/UniversalToast';
import { COLORS } from '../utils/theme';
import { createMenuItem, deleteMenuItem, updateMenuItem } from '../utils/menu.data';
import { toBaseQuantity } from '../utils/menu.utils';
import type { MenuItem } from '../utils/menu.types';
import type { RawMaterialSelection } from './RawMaterialModal';

/* ---------------------------------- Types --------------------------------- */

export interface MenuItemFormProps {
  mode: 'create' | 'edit';
  /** Required in edit mode — the item being modified. */
  initialItem?: MenuItem;
}

interface MaterialDraft {
  key: string;
  inventoryItemId: string;
  inventoryName: string;
  metricType: 'pieces' | 'weight' | 'volume';
  baseQuantity: number;
}

interface FormErrors {
  name?: string;
  price?: string;
  materials?: string;
}

interface ToastPayload {
  id: number;
  type: ToastType;
  msg: string;
}

let draftKeyCounter = 0;

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
          <Text style={styles.dialogTitle}>Delete Item?</Text>
          <Text style={styles.dialogBody}>
            “{itemName}” will be permanently removed from your menu. This action cannot be undone.
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

export function MenuItemForm({ mode, initialItem }: MenuItemFormProps): React.JSX.Element {
  const router = useRouter();
  const isEdit = mode === 'edit';

  const [name, setName] = useState(initialItem?.name ?? '');
  const [price, setPrice] = useState(initialItem ? String(initialItem.price) : '');
  const [imageUri, setImageUri] = useState<string | null>(initialItem?.image ?? null);
  const [materials, setMaterials] = useState<MaterialDraft[]>(() =>
    (initialItem?.rawMaterials ?? []).map((material) => ({
      key: `${material.inventoryItemId}-${(draftKeyCounter += 1)}`,
      inventoryItemId: material.inventoryItemId,
      inventoryName: material.inventoryName ?? material.inventoryItemId,
      metricType: material.metricType ?? 'pieces',
      baseQuantity: material.baseQuantity,
    })),
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [nameFocused, setNameFocused] = useState(false);
  const [priceFocused, setPriceFocused] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
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

  const handlePriceChange = useCallback((text: string) => {
    setPrice(text.replace(/[^0-9.]/g, ''));
    setErrors((prev) => (prev.price ? { ...prev, price: undefined } : prev));
  }, []);

  const handleAddMaterial = useCallback((selection: RawMaterialSelection) => {
    setMaterials((prev) => [
      ...prev,
      {
        key: `${selection.inventoryItem.id}-${Date.now()}`,
        inventoryItemId: selection.inventoryItem.id,
        inventoryName: selection.inventoryItem.name,
        metricType: selection.inventoryItem.metricType,
        baseQuantity: toBaseQuantity(
          selection.quantity,
          selection.selectedUnit,
          selection.inventoryItem.metricType,
        ),
      },
    ]);
    setErrors((prev) => (prev.materials ? { ...prev, materials: undefined } : prev));
  }, []);

  const handleRemoveMaterial = useCallback((key: string) => {
    setMaterials((prev) => prev.filter((material) => material.key !== key));
  }, []);

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Item name is required.';

    const parsedPrice = Number(price);
    if (!price.trim()) {
      next.price = 'Price is required.';
    } else if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      next.price = 'Price must be greater than 0.';
    }

    if (materials.length === 0) {
      next.materials = 'Add at least one raw material.';
    }
    return next;
  }, [name, price, materials]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    Keyboard.dismiss();

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const payload = {
      name: name.trim(),
      price: Number(price),
      image: imageUri,
      rawMaterials: materials.map(({ inventoryItemId, inventoryName, metricType, baseQuantity }) => ({
        inventoryItemId,
        inventoryName,
        metricType,
        baseQuantity,
      })),
    };

    setSubmitting(true);
    try {
      if (isEdit && initialItem) {
        await updateMenuItem(initialItem.id, payload);
        showToast('success', 'Menu item updated');
      } else {
        await createMenuItem(payload);
        showToast('success', 'Menu item created');
      }
      setTimeout(() => {
        if (router.canGoBack()) router.back();
      }, 700);
    } catch {
      showToast('error', "We couldn't save this item. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, validate, isEdit, initialItem, name, price, imageUri, materials, router, showToast]);

  const handleDelete = useCallback(async () => {
    if (deleting || !initialItem) return;
    setDeleting(true);
    try {
      await deleteMenuItem(initialItem.id);
      setDeleteDialogVisible(false);
      showToast('success', 'Menu item deleted');
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

  const excludedInventoryIds = materials.map((material) => material.inventoryItemId);

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
              {isEdit ? 'Update this menu item.' : 'Add a dish to your menu.'}
            </Text>

            {/* Image */}
            <ImagePickerField value={imageUri} onChange={setImageUri} />

            {/* Name */}
            <Text style={styles.label}>Item Name</Text>
            <View
              style={[
                styles.inputWrapper,
                nameFocused && styles.inputWrapperFocused,
                errors.name ? styles.inputWrapperError : null,
              ]}
            >
              <UtensilsCrossed
                size={20}
                color={errors.name ? COLORS.error : nameFocused ? COLORS.primaryDark : COLORS.textMuted}
                strokeWidth={2}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Chicken Burger"
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

            {/* Price */}
            <Text style={styles.label}>Price</Text>
            <View
              style={[
                styles.inputWrapper,
                priceFocused && styles.inputWrapperFocused,
                errors.price ? styles.inputWrapperError : null,
              ]}
            >
              <IndianRupee
                size={19}
                color={errors.price ? COLORS.error : priceFocused ? COLORS.primaryDark : COLORS.textMuted}
                strokeWidth={2.2}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={COLORS.textLight}
                keyboardType="decimal-pad"
                returnKeyType="done"
                value={price}
                onChangeText={handlePriceChange}
                onFocus={() => setPriceFocused(true)}
                onBlur={() => setPriceFocused(false)}
              />
            </View>
            {errors.price ? (
              <View style={styles.errorRow}>
                <MaterialIcons name="error-outline" size={14} color={COLORS.error} />
                <Text style={styles.errorText}>{errors.price}</Text>
              </View>
            ) : null}

            {/* Raw materials */}
            <View style={styles.materialsHeader}>
              <Text style={styles.label}>Raw Materials</Text>
              <View style={styles.materialsChip}>
                <Text style={styles.materialsChipText}>{materials.length}</Text>
              </View>
            </View>

            {/* Static list — no Animated wrapper around the rows. */}
            <View>
              {materials.map((material) => (
                <RawMaterialRow
                  key={material.key}
                  name={material.inventoryName}
                  baseQuantity={material.baseQuantity}
                  metricType={material.metricType}
                  onDelete={() => handleRemoveMaterial(material.key)}
                />
              ))}
            </View>

            {errors.materials ? (
              <View style={styles.errorRow}>
                <MaterialIcons name="error-outline" size={14} color={COLORS.error} />
                <Text style={styles.errorText}>{errors.materials}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => setModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Add raw material"
            >
              <View style={styles.addMaterialButton}>
                <Plus size={17} color={COLORS.primaryDark} strokeWidth={2.6} />
                <Text style={styles.addMaterialText}>Add Raw Material</Text>
              </View>
            </Pressable>

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
                    {isEdit ? 'Save Changes' : 'Create Item'}
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
                accessibilityLabel="Delete item"
              >
                <Trash2 size={15} color={COLORS.error} strokeWidth={2.2} />
                <Text style={styles.deleteButtonText}>Delete Item</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <RawMaterialModal
        visible={modalVisible}
        excludedInventoryIds={excludedInventoryIds}
        onClose={() => setModalVisible(false)}
        onAdd={handleAddMaterial}
      />

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

  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7, marginBottom: 4, marginLeft: 2 },
  errorText: { marginLeft: 5, fontSize: 13, fontWeight: '500', color: COLORS.error },

  materialsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  materialsChip: {
    marginLeft: 8,
    marginBottom: 6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
  },
  materialsChipText: { fontSize: 12.5, fontWeight: '700', color: COLORS.primaryDark },

  addMaterialButton: {
    height: 52,
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  addMaterialText: { fontSize: 15, fontWeight: '700', color: COLORS.primaryDark },

  primaryShadow: {
    marginTop: 28,
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
    borderColor: '#F2D5CA',
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

export default MenuItemForm;