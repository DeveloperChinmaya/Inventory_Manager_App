/**
 * Menu/components/RawMaterialRow.tsx
 *
 * Displays a single selected raw material inside MenuItemForm.
 * Mounts with a fade+rise entrance; deletion is delegated to the parent.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { COLORS } from '../utils/theme';
import { formatQuantity } from '../utils/menu.utils';
import type { MetricType } from '../utils/menu.types';

export interface RawMaterialRowProps {
  name: string;
  baseQuantity: number;
  metricType: MetricType;
  onDelete: () => void;
}

export function RawMaterialRow({
  name,
  baseQuantity,
  metricType,
  onDelete,
}: RawMaterialRowProps): React.JSX.Element {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: entrance,
          transform: [
            { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.iconLetter}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <View style={styles.textBox}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.quantity}>{formatQuantity(baseQuantity, metricType)}</Text>
      </View>
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name}`}
      >
        <View style={styles.deleteButton}>
          <Trash2 size={16} color={COLORS.error} strokeWidth={2.2} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconLetter: { fontSize: 15, fontWeight: '700', color: COLORS.primaryDark },
  textBox: { flex: 1, marginRight: 10 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  quantity: { marginTop: 2, fontSize: 13, fontWeight: '500', color: COLORS.textMuted },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RawMaterialRow;