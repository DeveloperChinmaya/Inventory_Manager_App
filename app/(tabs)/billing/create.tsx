/**
 * Billing/create.tsx (CreateBillScreen)
 *
 * Fast invoice creation. Sale (green) and Purchase (blue) modes share the
 * same screen and BillItemCard; the type toggle swaps party field, list
 * source and accents. Tapping a card increments quantity instantly, the
 * summary updates live, and the Create button stays fixed at the bottom.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ChevronLeft, ShoppingBag, Truck, User } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import BillItemCard from './components/BillItemCard';
import UniversalToast from '@/ui-components/UniversalToast';
import type { ToastType } from '@/ui-components/UniversalToast';
import { COLORS } from './utils/theme';
import {
  createBill,
  fetchBillingInventoryItems,
  fetchBillingMenuItems,
} from './utils/billing.data';
import type { CreateBillLineInput } from './utils/billing.data';
import { formatINR, unitsForMetric } from './utils/billing.utils';
import type { BillingInventoryItem, BillingMenuItem, BillType, Unit } from './utils/billing.types';

interface ToastPayload {
  id: number;
  type: ToastType;
  msg: string;
}

interface SelectionEntry {
  quantity: number;
  unit: Unit;
}

export default function CreateBillScreen(): React.JSX.Element {
  const router = useRouter();

  const [billType, setBillType] = useState<BillType>('sale');
  const [partyName, setPartyName] = useState('');
  const [partyFocused, setPartyFocused] = useState(false);

  const [menuItems, setMenuItems] = useState<BillingMenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<BillingInventoryItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  /** Keyed by menu/inventory item id; persists across type switches. */
  const [selections, setSelections] = useState<Record<string, SelectionEntry>>({});

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const summaryScale = useRef(new Animated.Value(1)).current;
  const toggleAnim = useRef(new Animated.Value(0)).current; // 0 = sale, 1 = purchase

  const isSale = billType === 'sale';
  const accent = isSale ? COLORS.sale : COLORS.purchase;
  const accentSoft = isSale ? COLORS.saleSoft : COLORS.purchaseSoft;
  const accentText = isSale ? COLORS.saleText : COLORS.purchaseText;

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToast({ id: Date.now(), type, msg });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  const insets = useSafeAreaInsets();
// Keep the fixed bottom bar above the floating glass tab bar.
const tabBarClearance = Math.max(insets.bottom, 10) + 6 + 66 + 16;

  /* ------------------------------- Data load ------------------------------- */

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [menu, inventory] = await Promise.all([
          fetchBillingMenuItems(),
          fetchBillingInventoryItems(),
        ]);
        if (!isMounted) return;
        setMenuItems(menu);
        setInventoryItems(inventory);
      } catch {
        if (isMounted) showToast('error', "We couldn't load items. Please go back and retry.");
      } finally {
        if (isMounted) setLoadingList(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  /* ------------------------------ Type toggle ------------------------------ */

  const handleTypeChange = useCallback(
    (next: BillType) => {
      if (next === billType) return;
      setBillType(next);
      setValidationError(null);
      Animated.spring(toggleAnim, {
        toValue: next === 'sale' ? 0 : 1,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
      }).start();
    },
    [billType, toggleAnim],
  );

  /* ------------------------------ Selections ------------------------------- */

  const defaultUnitFor = useCallback(
    (refId: string): Unit => {
      const item = inventoryItems.find((inv) => inv.id === refId);
      return item ? unitsForMetric(item.metricType)[0] : 'PCS';
    },
    [inventoryItems],
  );

  const handleQuantityChange = useCallback(
    (refId: string, quantity: number) => {
      setSelections((prev) => ({
        ...prev,
        [refId]: { quantity, unit: prev[refId]?.unit ?? defaultUnitFor(refId) },
      }));
      setValidationError(null);
      summaryScale.setValue(1.06);
      Animated.spring(summaryScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 240,
      }).start();
    },
    [defaultUnitFor, summaryScale],
  );

  const handleUnitChange = useCallback((refId: string, unit: Unit) => {
    setSelections((prev) => ({
      ...prev,
      [refId]: { quantity: prev[refId]?.quantity ?? 0, unit },
    }));
  }, []);

  /* -------------------------------- Summary -------------------------------- */

  const summary = useMemo(() => {
    let itemCount = 0;
    let total = 0;

    if (isSale) {
      for (const item of menuItems) {
        const qty = selections[item.id]?.quantity ?? 0;
        if (qty > 0) {
          itemCount += qty;
          total += qty * item.price;
        }
      }
    } else {
      for (const item of inventoryItems) {
        const qty = selections[item.id]?.quantity ?? 0;
        if (qty > 0) {
          itemCount += qty;
          total += qty * (item.purchasePrice ?? 0);
        }
      }
    }
    return { itemCount, total };
  }, [isSale, menuItems, inventoryItems, selections]);

  /* -------------------------------- Submit --------------------------------- */

  const handleCreate = useCallback(async () => {
    if (submitting) return;
    Keyboard.dismiss();

    const rawLines: CreateBillLineInput[] = Object.entries(selections)
      .filter(([, entry]) => entry.quantity > 0)
      .map(([refId, entry]) => ({ refId, quantity: entry.quantity, unit: entry.unit }));

    if (rawLines.length === 0) {
      setValidationError(
        isSale ? 'Add at least one menu item.' : 'Add at least one inventory item.',
      );
      return;
    }
    setValidationError(null);
    setSubmitting(true);

    try {
      const bill = await createBill(billType, partyName, rawLines);
      showToast('success', `${isSale ? 'Sale' : 'Purchase'} invoice created`);
      setTimeout(() => router.replace(`./billing/receipt/${bill.id}`), 650);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't create this bill.";
      showToast('error', message);
      setSubmitting(false);
    }
  }, [submitting, selections, billType, partyName, isSale, router, showToast]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  /* --------------------------------- Render --------------------------------- */

  const listData = isSale ? menuItems : inventoryItems;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View>
                {/* Back */}
                <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
                  <View style={styles.backButton}>
                    <ChevronLeft size={22} color={COLORS.text} strokeWidth={2.2} />
                  </View>
                </Pressable>

                <Text style={styles.title}>Create Bill</Text>

                {/* Invoice type toggle */}
                <View style={styles.toggleTrack}>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.togglePill,
                      {
                        backgroundColor: accentSoft,
                        borderColor: accent,
                        transform: [
                          {
                            translateX: toggleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 1], // multiplied by measured width via percentage below
                            }),
                          },
                        ],
                        left: toggleAnim.interpolate({ inputRange: [0, 1], outputRange: ['2%', '50%'] }),
                      },
                    ]}
                  />
                  {(
                    [
                      { key: 'sale', label: 'Sale Invoice', icon: ShoppingBag },
                      { key: 'purchase', label: 'Purchase Invoice', icon: Truck },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => {
                    const active = billType === key;
                    const color = active
                      ? key === 'sale'
                        ? COLORS.saleText
                        : COLORS.purchaseText
                      : COLORS.textMuted;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => handleTypeChange(key)}
                        style={styles.toggleOption}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Icon size={16} color={color} strokeWidth={2.2} />
                        <Text style={[styles.toggleLabel, active && { color, fontWeight: '800' }]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Party name */}
                <Text style={styles.label}>{isSale ? 'Customer Name' : 'Supplier Name'}</Text>
                <View
                  style={[styles.inputWrapper, partyFocused && { borderColor: accent, backgroundColor: COLORS.surface }]}
                >
                  <User size={19} color={partyFocused ? accent : COLORS.textMuted} strokeWidth={2} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={isSale ? 'Walk-in Customer' : 'e.g. Fresh Farms'}
                    placeholderTextColor={COLORS.textLight}
                    autoCapitalize="words"
                    returnKeyType="done"
                    value={partyName}
                    onChangeText={setPartyName}
                    onFocus={() => setPartyFocused(true)}
                    onBlur={() => setPartyFocused(false)}
                  />
                </View>
                {isSale && (
                  <Text style={styles.optionalHint}>Optional — defaults to “Walk-in Customer”.</Text>
                )}

                {/* Dynamic summary */}
                <Animated.View
                  style={[
                    styles.summaryCard,
                    { borderColor: accent, backgroundColor: accentSoft, transform: [{ scale: summaryScale }] },
                  ]}
                >
                  <View style={styles.summaryCell}>
                    <Text style={[styles.summaryLabel, { color: accentText }]}>ITEMS</Text>
                    <Text style={[styles.summaryValue, { color: accentText }]}>{summary.itemCount}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryCell}>
                    <Text style={[styles.summaryLabel, { color: accentText }]}>TOTAL</Text>
                    <Text style={[styles.summaryValue, { color: accentText }]}>
                      {formatINR(summary.total)}
                    </Text>
                  </View>
                </Animated.View>

                {/* Item list */}
                <Text style={[styles.label, styles.listLabel]}>
                  {isSale ? 'Menu Items' : 'Inventory Items'}
                </Text>

                {loadingList ? (
                  <ActivityIndicator style={styles.listSpinner} color={COLORS.primary} />
                ) : (
                  listData.map((item, index) => {
                    const selection = selections[item.id];
                    if (isSale) {
                      const menuItem = item as BillingMenuItem;
                      return (
                        <BillItemCard
                          key={item.id}
                          mode="sale"
                          name={menuItem.name}
                          image={menuItem.image}
                          unitPrice={menuItem.price}
                          quantity={selection?.quantity ?? 0}
                          onQuantityChange={(qty) => handleQuantityChange(item.id, qty)}
                          index={index}
                        />
                      );
                    }
                    const invItem = item as BillingInventoryItem;
                    return (
                      <BillItemCard
                        key={item.id}
                        mode="purchase"
                        name={invItem.name}
                        image={invItem.image}
                        unitPrice={invItem.purchasePrice}
                        metricType={invItem.metricType}
                        quantity={selection?.quantity ?? 0}
                        selectedUnit={selection?.unit ?? unitsForMetric(invItem.metricType)[0]}
                        onQuantityChange={(qty) => handleQuantityChange(item.id, qty)}
                        onUnitChange={(unit) => handleUnitChange(item.id, unit)}
                        index={index}
                      />
                    );
                  })
                )}

                {validationError ? (
                  <View style={styles.errorRow}>
                    <MaterialIcons name="error-outline" size={15} color={COLORS.error} />
                    <Text style={styles.errorText}>{validationError}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>

          {/* Fixed bottom create button */}
                   {/* Fixed bottom create button */}
          <View style={[styles.bottomBar, { paddingBottom: tabBarClearance }]}>
            <Pressable
              onPress={handleCreate}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting, busy: submitting }}
            >
              <View
                style={[
                  styles.createBillButton,
                  { backgroundColor: accent, shadowColor: accent },
                  submitting && styles.buttonDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.createBillButtonText}>Create Bill</Text>
                    <Text style={styles.createBillButtonTotal}>{formatINR(summary.total)}</Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {toast && (
        <UniversalToast key={toast.id} type={toast.type} msg={toast.msg} onDismiss={hideToast} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
   scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 190 },

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
  title: { marginTop: 18, marginBottom: 18, fontSize: 28, fontWeight: '700', color: COLORS.text, letterSpacing: -0.4 },

  toggleTrack: {
    flexDirection: 'row',
    backgroundColor: COLORS.track,
    borderRadius: 16,
    padding: 4,
    marginBottom: 22,
  },
  togglePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '48%',
    borderRadius: 12,
    borderWidth: 1.5,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 12,
  },
  toggleLabel: { fontSize: 14.5, fontWeight: '600', color: COLORS.textMuted },

  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginLeft: 2 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 11 },
  input: { flex: 1, height: '100%', fontSize: 16, color: COLORS.text },
  optionalHint: { marginTop: 6, marginLeft: 2, fontSize: 12.5, color: COLORS.textLight },

  summaryCard: {
    flexDirection: 'row',
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 16,
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  summaryValue: { marginTop: 4, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryDivider: { width: 1, backgroundColor: 'rgba(0,0,0,0.06)' },

  listLabel: { marginTop: 24, marginBottom: 12 },
  listSpinner: { marginVertical: 30 },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 2,
  },
  errorText: { marginLeft: 6, fontSize: 13.5, fontWeight: '600', color: COLORS.error },

   bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    // paddingBottom is applied dynamically (tabBarClearance).
  },
  createBillButton: {
    height: 58,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  createBillButtonText: { fontSize: 16.5, fontWeight: '800', color: COLORS.white, letterSpacing: 0.2 },
  createBillButtonTotal: { fontSize: 16.5, fontWeight: '800', color: COLORS.white, fontVariant: ['tabular-nums'] },
});