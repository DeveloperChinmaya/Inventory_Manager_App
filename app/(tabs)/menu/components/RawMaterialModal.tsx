/**
 * Menu/components/RawMaterialModal.tsx
 *
 * Bottom-sheet modal for adding a raw material to a menu item:
 *   1. Search + pick an inventory item
 *   2. Enter a quantity and choose a unit (constrained by the item's metric)
 *   3. Returns { inventoryItem, quantity, selectedUnit } to the parent
 *
 * Completely reusable — holds no menu-form state of its own beyond the
 * current selection, which resets on close.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '../utils/theme';
import { fetchInventoryItems } from '../utils/menu.data';
import { metricTypeLabel, unitsForMetric } from '../utils/menu.utils';
import type { InventoryItem, MetricType, Unit } from '../utils/menu.types';

export interface RawMaterialSelection {
  inventoryItem: InventoryItem;
  quantity: number;
  selectedUnit: Unit;
}

export interface RawMaterialModalProps {
  visible: boolean;
  /** Inventory items already added — hidden from the list to prevent duplicates. */
  excludedInventoryIds: string[];
  onAdd: (selection: RawMaterialSelection) => void;
  onClose: () => void;
}

export function RawMaterialModal({
  visible,
  excludedInventoryIds,
  onAdd,
  onClose,
}: RawMaterialModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<Unit | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  // Load inventory whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    let isMounted = true;
    setLoading(true);
    fetchInventoryItems()
      .then((result) => {
        if (isMounted) setItems(result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [visible]);

  const resetAndClose = useCallback(() => {
    setSearch('');
    setSelectedItem(null);
    setQuantity('');
    setUnit(null);
    setQuantityError(null);
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        !excludedInventoryIds.includes(item.id) &&
        (!query || item.name.toLowerCase().includes(query)),
    );
  }, [items, excludedInventoryIds, search]);

  const availableUnits = useMemo<Unit[]>(
    () => (selectedItem ? unitsForMetric(selectedItem.metricType) : []),
    [selectedItem],
  );

  const handleSelectItem = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setUnit(unitsForMetric(item.metricType)[0]);
    setQuantityError(null);
  }, []);

  const handleQuantityChange = useCallback((text: string) => {
    setQuantity(text.replace(/[^0-9.]/g, ''));
    setQuantityError(null);
  }, []);

  const handleAdd = useCallback(() => {
    if (!selectedItem) return;
    const parsed = Number(quantity);
    if (!quantity.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setQuantityError('Enter a quantity greater than 0.');
      return;
    }
    if (!unit) return;
    onAdd({ inventoryItem: selectedItem, quantity: parsed, selectedUnit: unit });
    resetAndClose();
  }, [selectedItem, quantity, unit, onAdd, resetAndClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={resetAndClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={resetAndClose} accessible={false}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.title}>Add Raw Material</Text>
              <Pressable
                onPress={resetAndClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <View style={styles.closeButton}>
                  <X size={18} color={COLORS.textMuted} strokeWidth={2.4} />
                </View>
              </Pressable>
            </View>

            {!selectedItem ? (
              <>
                {/* Search */}
                <View style={styles.searchWrapper}>
                  <Search size={17} color={COLORS.textMuted} strokeWidth={2.2} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search inventory..."
                    placeholderTextColor={COLORS.textLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>

                {/* Inventory list */}
                {loading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator color={COLORS.primary} />
                  </View>
                ) : (
                  <ScrollView
                    style={styles.list}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {filteredItems.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => handleSelectItem(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${item.name}`}
                      >
                        <View style={styles.inventoryRow}>
                          <View style={styles.inventoryIcon}>
                            <MaterialIcons
                              name="inventory-2"
                              size={18}
                              color={COLORS.primaryDark}
                            />
                          </View>
                          <View style={styles.inventoryTextBox}>
                            <Text style={styles.inventoryName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.inventoryMetric}>
                              {metricTypeLabel(item.metricType)}
                            </Text>
                          </View>
                          <MaterialIcons
                            name="chevron-right"
                            size={20}
                            color={COLORS.textLight}
                          />
                        </View>
                      </Pressable>
                    ))}
                    {filteredItems.length === 0 && (
                      <Text style={styles.emptyText}>
                        {search.trim()
                          ? 'No inventory items match your search.'
                          : 'All inventory items have been added.'}
                      </Text>
                    )}
                  </ScrollView>
                )}
              </>
            ) : (
              <>
                {/* Selected item summary */}
                <Pressable
                  onPress={() => setSelectedItem(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Change inventory item"
                >
                  <View style={styles.selectedSummary}>
                    <ChevronLeft size={18} color={COLORS.primaryDark} strokeWidth={2.4} />
                    <View style={styles.inventoryTextBox}>
                      <Text style={styles.inventoryName} numberOfLines={1}>
                        {selectedItem.name}
                      </Text>
                      <Text style={styles.inventoryMetric}>
                        {metricTypeLabel(selectedItem.metricType)} • tap to change
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {/* Quantity */}
                <Text style={styles.fieldLabel}>Quantity</Text>
                <View
                  style={[styles.quantityWrapper, quantityError ? styles.quantityWrapperError : null]}
                >
                  <TextInput
                    style={styles.quantityInput}
                    placeholder="0"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleAdd}
                    value={quantity}
                    onChangeText={handleQuantityChange}
                  />
                </View>
                {quantityError ? (
                  <View style={styles.errorRow}>
                    <MaterialIcons name="error-outline" size={14} color={COLORS.error} />
                    <Text style={styles.errorText}>{quantityError}</Text>
                  </View>
                ) : null}

                {/* Unit selector (constrained by metric type) */}
                <Text style={styles.fieldLabel}>Unit</Text>
                <View style={styles.unitRow}>
                  {availableUnits.map((option) => {
                    const active = unit === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setUnit(option)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <View style={[styles.unitChip, active && styles.unitChipActive]}>
                          <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>
                            {option}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={resetAndClose}
                    style={[styles.actionButton, styles.cancelButton]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAdd}
                    style={[styles.actionButton, styles.addButton]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(45,41,38,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    maxHeight: '86%',
    shadowColor: '#4A3F30',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, letterSpacing: -0.3 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.track,
  },

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchInput: { flex: 1, height: '100%', marginLeft: 10, fontSize: 15, color: COLORS.text },

  loadingBox: { paddingVertical: 48, alignItems: 'center' },
  list: { maxHeight: 380 },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  inventoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inventoryTextBox: { flex: 1, marginRight: 8 },
  inventoryName: { fontSize: 15.5, fontWeight: '600', color: COLORS.text },
  inventoryMetric: { marginTop: 2, fontSize: 12.5, color: COLORS.textMuted },
  emptyText: {
    paddingVertical: 32,
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.textMuted,
  },

  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 18,
  },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginLeft: 2 },
  quantityWrapper: {
    height: 54,
    borderRadius: 14,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  quantityWrapperError: { borderColor: COLORS.error, backgroundColor: '#FFFBFA' },
  quantityInput: { fontSize: 16, color: COLORS.text, height: '100%' },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7, marginLeft: 2 },
  errorText: { marginLeft: 5, fontSize: 13, fontWeight: '500', color: COLORS.error },

  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2, marginBottom: 22 },
  unitChip: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.track,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  unitChipActive: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  unitChipText: { fontSize: 14.5, fontWeight: '600', color: COLORS.textMuted },
  unitChipTextActive: { color: COLORS.primaryDark, fontWeight: '700' },

  actionsRow: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { backgroundColor: COLORS.track },
  cancelButtonText: { fontSize: 15.5, fontWeight: '700', color: COLORS.text },
  addButton: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  addButtonText: { fontSize: 15.5, fontWeight: '700', color: COLORS.white },
});

export default RawMaterialModal;