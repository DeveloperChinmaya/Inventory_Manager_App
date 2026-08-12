/**
 * Billing/BillCard.tsx
 *
 * Reusable invoice summary card for Billing History.
 * Sale → soft green badge + customer; Purchase → soft blue badge + supplier.
 * Purely presentational — navigation is delegated via onPress.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, ShoppingBag, Truck } from 'lucide-react-native';

import { COLORS } from '../utils/theme';
import { formatBillDate, formatBillTime, formatINR } from '../utils/billing.utils';
import type { Bill } from '../utils/billing.types';

export interface BillCardProps {
  bill: Bill;
  onPress: () => void;
  /** Stagger index for entrance animation (0-based). */
  index?: number;
}

export function BillCard({ bill, onPress, index = 0 }: BillCardProps): React.JSX.Element {
  const entrance = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, 6) * 50,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  const isSale = bill.type === 'sale';
  const accent = isSale ? COLORS.sale : COLORS.purchase;
  const accentSoft = isSale ? COLORS.saleSoft : COLORS.purchaseSoft;
  const accentBorder = isSale ? COLORS.saleBorder : COLORS.purchaseBorder;
  const accentText = isSale ? COLORS.saleText : COLORS.purchaseText;
  const itemCount = bill.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          { scale: pressScale },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(pressScale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
        }
        onPressOut={() =>
          Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
        }
        accessibilityRole="button"
        accessibilityLabel={`Open ${isSale ? 'sale' : 'purchase'} invoice ${bill.id}`}
      >
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: accentSoft, borderColor: accentBorder }]}>
            {isSale ? (
              <ShoppingBag size={18} color={accent} strokeWidth={2.2} />
            ) : (
              <Truck size={18} color={accent} strokeWidth={2.2} />
            )}
          </View>

          <View style={styles.body}>
            <View style={styles.topRow}>
              <View style={[styles.badge, { backgroundColor: accentSoft, borderColor: accentBorder }]}>
                <Text style={[styles.badgeText, { color: accentText }]}>
                  {isSale ? 'SALE' : 'PURCHASE'}
                </Text>
              </View>
              <Text style={styles.dateText}>
                {formatBillDate(bill.createdAt)} · {formatBillTime(bill.createdAt)}
              </Text>
            </View>

            <Text style={styles.party} numberOfLines={1}>
              {bill.partyName}
            </Text>
            <Text style={styles.items}>
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </Text>
          </View>

          <View style={styles.right}>
            <Text style={styles.total}>{formatINR(bill.total)}</Text>
            <ChevronRight size={16} color={COLORS.textLight} strokeWidth={2.4} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#4A3F30',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: { flex: 1, marginRight: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2.5 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  dateText: { fontSize: 11.5, fontWeight: '500', color: COLORS.textLight },
  party: { marginTop: 6, fontSize: 15, fontWeight: '700', color: COLORS.text },
  items: { marginTop: 2, fontSize: 12.5, fontWeight: '500', color: COLORS.textMuted },
  right: { alignItems: 'flex-end', gap: 4 },
  total: { fontSize: 16, fontWeight: '700', color: COLORS.text },
});

export default BillCard;