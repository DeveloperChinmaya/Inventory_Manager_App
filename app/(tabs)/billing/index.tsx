/**
 * Billing/index.tsx (BillingHistoryScreen)
 *
 * Default Billing tab: grouped invoice history (Today → This Month →
 * previous months) with animated filter pills, filter-aware section totals,
 * pull-to-refresh and infinite scrolling.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Plus, Receipt } from 'lucide-react-native';

import BillCard from './components/BillCard';
import UniversalToast from '@/ui-components/UniversalToast';
import type { ToastType } from '@/ui-components/UniversalToast';
import { COLORS } from './utils/theme';
import { fetchBillsPage } from './utils/billing.data';
import { formatINR, groupBills } from './utils/billing.utils';
import type { Bill, BillType } from './utils/billing.types';
import TopBar from '@/screen_components/home_screen/TopBar';

type FilterKey = 'all' | BillType;

interface ToastPayload {
  id: number;
  type: ToastType;
  msg: string;
}

const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'sale', label: 'Sale Invoice' },
  { key: 'purchase', label: 'Purchase Invoice' },
];

export default function BillingHistoryScreen(): React.JSX.Element {
  const router = useRouter();

  const [bills, setBills] = useState<Bill[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const filterAnim = useRef(new Animated.Value(1)).current;
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToast({ id: Date.now(), type, msg });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  const loadFirstPage = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') setLoading(true);
      try {
        const page = await fetchBillsPage(0);
        if (!isMounted.current) return;
        setBills(page.bills);
        setHasMore(page.hasMore);
      } catch {
        if (isMounted.current) showToast('error', "We couldn't load billing history.");
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [showToast],
  );

  useEffect(() => {
    loadFirstPage('initial');
  }, [loadFirstPage]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFirstPage('refresh');
  }, [loadFirstPage]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await fetchBillsPage(bills.length);
      if (!isMounted.current) return;
      setBills((prev) => {
        const seen = new Set(prev.map((bill) => bill.id));
        return [...prev, ...page.bills.filter((bill) => !seen.has(bill.id))];
      });
      setHasMore(page.hasMore);
    } catch {
      // Silent — the next scroll attempt retries.
    } finally {
      if (isMounted.current) setLoadingMore(false);
    }
  }, [bills.length, hasMore, loading, loadingMore]);

  const handleFilterChange = useCallback(
    (next: FilterKey) => {
      if (next === filter) return;
      setFilter(next);
      filterAnim.setValue(0.6);
      Animated.timing(filterAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [filter, filterAnim],
  );

  const filteredBills = filter === 'all' ? bills : bills.filter((bill) => bill.type === filter);
  const sections = groupBills(filteredBills).map((section) => ({
    ...section,
    data: section.bills,
  }));

  const handleCreate = useCallback(() => router.push('./billing/create'), [router]);
  const handleOpenBill = useCallback(
    (bill: Bill) => router.push(`./billing/receipt/${bill.id}`),
    [router],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading billing history…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      <TopBar/>

      <SectionList
        sections={sections}
        keyExtractor={(bill) => bill.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.title}>Billing</Text>
              <Pressable onPress={handleCreate} accessibilityRole="button" accessibilityLabel="Create bill">
                <View style={styles.createButton}>
                  <Plus size={17} color={COLORS.white} strokeWidth={2.8} />
                  <Text style={styles.createButtonText}>Create Bill</Text>
                </View>
              </Pressable>
            </View>

            {/* Filter pills */}
            <View style={styles.pillsRow}>
              {FILTERS.map((pill) => {
                const active = filter === pill.key;
                const accentSoft =
                  pill.key === 'sale' ? COLORS.saleSoft : pill.key === 'purchase' ? COLORS.purchaseSoft : COLORS.primaryFaint;
                const accentBorder =
                  pill.key === 'sale' ? COLORS.sale : pill.key === 'purchase' ? COLORS.purchase : COLORS.primary;
                const accentText =
                  pill.key === 'sale' ? COLORS.saleText : pill.key === 'purchase' ? COLORS.purchaseText : COLORS.primaryDark;
                return (
                  <Pressable
                    key={pill.key}
                    onPress={() => handleFilterChange(pill.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View
                      style={[
                        styles.pill,
                        active && { backgroundColor: accentSoft, borderColor: accentBorder },
                      ]}
                    >
                      <Text style={[styles.pillText, active && { color: accentText, fontWeight: '800' }]}>
                        {pill.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Animated.View style={[styles.sectionHeader, { opacity: filterAnim }]}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotal}>{formatINR(section.total)}</Text>
          </Animated.View>
        )}
        renderItem={({ item, index, section }) => (
          <Animated.View style={{ opacity: filterAnim }}>
            <BillCard bill={item} index={index} onPress={() => handleOpenBill(item)} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyBadge}>
              <Receipt size={30} color={COLORS.primaryDark} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>No bills yet</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'Create your first invoice to see it here.'
                : `No ${filter === 'sale' ? 'sale' : 'purchase'} invoices found.`}
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footerSpinner} color={COLORS.primary} />
          ) : null
        }
      />

      {toast && (
        <UniversalToast key={toast.id} type={toast.type} msg={toast.msg} onDismiss={hideToast} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 14, fontSize: 14.5, fontWeight: '500', color: COLORS.textMuted },

  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130, flexGrow: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  title: { fontSize: 30, fontWeight: '700', color: COLORS.text, letterSpacing: -0.4 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  createButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  pillsRow: { flexDirection: 'row', gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  pill: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 18,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, letterSpacing: 0.1 },
  sectionTotal: { fontSize: 14, fontWeight: '800', color: COLORS.primaryDark, fontVariant: ['tabular-nums'] },

  emptyState: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  emptyBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 6,
    borderColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 18, fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { marginTop: 6, fontSize: 14.5, color: COLORS.textMuted, textAlign: 'center' },

  footerSpinner: { marginVertical: 18 },
});