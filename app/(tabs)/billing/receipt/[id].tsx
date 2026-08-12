/**
 * Billing/receipt/[id].tsx (BillReceiptScreen)
 *
 * Premium digital receipt — shared by newly created and historical invoices.
 * Loads by route param, so both flows render identically (no duplication).
 * Print/Share are reserved for future implementation.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BadgeCheck,
  ChevronLeft,
  Printer,
  Share2,
  ShoppingBag,
  Truck,
} from 'lucide-react-native';

import UniversalToast from '@/ui-components/UniversalToast';
import type { ToastType } from '@/ui-components/UniversalToast';
import { COLORS } from '../utils/theme';
import { fetchBillById } from '../utils/billing.data';
import {
  billTypeLabel,
  formatBillDate,
  formatBillTime,
  formatINR,
  formatQuantitySafe,
} from '../utils/receipt.utils';
import type { Bill } from '../utils/billing.types';

interface ToastPayload {
  id: number;
  type: ToastType;
  msg: string;
}

export default function BillReceiptScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const entrance = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToast({ id: Date.now(), type, msg });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const result = await fetchBillById(String(id));
        if (!isMounted) return;
        if (result) setBill(result);
        else setNotFound(true);
      } catch {
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Slide up + fade in once data is ready.
  useEffect(() => {
    if (!bill) return;
    Animated.parallel([
      Animated.timing(entrance, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [bill, entrance]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/billing');
  }, [router]);

  const handlePrint = useCallback(() => {
    showToast('success', 'Printing will be available soon.');
  }, [showToast]);

  const handleShare = useCallback(() => {
    showToast('success', 'Sharing will be available soon.');
  }, [showToast]);

  /* --------------------------------- States --------------------------------- */

  if (loading) {
    return (
      <SafeAreaView style={styles.stateScreen} edges={['top']}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (notFound || !bill) {
    return (
      <SafeAreaView style={styles.stateScreen} edges={['top']}>
        <StatusBar style="dark" />
        <Text style={styles.stateText}>Invoice not found.</Text>
      </SafeAreaView>
    );
  }

  const isSale = bill.type === 'sale';
  const accent = isSale ? COLORS.sale : COLORS.purchase;
  const accentSoft = isSale ? COLORS.saleSoft : COLORS.purchaseSoft;
  const accentBorder = isSale ? COLORS.saleBorder : COLORS.purchaseBorder;
  const accentText = isSale ? COLORS.saleText : COLORS.purchaseText;

  const animatedStyle = {
    opacity: entrance,
    transform: [
      { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
    ],
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <View style={styles.iconButton}>
            <ChevronLeft size={22} color={COLORS.text} strokeWidth={2.2} />
          </View>
        </Pressable>
        <View style={styles.topActions}>
          <Pressable onPress={handleShare} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share receipt">
            <View style={styles.iconButton}>
              <Share2 size={18} color={COLORS.text} strokeWidth={2.1} />
            </View>
          </Pressable>
          <Pressable onPress={handlePrint} hitSlop={8} accessibilityRole="button" accessibilityLabel="Print receipt">
            <View style={[styles.iconButton, styles.printButton]}>
              <Printer size={18} color={COLORS.primaryDark} strokeWidth={2.1} />
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.receipt, animatedStyle]}>
          {/* Header */}
          <View style={[styles.receiptHeader, { backgroundColor: accentSoft }]}>
            <View style={[styles.typeBadge, { backgroundColor: COLORS.surface, borderColor: accentBorder }]}>
              {isSale ? (
                <ShoppingBag size={14} color={accent} strokeWidth={2.3} />
              ) : (
                <Truck size={14} color={accent} strokeWidth={2.3} />
              )}
              <Text style={[styles.typeBadgeText, { color: accentText }]}>{billTypeLabel(bill.type)}</Text>
            </View>
            <Text style={styles.grandTotal}>{formatINR(bill.total)}</Text>
            <View style={styles.statusRow}>
              <BadgeCheck size={14} color={accent} strokeWidth={2.4} />
              <Text style={[styles.statusText, { color: accentText }]}>Completed</Text>
            </View>
          </View>

          {/* Notch divider */}
          <View style={styles.notchRow}>
            <View style={[styles.notch, styles.notchLeft]} />
            <View style={styles.dashedLine} />
            <View style={[styles.notch, styles.notchRight]} />
          </View>

          {/* Invoice info */}
          <View style={styles.infoSection}>
            <InfoRow label={isSale ? 'Customer' : 'Supplier'} value={bill.partyName} />
            <InfoRow label="Invoice ID" value={bill.id} mono />
            <InfoRow label="Date" value={formatBillDate(bill.createdAt)} />
            <InfoRow label="Time" value={formatBillTime(bill.createdAt)} />
          </View>

          <View style={styles.sectionDivider} />

          {/* Items */}
          <View style={styles.itemsSection}>
            <Text style={styles.itemsTitle}>ITEMS</Text>
            {bill.lines.map((line, index) => (
              <View key={`${line.refId}-${index}`}>
                <View style={styles.itemRow}>
                  <View style={styles.itemText}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {line.name}
                    </Text>
                    <Text style={styles.itemQty}>
                      ×{line.quantity}
                      {line.metricType && line.baseQuantity != null
                        ? ` · ${formatQuantitySafe(line.baseQuantity, line.metricType)}`
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemAmount}>{formatINR(line.unitPrice * line.quantity)}</Text>
                </View>
                {index < bill.lines.length - 1 && <View style={styles.itemDivider} />}
              </View>
            ))}
          </View>

          {/* Bottom summary */}
          <View style={styles.notchRow}>
            <View style={[styles.notch, styles.notchLeft]} />
            <View style={styles.dashedLine} />
            <View style={[styles.notch, styles.notchRight]} />
          </View>

          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={[styles.summaryValue, { color: accentText }]}>{formatINR(bill.total)}</Text>
            </View>
            <Text style={styles.thankYou}>Thank you for your business.</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {toast && (
        <UniversalToast key={toast.id} type={toast.type} msg={toast.msg} onDismiss={hideToast} />
      )}
    </SafeAreaView>
  );
}

