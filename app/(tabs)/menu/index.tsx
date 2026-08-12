/**
 * Menu/index.tsx (MenuItemsScreen)
 *
 * Lists menu items with pull-to-refresh, loading + empty states, and a
 * floating "Create New Item" action. Navigates to create / edit routes.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Plus, UtensilsCrossed } from 'lucide-react-native';

import MenuItemCard from './components/MenuItemCard';
import UniversalToast from '@/ui-components/UniversalToast';
import type { ToastType } from '@/ui-components/UniversalToast';
import { COLORS } from './utils/theme';
import { fetchMenuItems } from './utils/menu.data';
import type { MenuItem } from './utils/menu.types';
import TopBar from '@/screen_components/home_screen/TopBar';

interface ToastPayload {
  id: number;
  type: ToastType;
  msg: string;
}

export default function MenuItemsScreen(): React.JSX.Element {
  const router = useRouter();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);

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

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') setLoading(true);
      try {
        const result = await fetchMenuItems();
        if (isMounted.current) setItems(result);
      } catch {
        if (isMounted.current) showToast('error', "We couldn't load your menu. Pull to retry.");
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
    load('initial');
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load('refresh');
  }, [load]);

  const handleCreate = useCallback(() => router.push('/menu/create'), [router]);
  const handleEdit = useCallback(
    (item: MenuItem) => router.push(`/menu/edit/${item.id}`),
    [router],
  );

  /* --------------------------------- States -------------------------------- */

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="dark" />
        <TopBar/>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your menu…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = items.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <TopBar/>

      {isEmpty ? (
        <View style={styles.centerState}>
          <View style={styles.emptyBadge}>
            <UtensilsCrossed size={34} color={COLORS.primaryDark} strokeWidth={1.8} />
          </View>
          <Text style={styles.emptyTitle}>No menu items yet</Text>
          <Text style={styles.emptySubtitle}>Create your first menu item.</Text>
          <Pressable
            onPress={handleCreate}
            accessibilityRole="button"
            accessibilityLabel="Create item"
          >
            <View style={styles.emptyButton}>
              <Plus size={18} color={COLORS.white} strokeWidth={2.6} />
              <Text style={styles.emptyButtonText}>Create Item</Text>
            </View>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>Menu</Text>
              <Text style={styles.subtitle}>
                {items.length} item{items.length === 1 ? '' : 's'} on your menu
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <MenuItemCard item={item} index={index} onEdit={() => handleEdit(item)} />
          )}
        />
      )}

      {/* Floating create button */}
      {!isEmpty && (
        <Pressable
          onPress={handleCreate}
          style={styles.fabShadow}
          accessibilityRole="button"
          accessibilityLabel="Create new item"
        >
          <View style={styles.fab}>
            <Plus size={20} color={COLORS.white} strokeWidth={2.8} />
            <Text style={styles.fabText}>Create New Item</Text>
          </View>
        </Pressable>
      )}

      {toast && (
        <UniversalToast key={toast.id} type={toast.type} msg={toast.msg} onDismiss={hideToast} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: { marginTop: 14, fontSize: 14.5, fontWeight: '500', color: COLORS.textMuted },

  emptyBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 6,
    borderColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  emptyTitle: { marginTop: 22, fontSize: 22, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { marginTop: 6, fontSize: 15, color: COLORS.textMuted },
  emptyButton: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 26,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  emptyButtonText: { fontSize: 15.5, fontWeight: '700', color: COLORS.white },

  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 140 },
  header: { paddingHorizontal: 4, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '700', color: COLORS.text, letterSpacing: -0.4 },
  subtitle: { marginTop: 4, fontSize: 14.5, color: COLORS.textMuted },

  fabShadow: {
    position: 'absolute',
    right: 20,
    bottom: 112, // clears the floating glass tab bar
    borderRadius: 20,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 56,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
  },
  fabText: { fontSize: 15.5, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
});