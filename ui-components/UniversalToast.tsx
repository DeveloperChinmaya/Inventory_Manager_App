/**
 * UniversalToast.tsx
 *
 * Standalone, reusable toast notification.
 *
 * Usage:
 *   {toast && (
 *     <UniversalToast
 *       type="success"
 *       msg="Store joined successfully"
 *       onDismiss={() => setToast(null)}
 *     />
 *   )}
 *
 * Behaviour:
 * - Slides + fades in on mount
 * - Auto-dismisses after `duration`
 * - Animates out, then invokes `onDismiss` (parent should unmount it)
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';

export type ToastType = 'success' | 'error';

export interface UniversalToastProps {
  type: ToastType;
  msg: string;
  /** How long the toast stays visible before animating out (ms). */
  duration?: number;
  /** Vertical placement of the toast. */
  position?: 'top' | 'bottom';
  /** Called after the exit animation completes — unmount the toast here. */
  onDismiss?: () => void;
}

interface ToastPalette {
  background: string;
  border: string;
  icon: string;
  text: string;
}

const PALETTES: Record<ToastType, ToastPalette> = {
  success: {
    background: '#ECF7EF',
    border: '#CDE8D6',
    icon: '#3E9B63',
    text: '#256A44',
  },
  error: {
    background: '#FBEEE9',
    border: '#F2D5CA',
    icon: '#D66A4E',
    text: '#96422B',
  },
};

export function UniversalToast({
  type,
  msg,
  duration = 3200,
  position = 'top',
  onDismiss,
}: UniversalToastProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const palette = PALETTES[type];
  const isTop = position === 'top';

  useEffect(() => {
    // Entrance: spring slide + fade.
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 200,
      mass: 0.9,
    }).start();

    // Exit after the visible duration.
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onDismiss?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [progress, duration, onDismiss]);

  const hiddenOffset = isTop ? -72 : 72;

  const animatedStyle = {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [hiddenOffset, 0],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1],
        }),
      },
    ],
  };

  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        isTop ? { top: insets.top + 12 } : { bottom: insets.bottom + 20 },
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        animatedStyle,
      ]}
    >
      <Icon size={20} color={palette.icon} strokeWidth={2.2} />
      <Text style={[styles.message, { color: palette.text }]} numberOfLines={2}>
        {msg}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
    elevation: 12,
    maxWidth: 440,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#4A3F30',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  message: {
    flexShrink: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});

export default UniversalToast;