/* ------------------------------- Info row ---------------------------------- */

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.infoValueMono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ---------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.track },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.track,
  },
  stateText: { fontSize: 15, fontWeight: '500', color: COLORS.textMuted },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  topActions: { flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#8A6D4A',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  printButton: { backgroundColor: COLORS.primaryFaint, borderColor: COLORS.primarySoft },

  scrollContent: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 40 },

  receipt: {
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#4A3F30',
    shadowOpacity: 0.14,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },

  receiptHeader: { alignItems: 'center', paddingTop: 28, paddingBottom: 24, paddingHorizontal: 24 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  typeBadgeText: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4 },
  grandTotal: { marginTop: 16, fontSize: 42, fontWeight: '800', color: COLORS.text, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  statusText: { fontSize: 13.5, fontWeight: '700' },

  notchRow: { flexDirection: 'row', alignItems: 'center' },
  notch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.track,
  },
  notchLeft: { marginLeft: -13 },
  notchRight: { marginRight: -13 },
  dashedLine: {
    flex: 1,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    marginHorizontal: 6,
  },

  infoSection: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 6 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 13.5, fontWeight: '600', color: COLORS.textMuted },
  infoValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, maxWidth: '60%' },
  infoValueMono: { fontVariant: ['tabular-nums'], letterSpacing: 0.3 },

  sectionDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 24, marginVertical: 12 },

  itemsSection: { paddingHorizontal: 24, paddingBottom: 8 },
  itemsTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.1, color: COLORS.textMuted, marginBottom: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  itemText: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  itemQty: { marginTop: 2, fontSize: 12.5, fontWeight: '500', color: COLORS.textMuted },
  itemAmount: { fontSize: 15, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  itemDivider: { height: 1, backgroundColor: COLORS.inputBackground },

  summarySection: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  summaryValue: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  thankYou: { marginTop: 16, textAlign: 'center', fontSize: 13, fontWeight: '500', color: COLORS.textLight },
});