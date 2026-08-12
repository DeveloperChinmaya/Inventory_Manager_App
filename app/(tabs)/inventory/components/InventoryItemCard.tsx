/**
 * Inventory/InventoryItemCard.tsx
 *
 * Reusable display card for one inventory item:
 *   - Non-perishable → definition + current available stock
 *   - Perishable     → definition + stock batch list + active-only total
 *
 * Purely presentational; edit/navigation/deletion are delegated via props.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Package, Pencil } from 'lucide-react-native';

import StockEntriesList from './StockEntriesList';
import { COLORS } from '../utils/theme';
import { formatQuantity, metricTypeLabel, totalActiveStock } from '../utils/inventory.utils';
import type { InventoryItemWithStock, StockEntry } from '../utils/inventory.types';

export interface InventoryItemCardProps {
  item: InventoryItemWithStock;
  onEdit: () => void;
  /** Called after an expired batch is removed (parent refetches + toasts). */
  onDeleteEntry?: (entry: StockEntry) => void;
  /** Stagger index for entrance animation (0-based). */
  index?: number;
}

export function InventoryItemCard({
  item,
  onEdit,
  onDeleteEntry,
  index = 0,
}: InventoryItemCardProps): React.JSX.Element {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 6) * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  const totalActive = item.perishable ? totalActiveStock(item.stockEntries) : (item.currentStock ?? 0);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: entrance,
          transform: [
            { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      {/* Header: image + definition */}
      <View style={styles.headerRow}>
        <View style={styles.imageBox}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Package size={24} color={COLORS.primaryDark} strokeWidth={1.8} />
            </View>
          )}
        </View>

        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>Metric</Text>
              <Text style={styles.chipValue}>{metricTypeLabel(item.metricType)}</Text>
            </View>
            <View style={[styles.chip, item.perishable && styles.chipWarning]}>
              <Text style={styles.chipLabel}>Perishable</Text>
              <Text style={[styles.chipValue, item.perishable && styles.chipValueWarning]}>
                {item.perishable ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stock */}
      {item.perishable ? (
        <>
          <View style={styles.divider} />
          <StockEntriesList
            entries={item.stockEntries}
            metricType={item.metricType}
            onDeleteEntry={onDeleteEntry}
          />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Available</Text>
            <Text style={styles.totalValue}>{formatQuantity(totalActive, item.metricType)}</Text>
          </View>
        </>
      ) : (
        <View style={styles.stockRow}>
          <Text style={styles.stockLabel}>Available Stock</Text>
          <Text style={styles.stockValue}>{formatQuantity(totalActive, item.metricType)}</Text>
        </View>
      )}

      {/* Edit */}
      <View style={styles.footer}>
        <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`}>
          <View style={styles.editButton}>
            <Pencil size={13} color={COLORS.primaryDark} strokeWidth={2.4} />
            <Text style={styles.editButtonText}>Edit</Text>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#4A3F30',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  imageBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.inputBackground,
    marginRight: 14,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryFaint,
  },
  headerText: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: {
    backgroundColor: COLORS.blueSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipWarning: { backgroundColor: COLORS.warningSoft },
  chipLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.4 },
  chipValue: { marginTop: 1, fontSize: 12.5, fontWeight: '700', color: '#5B7BA6' },
  chipValueWarning: { color: COLORS.warning },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  stockLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  stockValue: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  totalValue: { fontSize: 16, fontWeight: '700', color: COLORS.primaryDark },

  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editButtonText: { fontSize: 13.5, fontWeight: '700', color: COLORS.primaryDark },
});

export default InventoryItemCard;