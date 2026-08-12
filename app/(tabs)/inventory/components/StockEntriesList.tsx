/**
 * Inventory/components/StockEntriesList.tsx
 *
 * Renders an item's stock state:
 *   - Non-perishable → single "Current Stock" row
 *   - Perishable     → one row per purchase batch with auto-computed expiry
 *                      status (green → orange → red) and remaining time.
 *
 * Swipe-to-delete (left) is enabled ONLY for expired batches; swiping an
 * active batch does nothing. The gesture runs on react-native-gesture-handler
 * + Reanimated (UI thread), so it stays smooth on native and never fights
 * the parent ScrollView. Removed rows animate out and notify the parent.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ban, CheckCircle2, Timer, Trash2 } from 'lucide-react-native';

import { COLORS } from '../utils/theme';
import {
  formatExpiryDate,
  formatQuantity,
  getStockEntryStatus,
  remainingTimeLabel,
} from '../utils/inventory.utils';
import type { MetricType, StockEntry, StockStatus } from '../utils/inventory.types';

/* ------------------------------- Status styles ----------------------------- */

interface StatusPalette {
  dot: string;
  background: string;
  border: string;
  text: string;
}

const STATUS_PALETTES: Record<StockStatus, StatusPalette> = {
  healthy: {
    dot: COLORS.success,
    background: COLORS.successSoft,
    border: COLORS.successBorder,
    text: '#256A44',
  },
  warning: {
    dot: COLORS.warning,
    background: COLORS.warningSoft,
    border: COLORS.warningBorder,
    text: '#8A5E17',
  },
  expired: {
    dot: COLORS.error,
    background: COLORS.errorSoft,
    border: COLORS.errorBorder,
    text: '#96422B',
  },
};

const STATUS_ICONS: Record<StockStatus, (color: string) => React.ReactNode> = {
  healthy: (color) => <CheckCircle2 size={14} color={color} strokeWidth={2.4} />,
  warning: (color) => <Timer size={14} color={color} strokeWidth={2.4} />,
  expired: (color) => <Ban size={14} color={color} strokeWidth={2.4} />,
};

/* ------------------------------ Swipeable row ------------------------------ */

const ACTION_WIDTH = 84;
const OPEN_THRESHOLD = ACTION_WIDTH / 2;
/** Flings past this commit to delete; short, deliberate drags settle open. */
const FULL_SWIPE_THRESHOLD = ACTION_WIDTH * 1.4;
const ROW_HEIGHT = 72;

const SPRING_CONFIG = { damping: 24, stiffness: 240, mass: 0.7 };

interface SwipeableEntryRowProps {
  entry: StockEntry;
  metricType: MetricType;
  isLast: boolean;
  readOnly: boolean;
  onDelete?: (entry: StockEntry) => void;
}

