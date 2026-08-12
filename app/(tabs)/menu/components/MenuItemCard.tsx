/**
 * Menu/MenuItemCard.tsx
 *
 * Reusable display card for a menu item. Purely presentational —
 * all behaviour is delegated through props.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, UtensilsCrossed } from 'lucide-react-native';

import { COLORS } from '../utils/theme';
import { formatPrice, formatQuantity } from '../utils/menu.utils';
import type { MenuItem } from '../utils/menu.types';

const MAX_MATERIAL_PREVIEW = 3;

export interface MenuItemCardProps {
  item: MenuItem;
  onEdit: () => void;
  /** Stagger index used for entrance animation (0-based). */
  index?: number;
}

export function MenuItemCard({ item, onEdit, index = 0 }: MenuItemCardProps): React.JSX.Element {
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

  const materials = item.rawMaterials;
  const preview = materials.slice(0, MAX_MATERIAL_PREVIEW);
  const remainingCount = materials.length - preview.length;
  const materialCountLabel = `${materials.length} Raw Material${materials.length === 1 ? '' : 's'}`;

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
      <View style={styles.imageBox}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <UtensilsCrossed size={30} color={COLORS.primaryDark} strokeWidth={1.8} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.price}>{formatPrice(item.price)}</Text>
        </View>

        <View style={styles.countChip}>
          <Text style={styles.countChipText}>{materialCountLabel}</Text>
        </View>

        <View style={styles.materials}>
          {preview.map((material) => (
            <View key={material.inventoryItemId} style={styles.materialLine}>
              <View style={styles.materialDot} />
              <Text style={styles.materialName} numberOfLines={1}>
                {material.inventoryName ?? material.inventoryItemId}
              </Text>
              <Text style={styles.materialQty}>
                {formatQuantity(material.baseQuantity, material.metricType ?? 'pieces')}
              </Text>
            </View>
          ))}
          {remainingCount > 0 && (
            <Text style={styles.moreText}>+{remainingCount} more…</Text>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={onEdit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
          >
            <View style={styles.editButton}>
              <Pencil size={13} color={COLORS.primaryDark} strokeWidth={2.4} />
              <Text style={styles.editButtonText}>Edit</Text>
            </View>
          </Pressable>
        </View>
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
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#4A3F30',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  imageBox: {
    height: 148,
    backgroundColor: COLORS.inputBackground,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryFaint,
  },
  body: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: {
    flex: 1,
    marginRight: 12,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  price: { fontSize: 17, fontWeight: '700', color: COLORS.primaryDark },
  countChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: COLORS.blueSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countChipText: { fontSize: 11.5, fontWeight: '700', color: '#5B7BA6', letterSpacing: 0.3 },
  materials: { marginTop: 12 },
  materialLine: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  materialDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  materialName: { flex: 1, fontSize: 14, color: COLORS.text },
  materialQty: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  moreText: { marginTop: 7, marginLeft: 13, fontSize: 12.5, color: COLORS.textLight },
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

export default MenuItemCard;