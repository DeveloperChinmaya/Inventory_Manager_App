/**
 * Billing/BillItemCard.tsx
 *
 * Shared fast-selection card for the Create Bill screen.
 *
 *   mode="sale"     → menu item: image, name, selling price, qty controls
 *   mode="purchase" → inventory item: + unit selector constrained by metric
 *
 * SPEED: tapping anywhere on the card increments quantity. − / + are large
 * touch targets. Quantity never goes below zero and the card stays in place
 * at 0 for rapid re-selection.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Minus, Package, Plus, UtensilsCrossed } from 'lucide-react-native';

import { COLORS } from '../utils/theme';
import { formatINR, unitsForMetric } from '../utils/billing.utils';
import type { MetricType, Unit } from '../utils/billing.types';

export interface BillItemCardProps {
  mode: 'sale' | 'purchase';
  name: string;
  image: string | null;
  /** ₹ per unit (sale: selling price; purchase: price per base unit, optional). */
  unitPrice?: number;
  metricType?: MetricType;
  quantity: number;
  selectedUnit?: Unit;
  onQuantityChange: (quantity: number) => void;
  onUnitChange?: (unit: Unit) => void;
  index?: number;
}

export function BillItemCard({
  mode,
  name,
  image,
  unitPrice,
  metricType = 'pieces',
  quantity,
  selectedUnit,
  onQuantityChange,
  onUnitChange,
  index = 0,
}: BillItemCardProps): React.JSX.Element {
  const entrance = useRef(new Animated.Value(0)).current;
  const qtyScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 280,
      delay: Math.min(index, 8) * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  // Pop the quantity value on every change.
  useEffect(() => {
    qtyScale.setValue(1.25);
    Animated.spring(qtyScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 260,
    }).start();
  }, [quantity, qtyScale]);

  const increment = useCallback(() => onQuantityChange(quantity + 1), [quantity, onQuantityChange]);
  const decrement = useCallback(
    () => onQuantityChange(Math.max(0, quantity - 1)),
    [quantity, onQuantityChange],
  );

  const isSale = mode === 'sale';
  const accent = isSale ? COLORS.sale : COLORS.purchase;
  const accentSoft = isSale ? COLORS.saleSoft : COLORS.purchaseSoft;
  const accentBorder = isSale ? COLORS.saleBorder : COLORS.purchaseBorder;
  const selected = quantity > 0;
  const availableUnits = unitsForMetric(metricType);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
        ],
      }}
    >
      <Pressable
        onPress={increment}
        accessibilityRole="button"
        accessibilityLabel={`Add one ${name}`}
      >
        <View
          style={[
            styles.card,
            selected && { borderColor: accentBorder, backgroundColor: accentSoft },
          ]}
        >
          <View style={styles.imageBox}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                {isSale ? (
                  <UtensilsCrossed size={20} color={COLORS.primaryDark} strokeWidth={1.9} />
                ) : (
                  <Package size={20} color={COLORS.primaryDark} strokeWidth={1.9} />
                )}
              </View>
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            {unitPrice != null && unitPrice > 0 && (
              <Text style={styles.price}>{isSale ? formatINR(unitPrice) : `${formatINR(unitPrice)} / unit`}</Text>
            )}
          </View>

          {/* Quantity controls */}
          <View style={styles.qtyBox}>
            <Pressable
              onPress={decrement}
              hitSlop={8}
              style={[styles.qtyButton, quantity === 0 && styles.qtyButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${name} quantity`}
            >
              <Minus size={17} color={quantity === 0 ? COLORS.textLight : COLORS.text} strokeWidth={2.6} />
            </Pressable>

            <View style={styles.qtyValueBox}>
              <Text style={styles.qtyLabel}>Qty</Text>
              <Animated.Text style={[styles.qtyValue, { transform: [{ scale: qtyScale }] }]}>
                {quantity}
              </Animated.Text>
            </View>

            <Pressable
              onPress={increment}
              hitSlop={8}
              style={[styles.qtyButton, styles.qtyButtonPlus, { backgroundColor: accent }]}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${name} quantity`}
            >
              <Plus size={17} color={COLORS.white} strokeWidth={2.8} />
            </Pressable>
          </View>

          {/* Unit selector (purchase only, constrained by metric type) */}
          {!isSale && availableUnits.length > 0 && (
            <View style={styles.unitRow}>
              <Text style={styles.unitLabel}>Unit</Text>
              <View style={styles.unitChips}>
                {availableUnits.map((unit) => {
                  const active = selectedUnit === unit;
                  return (
                    <Pressable
                      key={unit}
                      onPress={() => onUnitChange?.(unit)}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <View
                        style={[
                          styles.unitChip,
                          active && { backgroundColor: accentSoft, borderColor: accent },
                        ]}
                      >
                        <Text
                          style={[
                            styles.unitChipText,
                            active && { color: isSale ? COLORS.saleText : COLORS.purchaseText, fontWeight: '800' },
                          ]}
                        >
                          {unit}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#4A3F30',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  imageBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.inputBackground,
    position: 'absolute',
    left: 12,
    top: 12,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryFaint,
  },
  info: { marginLeft: 68, marginRight: 4, minHeight: 40, justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  price: { marginTop: 2, fontSize: 13, fontWeight: '600', color: COLORS.textMuted },

  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  qtyButton: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.track,
  },
  qtyButtonPlus: {},
  qtyButtonDisabled: { opacity: 0.5 },
  qtyValueBox: { alignItems: 'center' },
  qtyLabel: { fontSize: 10.5, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5 },
  qtyValue: { marginTop: 1, fontSize: 20, fontWeight: '800', color: COLORS.text, fontVariant: ['tabular-nums'] },

  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  unitLabel: { fontSize: 11.5, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.4, marginRight: 10 },
  unitChips: { flexDirection: 'row', gap: 8 },
  unitChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: COLORS.inputBackground,
  },
  unitChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.3 },
});

export default BillItemCard;