function SwipeableEntryRow({
  entry,
  metricType,
  isLast,
  readOnly,
  onDelete,
}: SwipeableEntryRowProps): React.JSX.Element {
  const status = getStockEntryStatus(entry);
  const palette = STATUS_PALETTES[status.status];
  const swipeEnabled = !readOnly && status.isExpired && Boolean(onDelete);

  const translateX = useSharedValue(0);
  const progress = useSharedValue(0); // 0 → visible, 1 → removed (JS-thread layout anim)
  const removing = useSharedValue(false);

  /* ------------------------- Removal (parent notify) ------------------------ */

  const notifyDeleted = useCallback(() => {
    onDelete?.(entry);
  }, [entry, onDelete]);

  /** Slide the row out, then collapse height/opacity and notify the parent. */
  const animateRemoval = useCallback(() => {
    'worklet';
    if (removing.value) return;
    removing.value = true;
    translateX.value = withTiming(-500, { duration: 200 });
    progress.value = withTiming(1, { duration: 260 }, (finished) => {
      if (finished) runOnJS(notifyDeleted)();
    });
  }, [notifyDeleted, progress, removing, translateX]);

  /* --------------------------------- Gesture -------------------------------- */

  const pan = Gesture.Pan()
    // Horizontal-only so vertical list scrolling always wins cleanly.
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .enabled(swipeEnabled)
    .onUpdate((event) => {
      // Rubber-band to the right; hard clamp to the left.
      translateX.value =
        event.translationX < 0
          ? Math.max(event.translationX, -ACTION_WIDTH * 2)
          : Math.min(event.translationX * 0.15, 8);
    })
    .onEnd((event) => {
      if (event.translationX <= -FULL_SWIPE_THRESHOLD || event.velocityX < -1200) {
        animateRemoval();
        return;
      }
      translateX.value = withSpring(
        event.translationX <= -OPEN_THRESHOLD ? -ACTION_WIDTH : 0,
        SPRING_CONFIG,
      );
    })
    .onFinalize(() => {
      // Gesture cancelled/interrupted (e.g. scroll takeover) → settle closed.
      if (!removing.value && translateX.value > -OPEN_THRESHOLD) {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Delete backdrop fades in as the row slides; tints deeper past open point.
  const deleteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-ACTION_WIDTH, 0], [1, 0]),
    backgroundColor: interpolateColor(
      translateX.value,
      [-FULL_SWIPE_THRESHOLD, -OPEN_THRESHOLD, 0],
      ['#C94F3A', '#DF6C57', '#DF6C57'],
    ),
  }));

  // Layout-only values (height/opacity) — plain views driven on the JS thread.
  const collapseStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    maxHeight: interpolate(progress.value, [0, 1], [ROW_HEIGHT, 0]),
  }));

  return (
    <Animated.View style={[styles.collapseClip, collapseStyle]}>
      <View style={[styles.rowClip, !isLast && styles.rowDivider]}>
        {/* Delete action revealed behind the row */}
        {swipeEnabled && (
          <Animated.View style={[styles.deleteBehind, deleteStyle]}>
            <Pressable
              onPress={animateRemoval}
              style={styles.deleteBehindButton}
              accessibilityRole="button"
              accessibilityLabel="Delete expired batch"
            >
              <Trash2 size={18} color={COLORS.white} strokeWidth={2.2} />
              <Text style={styles.deleteBehindText}>Delete</Text>
            </Pressable>
          </Animated.View>
        )}

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.row, rowStyle]}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: palette.background, borderColor: palette.border },
              ]}
            >
              {STATUS_ICONS[status.status](palette.text)}
            </View>

            <Text style={styles.quantity}>{formatQuantity(entry.quantity, metricType)}</Text>

            <View style={styles.dateBox}>
              <Text style={styles.dateText}>
                {status.isExpired ? 'Expired ' : 'Expires '}
                {formatExpiryDate(entry.expiryDate)}
              </Text>
              <Text style={[styles.remainingText, { color: palette.text }]}>
                {remainingTimeLabel(status.daysLeft)}
              </Text>
            </View>

            {status.isExpired && (
              <View
                style={[
                  styles.expiredChip,
                  { backgroundColor: palette.background, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.expiredChipText, { color: palette.text }]}>Expired</Text>
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

/* ---------------------------------- List ----------------------------------- */

export interface StockEntriesListProps {
  entries: StockEntry[];
  metricType: MetricType;
  /** Called after an expired batch animates out (parent persists + toasts). */
  onDeleteEntry?: (entry: StockEntry) => void;
  /** Disables swipe actions (used inside the edit form's read-only card). */
  readOnly?: boolean;
}

export function StockEntriesList({
  entries,
  metricType,
  onDeleteEntry,
  readOnly = false,
}: StockEntriesListProps): React.JSX.Element {
  if (entries.length === 0) {
    return <Text style={styles.emptyText}>No stock batches yet.</Text>;
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>Stock Entries</Text>
      <View style={styles.listCard}>
        {entries.map((entry, index) => (
          <SwipeableEntryRow
            key={entry.id}
            entry={entry}
            metricType={metricType}
            isLast={index === entries.length - 1}
            readOnly={readOnly}
            onDelete={onDeleteEntry}
          />
        ))}
      </View>
      {!readOnly && entries.some((entry) => getStockEntryStatus(entry).isExpired) && (
        <Text style={styles.swipeHint}>Swipe an expired batch left to remove it.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
    marginBottom: 10,
    marginLeft: 2,
  },
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  collapseClip: { overflow: 'hidden' },
  rowClip: { backgroundColor: COLORS.surface },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: ROW_HEIGHT,
    backgroundColor: COLORS.surface,
  },
  statusBadge: {
    width: 30,
    height: 30,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  quantity: { fontSize: 15, fontWeight: '700', color: COLORS.text, minWidth: 62 },
  dateBox: { flex: 1, marginLeft: 8 },
  dateText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  remainingText: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  expiredChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginLeft: 8,
  },
  expiredChipText: { fontSize: 11, fontWeight: '700' },

  deleteBehind: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteBehindButton: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  deleteBehindText: { fontSize: 11, fontWeight: '700', color: COLORS.white },

  emptyText: { fontSize: 13.5, color: COLORS.textLight, marginLeft: 2 },
  swipeHint: { marginTop: 8, marginLeft: 2, fontSize: 12, color: COLORS.textLight },
});

export default StockEntriesList;